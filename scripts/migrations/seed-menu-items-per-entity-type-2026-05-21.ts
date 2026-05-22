/**
 * seed-menu-items-per-entity-type-2026-05-21.ts
 *
 * Rationalises the polyphony Entu menu set:
 *   - Merges "Choirs" + "Umbrella Orgs" into one "Organisations" menu (all org instances)
 *   - Ensures one menu item per live v4E entity type in the Polyphony group
 *   - Deletes the superseded "Umbrella Orgs" menu
 *
 * Ops:
 *   UPDATE  Choirs (69c7f88b8489bfcb0e81b5f8) → rename + fix query
 *   DELETE  Umbrella Orgs (69c7f88c8489bfcb0e81b600)
 *   CREATE  one menu per remaining target type that lacks a Polyphony-group menu
 *
 * Idempotent: reads existing menu state before each op; skips if already correct.
 *
 * DRY_RUN=true (default) — prints manifest, writes no live mutations.
 * DRY_RUN=false          — executes ops against live polyphony db.
 *
 * Run:
 *   pnpm exec tsx scripts/migrations/seed-menu-items-per-entity-type-2026-05-21.ts
 *   DRY_RUN=false pnpm exec tsx scripts/migrations/seed-menu-items-per-entity-type-2026-05-21.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	getJwt,
	listEntities,
	fetchEntity,
	postProperties,
	deletePropertyValue,
	deleteEntity,
	createEntity,
	type EntuClient,
} from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

// ── Target menu design ─────────────────────────────────────────────────────
//
// Group: "Polyphony" for all domain menus.
// Ordinals: 10-step increments in logical grouping order.
// Naming: English human-readable labels (PO to confirm at review).
// Query: _type.string=<canonical> + sort=name.string (standard pattern).
// Types with 0 live instances are included — they are forward-looking v4E types,
// not retired types. Retired types (role, inventory_copy, etc.) are excluded.
//
// Open questions for PO marked [Q] below.

interface TargetMenu {
	entityType: string; // v4E canonical type name (used in query)
	label: string; // [Q] proposed English display name
	ordinal: number; // [Q] proposed sort order
	query: string; // full query string
	existingId?: string; // set if this is an UPDATE of an existing menu
	action: 'CREATE' | 'UPDATE' | 'KEEP';
}

// Existing Polyphony-group menu IDs (from sweep 2026-05-21)
const CHOIRS_ID = '69c7f88b8489bfcb0e81b5f8';
const UMBRELLA_ORGS_ID = '69c7f88c8489bfcb0e81b600';

const TARGET_MENUS: TargetMenu[] = [
	// ── Section 1.1: Identity + membership ──────────────────────────────────
	{
		entityType: 'person',
		label: 'Persons',
		ordinal: 100,
		query: '_type.string=person&sort=name.string',
		action: 'KEEP',
	}, // existing Entu meta menu — leave untouched
	{
		entityType: 'voice',
		label: 'Voices',
		ordinal: 110,
		query: '_type.string=voice&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'organization',
		label: 'Organisations',
		ordinal: 120,
		query: '_type.string=organization&sort=name.string',
		action: 'UPDATE',
		existingId: CHOIRS_ID,
	},
	{
		entityType: 'section',
		label: 'Sections',
		ordinal: 130,
		query: '_type.string=section&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'member',
		label: 'Members',
		ordinal: 140,
		query: '_type.string=member&sort=name.string',
		action: 'CREATE',
	},
	// ── Section 1.2: Library ────────────────────────────────────────────────
	{
		entityType: 'library',
		label: 'Libraries',
		ordinal: 200,
		query: '_type.string=library&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'work',
		label: 'Works',
		ordinal: 210,
		query: '_type.string=work&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'edition',
		label: 'Editions',
		ordinal: 220,
		query: '_type.string=edition&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'copy',
		label: 'Copies',
		ordinal: 230,
		query: '_type.string=copy&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'lending',
		label: 'Lending',
		ordinal: 240,
		query: '_type.string=lending&sort=name.string',
		action: 'CREATE',
	},
	// ── Section 1.3: Onboarding ─────────────────────────────────────────────
	{
		entityType: 'invitation',
		label: 'Invitations',
		ordinal: 300,
		query: '_type.string=invitation&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'application',
		label: 'Applications',
		ordinal: 310,
		query: '_type.string=application&sort=name.string',
		action: 'CREATE',
	},
	// ── Section 1.4: Temporal ───────────────────────────────────────────────
	{
		entityType: 'season',
		label: 'Seasons',
		ordinal: 400,
		query: '_type.string=season&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'event_series',
		label: 'Event Series',
		ordinal: 410,
		query: '_type.string=event_series&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'event',
		label: 'Events',
		ordinal: 420,
		query: '_type.string=event&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'repertoire_item',
		label: 'Repertoire',
		ordinal: 430,
		query: '_type.string=repertoire_item&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'program_item',
		label: 'Programme Items',
		ordinal: 440,
		query: '_type.string=program_item&sort=name.string',
		action: 'CREATE',
	},
	// ── Section 1.5: Participation ──────────────────────────────────────────
	{
		entityType: 'rsvp',
		label: 'RSVPs',
		ordinal: 500,
		query: '_type.string=rsvp&sort=name.string',
		action: 'CREATE',
	},
	{
		entityType: 'attendance',
		label: 'Attendance',
		ordinal: 510,
		query: '_type.string=attendance&sort=name.string',
		action: 'CREATE',
	},
];

// ── Helpers ────────────────────────────────────────────────────────────────

type PropValue = { _id?: string; string?: string; number?: number; boolean?: boolean };
type AnyEntity = { _id: string; [key: string]: unknown };

function firstString(entity: AnyEntity, prop: string): string | undefined {
	const vals = entity[prop] as PropValue[] | undefined;
	return Array.isArray(vals) ? vals[0]?.string : undefined;
}

function firstNumber(entity: AnyEntity, prop: string): number | undefined {
	const vals = entity[prop] as PropValue[] | undefined;
	return Array.isArray(vals) ? vals[0]?.number : undefined;
}

function firstId(entity: AnyEntity, prop: string): string | undefined {
	const vals = entity[prop] as PropValue[] | undefined;
	return Array.isArray(vals) ? vals[0]?._id : undefined;
}

// ── Result artifact accumulator ────────────────────────────────────────────

interface OpResult {
	action: 'UPDATE' | 'DELETE' | 'CREATE' | 'SKIP';
	entityType?: string;
	label?: string;
	entityId?: string;
	detail: string;
	dryRun: boolean;
}

const results: OpResult[] = [];

function log(r: OpResult) {
	results.push(r);
	const prefix = r.dryRun ? '[DRY-RUN]' : '[LIVE]';
	console.log(`  ${prefix} ${r.action} ${r.entityType ?? ''} "${r.label ?? ''}" — ${r.detail}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
	console.log('seed-menu-items-per-entity-type');
	console.log(`DB: ${DB} | DRY_RUN: ${DRY_RUN}`);
	const runAt = new Date().toISOString();
	console.log(`Time: ${runAt}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// ── Read current menu state ──────────────────────────────────────────────
	console.log('=== Reading current menu state ===');
	const menuList = await listEntities(client, {
		'_type.string': 'menu',
		props: '_id,name,query,group,ordinal',
		limit: '100',
	});
	const allMenus = menuList.entities as AnyEntity[];
	console.log(`  ${allMenus.length} menus found\n`);

	// Index existing Polyphony-group menus by query type-name for idempotency
	const polyphonyMenusByType = new Map<string, AnyEntity>();
	for (const m of allMenus) {
		const group = firstString(m, 'group');
		if (group !== 'Polyphony') continue;
		const q = firstString(m, 'query') ?? '';
		const match = q.match(/_type\.string=([A-Za-z_]+)/);
		if (match) polyphonyMenusByType.set(match[1], m);
	}

	// ── Print manifest ───────────────────────────────────────────────────────
	console.log('=== MANIFEST ===\n');

	console.log('KEEP (untouched — Entu meta or already correct):');
	console.log('  [Entities]    69bcfd8e9c031ab8e6ce8070 — Entu meta, no change');
	console.log('  [Menu]        69bcfd8e9c031ab8e6ce8071 — Entu meta, no change');
	console.log('  [Plugins]     69bcfd8e9c031ab8e6ce8072 — Entu meta, no change');
	console.log('  [Billing]     69bcfd8e9c031ab8e6ce8074 — Entu meta, no change');
	console.log('  [Persons]     69bcfd8e9c031ab8e6ce8073 — existing, query already correct\n');

	console.log('DELETE (1 op):');
	console.log(
		'  [Umbrella Orgs] 69c7f88c8489bfcb0e81b600 — superseded by unified Organisations menu\n',
	);

	console.log('UPDATE (1 op):');
	console.log('  [Choirs → Organisations] 69c7f88b8489bfcb0e81b5f8');
	console.log('    name: "Choirs" → "Organisations"');
	console.log('    query: "_type.string=Organization&org_type.string=collective&sort=name.string"');
	console.log('        → "_type.string=organization&sort=name.string"');
	console.log('    ordinal: 110 (no change)\n');

	const createTargets = TARGET_MENUS.filter((t) => t.action === 'CREATE');
	console.log(`CREATE (${createTargets.length} ops — one per remaining v4E type):`);
	for (const t of createTargets) {
		const existing = polyphonyMenusByType.get(t.entityType);
		const status = existing ? `ALREADY EXISTS (${existing._id}) — skip` : 'will create';
		console.log(`  [${t.label}] type=${t.entityType} ordinal=${t.ordinal} — ${status}`);
		console.log(`    query: ${t.query}`);
	}

	// ── Open questions block ─────────────────────────────────────────────────
	console.log('\n=== OPEN QUESTIONS FOR PO ===\n');
	console.log('[Q1] NAMING — proposed English labels (PO to confirm or correct):');
	console.log('     person→"Persons", voice→"Voices", organization→"Organisations",');
	console.log('     section→"Sections", member→"Members", library→"Libraries",');
	console.log('     work→"Works", edition→"Editions", copy→"Copies", lending→"Lending",');
	console.log('     invitation→"Invitations", application→"Applications", season→"Seasons",');
	console.log('     event_series→"Event Series", event→"Events", repertoire_item→"Repertoire",');
	console.log('     program_item→"Programme Items", rsvp→"RSVPs", attendance→"Attendance"');
	console.log(
		'     (Note: "Organisations" for org menu — British UX label; query uses v4E\n      canonical "organization" lowercase)',
	);
	console.log('\n[Q2] ZERO-INSTANCE TYPES — 14 types currently have 0 live instances');
	console.log('     (library, work, edition, copy, lending, invitation, application, season,');
	console.log('     event_series, event, repertoire_item, program_item, rsvp, attendance).');
	console.log('     Options:');
	console.log(
		'       A) Include all — menus show empty lists until instances exist (proposed default)',
	);
	console.log('       B) Skip for now — create only for types with live instances (5 types)');
	console.log('       C) PO decides per-type');
	console.log('\n[Q3] SORT ORDER — proposed: logical grouping (Identity 100s, Library 200s,');
	console.log(
		'     Onboarding 300s, Temporal 400s, Participation 500s) within the Polyphony group.',
	);
	console.log('     Alternative: alphabetical by label.');
	console.log(
		'\n[Q4] ORG MENU NAME — "Organisations" (British, matches Entu UI locale for et "Asutused")',
	);
	console.log(
		'     vs "Organizations" (American, matches v4E type name). Query is always lowercase',
	);
	console.log('     "organization" either way.');

	// ── Execute ops (only if not dry-run) ────────────────────────────────────
	console.log('\n=== EXECUTION ===');
	if (DRY_RUN) {
		console.log('  DRY_RUN=true — no live mutations. Set DRY_RUN=false to execute.\n');
		log({ action: 'SKIP', detail: 'dry-run mode — all ops skipped', dryRun: true });
	} else {
		// ── Op 1: UPDATE Choirs → Organisations ─────────────────────────────
		console.log('\n  Op 1: UPDATE Choirs → Organisations');
		const choirsEntity = (await fetchEntity(client, CHOIRS_ID)) as AnyEntity;
		const currentName = firstString(choirsEntity, 'name');
		const currentNameId = firstId(choirsEntity, 'name');
		const currentQueryId = firstId(choirsEntity, 'query');

		if (
			currentName === 'Organisations' &&
			firstString(choirsEntity, 'query') === '_type.string=organization&sort=name.string'
		) {
			log({
				action: 'SKIP',
				entityType: 'organization',
				label: 'Organisations',
				entityId: CHOIRS_ID,
				detail: 'already correct',
				dryRun: false,
			});
		} else {
			// Fix name
			if (currentName !== 'Organisations' && currentNameId) {
				await deletePropertyValue(client, currentNameId);
				await postProperties(client, CHOIRS_ID, [{ type: 'name', string: 'Organisations' }]);
			}
			// Fix query
			if (currentQueryId) {
				await deletePropertyValue(client, currentQueryId);
			}
			await postProperties(client, CHOIRS_ID, [
				{ type: 'query', string: '_type.string=organization&sort=name.string' },
			]);
			log({
				action: 'UPDATE',
				entityType: 'organization',
				label: 'Organisations',
				entityId: CHOIRS_ID,
				detail: 'name + query fixed',
				dryRun: false,
			});
		}

		// ── Op 2: DELETE Umbrella Orgs ──────────────────────────────────────
		console.log('\n  Op 2: DELETE Umbrella Orgs');
		try {
			await deleteEntity(client, UMBRELLA_ORGS_ID);
			log({
				action: 'DELETE',
				label: 'Umbrella Orgs',
				entityId: UMBRELLA_ORGS_ID,
				detail: 'deleted',
				dryRun: false,
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('404')) {
				log({
					action: 'SKIP',
					label: 'Umbrella Orgs',
					entityId: UMBRELLA_ORGS_ID,
					detail: 'already deleted (404)',
					dryRun: false,
				});
			} else {
				throw e;
			}
		}

		// ── Op 3: CREATE one menu per remaining type ────────────────────────
		console.log('\n  Op 3: CREATE missing menus');
		// Re-read menu state after ops 1+2 to get fresh idempotency picture
		const freshMenuList = await listEntities(client, {
			'_type.string': 'menu',
			props: '_id,name,query,group',
			limit: '100',
		});
		const freshPolyphonyByType = new Map<string, AnyEntity>();
		for (const m of freshMenuList.entities as AnyEntity[]) {
			if (firstString(m, 'group') !== 'Polyphony') continue;
			const q = firstString(m, 'query') ?? '';
			const match = q.match(/_type\.string=([A-Za-z_]+)/);
			if (match) freshPolyphonyByType.set(match[1], m);
		}

		for (const target of TARGET_MENUS) {
			if (target.action !== 'CREATE') continue;
			const existing = freshPolyphonyByType.get(target.entityType);
			if (existing) {
				log({
					action: 'SKIP',
					entityType: target.entityType,
					label: target.label,
					entityId: existing._id,
					detail: 'already exists',
					dryRun: false,
				});
				continue;
			}
			const created = await createEntity(client, [
				{ type: '_type', reference: '69bcfd8e9c031ab8e6ce803c' }, // menu type entity
				{ type: '_parent', reference: '69bcfd8e9c031ab8e6ce807a' }, // polyphony db entity
				{ type: '_sharing', string: 'domain' },
				{ type: 'group', string: 'Polyphony' },
				{ type: 'name', string: target.label },
				{ type: 'ordinal', number: target.ordinal },
				{ type: 'query', string: target.query },
			]);
			log({
				action: 'CREATE',
				entityType: target.entityType,
				label: target.label,
				entityId: created._id,
				detail: `ordinal=${target.ordinal}`,
				dryRun: false,
			});
		}
	}

	// ── Write artifact ─────────────────────────────────────────────────────
	const artifact = {
		runAt,
		db: DB,
		dryRun: DRY_RUN,
		targetMenuCount: TARGET_MENUS.filter((t) => t.action !== 'KEEP').length,
		ops: results,
	};
	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const resultsDir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(resultsDir, { recursive: true });
	const label = DRY_RUN ? 'dry-run' : 'live';
	const artifactPath = join(resultsDir, `seed-menu-items-per-entity-type-${label}-${ts}.json`);
	writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
