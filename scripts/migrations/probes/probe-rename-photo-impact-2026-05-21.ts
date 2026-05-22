/**
 * probe-rename-photo-impact-2026-05-21.ts
 *
 * Read-only discovery scan for the avatar+logo → photo rename migration.
 *
 * Enumerates:
 *   1. person instances with `avatar` property values (count, value _id, filename, filesize)
 *   2. organization instances with `logo` property values (same)
 *   3. The prop-def _id for `person.avatar` and `organization.logo` (the entities
 *      whose `name` value will be renamed to `photo`)
 *   4. Formula properties referencing `avatar` or `logo` by string (would need updating)
 *   5. Menu entities referencing `avatar` or `logo` in their query string
 *
 * Safe to run without authorization — no mutations.
 *
 * Run:
 *   set -a; . ~/.config/mvox/credentials.env; set +a
 *   pnpm exec tsx scripts/migrations/probes/probe-rename-photo-impact-2026-05-21.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt, listEntities, fetchEntity, type EntuClient } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

// Known from prior probes (session 8 — POLYPHONY_META_TYPE_ENTITY_ID)
const META_TYPE_ENTITY_ID = '69bcfd8e9c031ab8e6ce8034';
const META_TYPE_PROPERTY_ID = '69bcfd8e9c031ab8e6ce8048';

interface PropValueRecord {
	_id: string;
	filename?: string;
	filesize?: number;
	string?: string;
}

interface InstanceRecord {
	entityId: string;
	propertyValues: PropValueRecord[];
}

interface PropDefRecord {
	propDefEntityId: string;
	parentTypeName: string;
	parentTypeEntityId: string;
	nameValueId: string;
	currentName: string;
}

type ArtifactResult = {
	runAt: string;
	db: string;
	personAvatar: {
		propDef: PropDefRecord | null;
		instanceCount: number;
		instances: InstanceRecord[];
	};
	orgLogo: {
		propDef: PropDefRecord | null;
		instanceCount: number;
		instances: InstanceRecord[];
	};
	formulaReferences: Array<{
		entityId: string;
		entityName: string;
		propName: string;
		formula: string;
	}>;
	menuReferences: Array<{ entityId: string; menuName: string; query: string }>;
	openQuestions: string[];
	errors: string[];
};

async function findPropDef(
	client: EntuClient,
	typeName: string,
	propName: string,
): Promise<PropDefRecord | null> {
	// Prop-defs are entities of type _property, children of the type entity.
	// Get the type entity _id by querying _type.reference=META_TYPE_ENTITY_ID + name.string=<typeName>.
	const typeEntityResp = await listEntities(client, {
		'_type.reference': META_TYPE_ENTITY_ID,
		'name.string': typeName,
		props: '_id,name',
		limit: '5',
	});

	if (typeEntityResp.entities.length === 0) {
		console.warn(`  WARNING: no type entity found for name="${typeName}"`);
		return null;
	}
	const typeEntityId = typeEntityResp.entities[0]._id;

	// Now find the prop-def: _type.string=_property, _parent.reference=<typeEntityId>, name.string=<propName>
	const propDefResp = await listEntities(client, {
		'_type.reference': META_TYPE_PROPERTY_ID,
		'_parent.reference': typeEntityId,
		'name.string': propName,
		props: '_id,name',
		limit: '5',
	});

	if (propDefResp.entities.length === 0) {
		console.warn(`  WARNING: no prop-def found for ${typeName}.${propName}`);
		return null;
	}

	const propDefEntity = propDefResp.entities[0];
	const propDefId = propDefEntity._id;

	// Fetch the prop-def entity to get the name property _id (needed for rename op)
	const propDefFull = (await fetchEntity(client, propDefId)) as {
		_id: string;
		name?: Array<{ _id?: string; string?: string }>;
	};
	const nameValues = propDefFull.name ?? [];
	const nameValue = nameValues.find((v) => v._id && v.string === propName);

	if (!nameValue || !nameValue._id) {
		console.warn(`  WARNING: prop-def ${propDefId} name value missing _id — formula-cached?`);
		return null;
	}

	return {
		propDefEntityId: propDefId,
		parentTypeName: typeName,
		parentTypeEntityId: typeEntityId,
		nameValueId: nameValue._id,
		currentName: nameValue.string ?? propName,
	};
}

async function enumerateInstanceValues(
	client: EntuClient,
	typeName: string,
	propName: string,
): Promise<InstanceRecord[]> {
	// List all instances of this type that have the property set
	const resp = await listEntities(client, {
		'_type.string': typeName,
		[`${propName}._id.exists`]: 'true',
		props: `_id,${propName}`,
		limit: '500',
	});

	const results: InstanceRecord[] = [];
	for (const entity of resp.entities) {
		const rawValues = (entity as Record<string, unknown>)[propName];
		const values = Array.isArray(rawValues) ? (rawValues as Array<Record<string, unknown>>) : [];
		const propValues: PropValueRecord[] = values
			.filter((v) => v._id)
			.map((v) => ({
				_id: String(v._id),
				filename: v.filename ? String(v.filename) : undefined,
				filesize: v.filesize ? Number(v.filesize) : undefined,
				string: v.string ? String(v.string) : undefined,
			}));
		if (propValues.length > 0) {
			results.push({ entityId: entity._id, propertyValues: propValues });
		}
	}
	return results;
}

async function scanFormulaReferences(
	client: EntuClient,
	searchTerms: string[],
): Promise<Array<{ entityId: string; entityName: string; propName: string; formula: string }>> {
	// Formulas referencing avatar or logo by name would appear in prop-def entities
	// with formula.string containing the term. Query via q= free-text (case-insensitive).
	const matches: Array<{
		entityId: string;
		entityName: string;
		propName: string;
		formula: string;
	}> = [];
	for (const term of searchTerms) {
		const resp = await listEntities(client, {
			'_type.reference': META_TYPE_PROPERTY_ID,
			'formula.string': term,
			props: '_id,name,formula',
			limit: '100',
		});
		for (const entity of resp.entities) {
			const name = extractString(entity, 'name');
			const formula = extractString(entity, 'formula');
			if (formula && formula.includes(term)) {
				matches.push({
					entityId: entity._id,
					entityName: name ?? entity._id,
					propName: name ?? '(unknown)',
					formula,
				});
			}
		}
	}
	return matches;
}

async function scanMenuReferences(
	client: EntuClient,
	searchTerms: string[],
): Promise<Array<{ entityId: string; menuName: string; query: string }>> {
	const matches: Array<{ entityId: string; menuName: string; query: string }> = [];
	const resp = await listEntities(client, {
		'_type.string': 'menu',
		props: '_id,name,query',
		limit: '200',
	});
	for (const entity of resp.entities) {
		const query = extractString(entity, 'query') ?? '';
		const name = extractString(entity, 'name') ?? entity._id;
		if (searchTerms.some((t) => query.includes(t))) {
			matches.push({ entityId: entity._id, menuName: name, query });
		}
	}
	return matches;
}

function extractString(entity: { [key: string]: unknown }, prop: string): string | undefined {
	const values = entity[prop];
	if (!Array.isArray(values)) return undefined;
	const first = values[0] as Record<string, unknown> | undefined;
	return first?.string !== undefined ? String(first.string) : undefined;
}

async function main() {
	console.log('probe-rename-photo-impact-2026-05-21 — DISCOVERY (read-only)');
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	const runAt = new Date().toISOString();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const artifact: ArtifactResult = {
		runAt,
		db: DB,
		personAvatar: { propDef: null, instanceCount: 0, instances: [] },
		orgLogo: { propDef: null, instanceCount: 0, instances: [] },
		formulaReferences: [],
		menuReferences: [],
		openQuestions: [],
		errors: [],
	};

	try {
		// ── 1. person.avatar prop-def ──────────────────────────────────────────
		console.log('=== person.avatar prop-def ===');
		const avatarPropDef = await findPropDef(client, 'person', 'avatar');
		artifact.personAvatar.propDef = avatarPropDef;
		if (avatarPropDef) {
			console.log(`  prop-def entity _id : ${avatarPropDef.propDefEntityId}`);
			console.log(`  name value _id      : ${avatarPropDef.nameValueId}`);
			console.log(`  parent type entity  : ${avatarPropDef.parentTypeEntityId}`);
		} else {
			console.log('  NOT FOUND — may already be renamed, or prop-def absent');
			artifact.openQuestions.push(
				'person.avatar prop-def not found — verify manually if rename already happened',
			);
		}

		// ── 2. person instances with avatar ──────────────────────────────────
		console.log('\n=== person instances with avatar values ===');
		const personAvatarInstances = await enumerateInstanceValues(client, 'person', 'avatar');
		artifact.personAvatar.instanceCount = personAvatarInstances.length;
		artifact.personAvatar.instances = personAvatarInstances;
		console.log(`  Persons with avatar: ${personAvatarInstances.length}`);
		for (const inst of personAvatarInstances) {
			for (const v of inst.propertyValues) {
				console.log(
					`    entityId=${inst.entityId} valueId=${v._id} filename=${v.filename ?? '(none)'} filesize=${v.filesize ?? '(none)'}`,
				);
			}
		}
		if (personAvatarInstances.length === 0) {
			console.log('  (none — no live avatar values on person instances)');
			artifact.openQuestions.push(
				'person.avatar: 0 instances with values. May be already renamed or never set. Verify.',
			);
		}

		// ── 3. organization.logo prop-def ────────────────────────────────────
		console.log('\n=== organization.logo prop-def ===');
		const logoPropDef = await findPropDef(client, 'organization', 'logo');
		artifact.orgLogo.propDef = logoPropDef;
		if (logoPropDef) {
			console.log(`  prop-def entity _id : ${logoPropDef.propDefEntityId}`);
			console.log(`  name value _id      : ${logoPropDef.nameValueId}`);
			console.log(`  parent type entity  : ${logoPropDef.parentTypeEntityId}`);
		} else {
			console.log('  NOT FOUND — may already be renamed, or prop-def absent');
			artifact.openQuestions.push('organization.logo prop-def not found — verify manually');
		}

		// ── 4. organization instances with logo ──────────────────────────────
		console.log('\n=== organization instances with logo values ===');
		const orgLogoInstances = await enumerateInstanceValues(client, 'organization', 'logo');
		artifact.orgLogo.instanceCount = orgLogoInstances.length;
		artifact.orgLogo.instances = orgLogoInstances;
		console.log(`  Orgs with logo: ${orgLogoInstances.length}`);
		for (const inst of orgLogoInstances) {
			for (const v of inst.propertyValues) {
				console.log(
					`    entityId=${inst.entityId} valueId=${v._id} filename=${v.filename ?? '(none)'} filesize=${v.filesize ?? '(none)'}`,
				);
			}
		}
		if (orgLogoInstances.length === 0) {
			console.log('  (none — no live logo values on org instances)');
		}

		// ── 5. Formula references to avatar/logo ─────────────────────────────
		console.log('\n=== Formula properties referencing avatar/logo ===');
		const formulaMatches = await scanFormulaReferences(client, ['avatar', 'logo']);
		artifact.formulaReferences = formulaMatches;
		if (formulaMatches.length === 0) {
			console.log('  (none — no formula prop-defs reference avatar or logo by string)');
		} else {
			for (const m of formulaMatches) {
				console.log(
					`  FORMULA REF: entity=${m.entityId} name="${m.entityName}" formula="${m.formula}"`,
				);
			}
		}

		// ── 6. Menu references to avatar/logo ────────────────────────────────
		console.log('\n=== Menu entities with avatar/logo in query ===');
		const menuMatches = await scanMenuReferences(client, ['avatar', 'logo']);
		artifact.menuReferences = menuMatches;
		if (menuMatches.length === 0) {
			console.log('  (none — no menus reference avatar or logo in their query string)');
		} else {
			for (const m of menuMatches) {
				console.log(`  MENU REF: entity=${m.entityId} name="${m.menuName}" query="${m.query}"`);
			}
		}
	} catch (err) {
		const msg = String(err);
		console.error('\nERROR:', msg);
		artifact.errors.push(msg);
	}

	// ── Write artifact ────────────────────────────────────────────────────────
	const ts = runAt.replace(/[:.]/g, '-').slice(0, 23);
	const dir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `probe-rename-photo-impact-${ts}.json`);
	writeFileSync(path, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${path}`);

	console.log('\n=== SUMMARY ===');
	console.log(`personAvatar.propDef found : ${artifact.personAvatar.propDef !== null}`);
	console.log(`personAvatar.instanceCount : ${artifact.personAvatar.instanceCount}`);
	console.log(`orgLogo.propDef found      : ${artifact.orgLogo.propDef !== null}`);
	console.log(`orgLogo.instanceCount      : ${artifact.orgLogo.instanceCount}`);
	console.log(`formulaReferences          : ${artifact.formulaReferences.length}`);
	console.log(`menuReferences             : ${artifact.menuReferences.length}`);
	console.log(`openQuestions              : ${artifact.openQuestions.length}`);
	console.log(`errors                     : ${artifact.errors.length}`);

	if (artifact.errors.length > 0) process.exit(1);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
