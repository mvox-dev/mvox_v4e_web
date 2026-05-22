/**
 * Type-name-string sweep — read-only probe
 *
 * Scans for literal type-name strings used in menu queries, formula sources,
 * and reference_query property definitions on the polyphony Entu db, then
 * flags any that don't match the v4E canonical type list.
 *
 * Scan scope:
 *   Pass 1 — menu entities: fetch all, inspect query/reference_query props
 *   Pass 2 — _property entities with type=formula: inspect formula source strings
 *   Pass 3 — _property entities with type=reference: inspect reference_query strings
 *
 * Authorization: READ-ONLY. No POST / PUT / DELETE / PATCH.
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-type-name-string-sweep-2026-05-21.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

// Canonical v4E entity type names (from entu/research docs/schema/v4E/schema.ts)
const CANONICAL_TYPES = new Set([
	'voice',
	'person',
	'organization',
	'section',
	'member',
	'library',
	'work',
	'edition',
	'copy',
	'lending',
	'invitation',
	'application',
	'season',
	'event_series',
	'event',
	'repertoire_item',
	'program_item',
	'rsvp',
	'attendance',
]);

// Patterns that look like type-name references in query/formula strings.
// Covers: _type.string=X, _type.string==X, _type.string="X", _type.string=='X'
// and formula-style: _type.string X, _type.string "X"
const TYPE_NAME_PATTERNS = [
	// Query string: _type.string=Value or _type.string="Value" or _type.string='Value'
	/_type\.string\s*==?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/g,
	// Alternative without quotes (bare word)
	/_type\.string=([A-Za-z_][A-Za-z0-9_]*)/g,
];

function extractTypeNames(text: string): string[] {
	const found: string[] = [];
	for (const pattern of TYPE_NAME_PATTERNS) {
		pattern.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = pattern.exec(text)) !== null) {
			const name = m[1].trim();
			if (name && !found.includes(name)) found.push(name);
		}
	}
	return found;
}

interface Mismatch {
	entityId: string;
	entityName?: string;
	entuUrl?: string;
	source: string; // which property (query, formula, reference_query)
	rawText: string; // verbatim value
	extractedTypeName: string;
	suggestion: string;
}

type PropValue = { _id?: string; string?: string; reference?: string; boolean?: boolean };
type AnyEntity = { _id: string; [key: string]: unknown };

async function rawGet(jwt: string, path: string): Promise<unknown> {
	const url = `${API_BASE}/${DB}/${path}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

async function fetchAll(
	jwt: string,
	params: Record<string, string>,
	limit = 500,
): Promise<AnyEntity[]> {
	const merged = { ...params, limit: String(limit) };
	const qs = new URLSearchParams(merged).toString();
	const resp = (await rawGet(jwt, `entity/?${qs}`)) as { entities?: AnyEntity[]; count?: number };
	const entities = resp.entities ?? [];
	const total = resp.count ?? entities.length;
	if (total > limit) {
		console.warn(`  WARNING: count=${total} > limit=${limit}; results truncated`);
	}
	return entities;
}

/** Best-guess spelling correction for common mismatches */
function suggest(found: string): string {
	const lower = found.toLowerCase();
	// British spelling
	if (lower === 'organisation') return 'organization';
	if (lower === 'organisations') return 'organization (singular)';
	// Plural forms
	for (const canonical of CANONICAL_TYPES) {
		if (lower === canonical + 's') return canonical;
		if (lower === canonical + 'es') return canonical;
	}
	// Case mismatch (capitalised first letter or all caps)
	for (const canonical of CANONICAL_TYPES) {
		if (lower === canonical) return canonical;
	}
	// Underscore variations — check partial matches
	const withUnderscore = lower.replace(/ /g, '_');
	if (CANONICAL_TYPES.has(withUnderscore)) return withUnderscore;
	return `(no suggestion — '${found}' not recognised)`;
}

function checkTypeNames(
	entityId: string,
	entityName: string | undefined,
	source: string,
	rawText: string,
	mismatches: Mismatch[],
) {
	const names = extractTypeNames(rawText);
	for (const name of names) {
		if (!CANONICAL_TYPES.has(name)) {
			mismatches.push({
				entityId,
				entityName,
				entuUrl: `https://entu.app/polyphony/${entityId}`,
				source,
				rawText,
				extractedTypeName: name,
				suggestion: suggest(name),
			});
		}
	}
}

function getStringValues(entity: AnyEntity, propName: string): string[] {
	const val = entity[propName];
	if (!val) return [];
	if (Array.isArray(val)) {
		return (val as PropValue[]).flatMap((v) => (v.string ? [v.string] : []));
	}
	return [];
}

function getFirstString(entity: AnyEntity, propName: string): string | undefined {
	return getStringValues(entity, propName)[0];
}

async function main() {
	console.log('Type-name-string sweep probe — read-only');
	console.log(`DB: ${DB}`);
	const runAt = new Date().toISOString();
	console.log(`Time: ${runAt}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

	const menuMismatches: Mismatch[] = [];
	const formulaMismatches: Mismatch[] = [];
	const referenceQueryMismatches: Mismatch[] = [];

	// ── Pass 1: menu entities ──────────────────────────────────────────────────
	console.log('=== Pass 1: menu entities ===');
	const menus = await fetchAll(jwt, {
		'_type.string': 'menu',
		props: '_id,name,query,reference_query,add,search',
	});
	console.log(`  Found ${menus.length} menu entities\n`);

	for (const menu of menus) {
		const name = getFirstString(menu, 'name');
		const entityId = menu._id;

		// Check all string-type properties that might contain type-name queries
		for (const propName of ['query', 'reference_query', 'add', 'search']) {
			for (const rawText of getStringValues(menu, propName)) {
				if (rawText) {
					checkTypeNames(entityId, name, `menu.${propName}`, rawText, menuMismatches);
				}
			}
		}
	}

	console.log(`  Menu mismatches: ${menuMismatches.length}`);
	for (const m of menuMismatches) {
		console.log(
			`    [MISMATCH] ${m.entityName ?? m.entityId} | ${m.source}: "${m.extractedTypeName}" → suggest: "${m.suggestion}"`,
		);
		console.log(`      raw: ${m.rawText}`);
	}

	// Print all menu names + queries for full visibility
	console.log('\n  All menu entities (name | query):');
	for (const menu of menus) {
		const name = getFirstString(menu, 'name') ?? '(no name)';
		const queries = [
			...getStringValues(menu, 'query'),
			...getStringValues(menu, 'reference_query'),
		];
		console.log(`    [${menu._id}] ${name}`);
		for (const q of queries) {
			console.log(`      query: ${q}`);
		}
	}

	// ── Pass 2: formula property definitions ──────────────────────────────────
	console.log('\n=== Pass 2: formula property definitions ===');
	const formulaProps = await fetchAll(jwt, {
		'_type.string': '_property',
		'type.string': 'formula',
		props: '_id,name,formula',
	});
	console.log(`  Found ${formulaProps.length} formula property definitions\n`);

	for (const prop of formulaProps) {
		const name = getFirstString(prop, 'name');
		for (const rawText of getStringValues(prop, 'formula')) {
			if (rawText) {
				checkTypeNames(prop._id, name, '_property(formula).formula', rawText, formulaMismatches);
			}
		}
	}

	console.log(`  Formula mismatches: ${formulaMismatches.length}`);
	for (const m of formulaMismatches) {
		console.log(
			`    [MISMATCH] prop:${m.entityName ?? m.entityId} | "${m.extractedTypeName}" → suggest: "${m.suggestion}"`,
		);
		console.log(`      raw: ${m.rawText}`);
	}

	// ── Pass 3: reference property definitions ────────────────────────────────
	console.log('\n=== Pass 3: reference property definitions ===');
	const referenceProps = await fetchAll(jwt, {
		'_type.string': '_property',
		'type.string': 'reference',
		props: '_id,name,reference_query',
	});
	console.log(`  Found ${referenceProps.length} reference property definitions\n`);

	for (const prop of referenceProps) {
		const name = getFirstString(prop, 'name');
		for (const rawText of getStringValues(prop, 'reference_query')) {
			if (rawText) {
				checkTypeNames(
					prop._id,
					name,
					'_property(reference).reference_query',
					rawText,
					referenceQueryMismatches,
				);
			}
		}
	}

	console.log(`  Reference-query mismatches: ${referenceQueryMismatches.length}`);
	for (const m of referenceQueryMismatches) {
		console.log(
			`    [MISMATCH] prop:${m.entityName ?? m.entityId} | "${m.extractedTypeName}" → suggest: "${m.suggestion}"`,
		);
		console.log(`      raw: ${m.rawText}`);
	}

	// ── Write artifact ─────────────────────────────────────────────────────────
	const findings = {
		runAt,
		db: DB,
		canonicalTypeCount: CANONICAL_TYPES.size,
		canonicalTypes: [...CANONICAL_TYPES].sort(),
		pass1Menu: {
			totalMenus: menus.length,
			mismatchCount: menuMismatches.length,
			mismatches: menuMismatches,
			allMenus: menus.map((m) => ({
				_id: m._id,
				name: getFirstString(m, 'name'),
				query: getStringValues(m, 'query'),
				reference_query: getStringValues(m, 'reference_query'),
				add: getStringValues(m, 'add'),
				search: getStringValues(m, 'search'),
			})),
		},
		pass2Formula: {
			totalFormulaProps: formulaProps.length,
			mismatchCount: formulaMismatches.length,
			mismatches: formulaMismatches,
		},
		pass3Reference: {
			totalReferenceProps: referenceProps.length,
			mismatchCount: referenceQueryMismatches.length,
			mismatches: referenceQueryMismatches,
		},
	};

	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const resultsDir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(resultsDir, { recursive: true });
	const artifactPath = join(resultsDir, `probe-type-name-string-sweep-${ts}.json`);
	writeFileSync(artifactPath, JSON.stringify(findings, null, 2));
	console.log(`\nArtifact: ${artifactPath}`);

	// ── Summary ───────────────────────────────────────────────────────────────
	console.log('\n=== SUMMARY ===');
	console.log(
		`Pass 1 (menu):      ${menus.length} menus scanned, ${menuMismatches.length} mismatches`,
	);
	console.log(
		`Pass 2 (formula):   ${formulaProps.length} formula props scanned, ${formulaMismatches.length} mismatches`,
	);
	console.log(
		`Pass 3 (reference): ${referenceProps.length} reference props scanned, ${referenceQueryMismatches.length} mismatches`,
	);
	console.log(
		`Total mismatches:   ${menuMismatches.length + formulaMismatches.length + referenceQueryMismatches.length}`,
	);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
