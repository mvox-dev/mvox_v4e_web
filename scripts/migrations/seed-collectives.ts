/**
 * Seed collectives, sections, persons, and members into the polyphony Entu DB.
 *
 * Dependency order:
 *   1. person entities (120 mock persons; name = plain string per v4E schema.ts)
 *   2. voice lookup (by name, from seeded voice entities)
 *   3. umbrella orgs (founder = elected person; _inheritrights: false)
 *   4. collective orgs (founder = elected person; umbrella parent added as second POST)
 *   5. sections (under collective; voice ref looked up by name)
 *   6. members (person ref + section ref + status: "active"; private)
 *
 * Idempotent: check-then-skip at every step; safe to re-run.
 * Dry-run: pass --dry-run to preview without writing.
 *
 * NOTE: person.name is a plain string per v4E schema.ts. The live DB may still have
 * forename/surname as pre-Phase-D artifacts — this script does not touch those.
 */

import { getJwt, createEntity, listEntities, POLYPHONY_META_TYPE_ENTITY_ID, type EntuClient, type EntuProperty } from './lib/entu-client.ts';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const ENTU_API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const ENTU_DB = process.env.ENTU_DB ?? 'polyphony';
const ENTU_API_KEY = process.env.ENTU_API_KEY;

if (!ENTU_API_KEY) {
	console.error('ERROR: ENTU_API_KEY is not set');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface SectionSpec {
	name: string;
	voice: string;
	display_order: number;
	persons: string[];
}

interface CollectiveSpec {
	name: string;
	location: string;
	umbrella: string;
	founder: string;
	sections: SectionSpec[];
}

interface UmbrellaSpec {
	name: string;
	location: string;
	founder: string;
}

interface Manifest {
	umbrellas: UmbrellaSpec[];
	collectives: CollectiveSpec[];
}

// ---------------------------------------------------------------------------
// API helpers (addProperties — not yet in entu-client.ts; toolkit candidate)
// ---------------------------------------------------------------------------

async function addProperties(client: EntuClient, entityId: string, properties: EntuProperty[], dryRun: boolean): Promise<void> {
	if (dryRun) return;
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(properties),
	});
	if (!res.ok) {
		throw new Error(`addProperties(${entityId}) failed: ${res.status} ${await res.text()}`);
	}
}

// ---------------------------------------------------------------------------
// Type-id resolution
// ---------------------------------------------------------------------------

async function resolveTypeId(client: EntuClient, typeName: string): Promise<string> {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': typeName,
		props: '_id',
	});
	if (resp.count === 0) throw new Error(`entity-type "${typeName}" not found — run Phase B first`);
	return resp.entities[0]._id;
}

// ---------------------------------------------------------------------------
// Idempotency: find existing entity by type + name
// ---------------------------------------------------------------------------

async function findByName(client: EntuClient, typeName: string, name: string): Promise<string | null> {
	const resp = await listEntities(client, {
		'_type.string': typeName,
		'name.string': name,
		props: '_id',
	});
	return resp.count > 0 ? resp.entities[0]._id : null;
}

// ---------------------------------------------------------------------------
// Step 1: Seed voice lookup map
// ---------------------------------------------------------------------------

async function buildVoiceMap(client: EntuClient, voiceNames: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	for (const name of voiceNames) {
		const id = await findByName(client, 'voice', name);
		if (!id) throw new Error(`voice "${name}" not found — run seed-voices.ts first`);
		map.set(name, id);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Step 2: Seed persons
// ---------------------------------------------------------------------------

async function seedPerson(
	client: EntuClient,
	personTypeId: string,
	name: string,
	dryRun: boolean,
	result: SeedResult
): Promise<string | null> {
	const existing = await findByName(client, 'person', name);
	if (existing) {
		console.log(`  [person] "${name}": EXISTS (${existing}) — skip`);
		result.persons.skipped.push({ name, _id: existing });
		return existing;
	}

	if (dryRun) {
		console.log(`  [person] "${name}": WOULD CREATE`);
		result.persons.wouldCreate.push({ name });
		return null;
	}

	const entity = await createEntity(client, [
		{ type: '_type', reference: personTypeId },
		{ type: 'name', string: name },
		{ type: '_sharing', string: 'public' },
	]);
	console.log(`  [person] "${name}": CREATED (${entity._id})`);
	result.persons.created.push({ name, _id: entity._id });
	return entity._id;
}

// ---------------------------------------------------------------------------
// Step 3: Seed org (umbrella or collective)
// ---------------------------------------------------------------------------

async function seedOrg(
	client: EntuClient,
	orgTypeId: string,
	spec: { name: string; location: string; founder: string },
	founderPersonId: string,
	dryRun: boolean,
	result: SeedResult,
	kind: 'umbrella' | 'collective'
): Promise<string | null> {
	const existing = await findByName(client, 'organization', spec.name);
	if (existing) {
		console.log(`  [${kind}] "${spec.name}": EXISTS (${existing}) — skip`);
		result.orgs.skipped.push({ name: spec.name, _id: existing, kind });
		return existing;
	}

	if (dryRun) {
		console.log(`  [${kind}] "${spec.name}": WOULD CREATE (founder: ${spec.founder})`);
		result.orgs.wouldCreate.push({ name: spec.name, kind, founder: spec.founder });
		return null;
	}

	const entity = await createEntity(client, [
		{ type: '_type', reference: orgTypeId },
		{ type: '_parent', reference: founderPersonId },
		{ type: 'name', string: spec.name },
		{ type: 'location', string: spec.location },
		{ type: '_sharing', string: 'public' },
		{ type: '_inheritrights', boolean: false },
	]);
	console.log(`  [${kind}] "${spec.name}": CREATED (${entity._id})`);
	result.orgs.created.push({ name: spec.name, _id: entity._id, kind, founder: spec.founder });
	return entity._id;
}

// ---------------------------------------------------------------------------
// Step 4: Seed section
// ---------------------------------------------------------------------------

async function seedSection(
	client: EntuClient,
	sectionTypeId: string,
	collective: { name: string; _id: string },
	spec: SectionSpec,
	voiceMap: Map<string, string>,
	dryRun: boolean,
	result: SeedResult
): Promise<string | null> {
	// Scope by parent to avoid name collisions across collectives (e.g., multiple "Bass" sections).
	// In dry-run, collective._id may be '' (not yet created) — skip the check and log WOULD CREATE.
	if (dryRun && !collective._id) {
		console.log(`  [section] "${spec.name}" under "${collective.name}": WOULD CREATE (voice: ${spec.voice})`);
		result.sections.wouldCreate.push({ name: spec.name, collective: collective.name, voice: spec.voice });
		return null;
	}

	const existingResp = await listEntities(client, {
		'_type.string': 'section',
		'name.string': spec.name,
		'_parent.reference': collective._id,
		props: '_id',
	});
	if (existingResp.count > 0) {
		const existingId = existingResp.entities[0]._id;
		console.log(`  [section] "${spec.name}" under "${collective.name}": EXISTS (${existingId}) — skip`);
		result.sections.skipped.push({ name: spec.name, collective: collective.name, _id: existingId });
		return existingId;
	}

	const voiceId = voiceMap.get(spec.voice);
	if (!voiceId) throw new Error(`voice "${spec.voice}" not in voice map`);

	if (dryRun) {
		console.log(`  [section] "${spec.name}" under "${collective.name}": WOULD CREATE (voice: ${spec.voice})`);
		result.sections.wouldCreate.push({ name: spec.name, collective: collective.name, voice: spec.voice });
		return null;
	}

	const props: EntuProperty[] = [
		{ type: '_type', reference: sectionTypeId },
		{ type: '_parent', reference: collective._id },
		{ type: 'name', string: spec.name },
		{ type: 'voice', reference: voiceId },
		{ type: 'display_order', number: spec.display_order },
		{ type: '_sharing', string: 'public' },
	];

	const entity = await createEntity(client, props);
	console.log(`  [section] "${spec.name}" under "${collective.name}": CREATED (${entity._id})`);
	result.sections.created.push({ name: spec.name, collective: collective.name, _id: entity._id });
	return entity._id;
}

// ---------------------------------------------------------------------------
// Step 5: Seed member
// ---------------------------------------------------------------------------

async function seedMember(
	client: EntuClient,
	memberTypeId: string,
	orgId: string,
	sectionId: string,
	personId: string,
	personName: string,
	collectiveName: string,
	sectionName: string,
	dryRun: boolean,
	result: SeedResult
): Promise<void> {
	// In dry-run, personId/orgId may be '' (not yet created) — skip idempotency check.
	if (dryRun) {
		console.log(`  [member] "${personName}" in "${collectiveName}/${sectionName}": WOULD CREATE`);
		result.members.wouldCreate.push({ person: personName, collective: collectiveName, section: sectionName });
		return;
	}

	// Idempotency: check if a member with this person ref already exists under this org.
	const existing = await listEntities(client, {
		'_type.string': 'member',
		'person.reference': personId,
		'_parent.reference': orgId,
		props: '_id',
	});

	if (existing.count > 0) {
		const existingId = existing.entities[0]._id;
		console.log(`  [member] "${personName}" in "${collectiveName}/${sectionName}": EXISTS (${existingId}) — skip`);
		result.members.skipped.push({ person: personName, collective: collectiveName, section: sectionName, _id: existingId });
		return;
	}

	const entity = await createEntity(client, [
		{ type: '_type', reference: memberTypeId },
		{ type: '_parent', reference: orgId },
		{ type: '_parent', reference: sectionId },
		{ type: 'person', reference: personId },
		{ type: 'status', string: 'active' },
		{ type: '_sharing', string: 'private' },
	]);
	console.log(`  [member] "${personName}" in "${collectiveName}/${sectionName}": CREATED (${entity._id})`);
	result.members.created.push({ person: personName, collective: collectiveName, section: sectionName, _id: entity._id });
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

interface SeedResult {
	persons: {
		created: Array<{ name: string; _id: string }>;
		skipped: Array<{ name: string; _id: string }>;
		wouldCreate: Array<{ name: string }>;
		failed: Array<{ name: string; error: string }>;
	};
	orgs: {
		created: Array<{ name: string; _id: string; kind: string; founder: string }>;
		skipped: Array<{ name: string; _id: string; kind: string }>;
		wouldCreate: Array<{ name: string; kind: string; founder: string }>;
		failed: Array<{ name: string; error: string }>;
	};
	sections: {
		created: Array<{ name: string; collective: string; _id: string }>;
		skipped: Array<{ name: string; collective: string; _id: string }>;
		wouldCreate: Array<{ name: string; collective: string; voice: string }>;
		failed: Array<{ name: string; collective: string; error: string }>;
	};
	members: {
		created: Array<{ person: string; collective: string; section: string; _id: string }>;
		skipped: Array<{ person: string; collective: string; section: string; _id: string }>;
		wouldCreate: Array<{ person: string; collective: string; section: string }>;
		failed: Array<{ person: string; collective: string; section: string; error: string }>;
	};
}

function emptyResult(): SeedResult {
	return {
		persons: { created: [], skipped: [], wouldCreate: [], failed: [] },
		orgs: { created: [], skipped: [], wouldCreate: [], failed: [] },
		sections: { created: [], skipped: [], wouldCreate: [], failed: [] },
		members: { created: [], skipped: [], wouldCreate: [], failed: [] },
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log(`[seed-collectives] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${ENTU_DB}`);

	const jwt = await getJwt({ apiBase: ENTU_API_BASE, db: ENTU_DB, apiKey: ENTU_API_KEY! });
	const client: EntuClient = { apiBase: ENTU_API_BASE, db: ENTU_DB, jwt };

	const manifestPath = join(import.meta.dirname ?? '', 'seed-sources', 'collectives.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Manifest;

	// Resolve entity type IDs
	console.log('[seed-collectives] resolving type IDs...');
	const [personTypeId, orgTypeId, sectionTypeId, memberTypeId] = await Promise.all([
		resolveTypeId(client, 'person'),
		resolveTypeId(client, 'organization'),
		resolveTypeId(client, 'section'),
		resolveTypeId(client, 'member'),
	]);
	console.log(`[seed-collectives] types: person=${personTypeId} org=${orgTypeId} section=${sectionTypeId} member=${memberTypeId}`);

	// Collect all unique voice names needed
	const voiceNamesNeeded = new Set<string>();
	for (const c of manifest.collectives) {
		for (const s of c.sections) voiceNamesNeeded.add(s.voice);
	}
	const voiceMap = await buildVoiceMap(client, [...voiceNamesNeeded]);
	console.log(`[seed-collectives] voices resolved: ${[...voiceMap.keys()].join(', ')}`);

	// Collect all unique person names across all sections
	const allPersonNames = new Set<string>();
	for (const c of manifest.collectives) {
		for (const s of c.sections) {
			for (const p of s.persons) allPersonNames.add(p);
		}
	}
	// Also include founders from umbrellas and collectives (already in section person lists)

	const result = emptyResult();

	// -------------------------------------------------------------------------
	// Phase 1: Seed persons
	// -------------------------------------------------------------------------
	console.log(`\n[seed-collectives] Phase 1: seeding ${allPersonNames.size} persons...`);
	const personIdMap = new Map<string, string>(); // name → _id

	for (const personName of allPersonNames) {
		try {
			const id = await seedPerson(client, personTypeId, personName, DRY_RUN, result);
			if (id) personIdMap.set(personName, id);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  [person] "${personName}": FAILED — ${msg}`);
			result.persons.failed.push({ name: personName, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Phase 2: Seed umbrellas
	// -------------------------------------------------------------------------
	console.log(`\n[seed-collectives] Phase 2: seeding ${manifest.umbrellas.length} umbrellas...`);
	const umbrellaIdMap = new Map<string, string>(); // name → _id

	for (const umbrella of manifest.umbrellas) {
		const founderPersonId = personIdMap.get(umbrella.founder);
		if (!founderPersonId && !DRY_RUN) {
			console.error(`  [umbrella] "${umbrella.name}": SKIP — founder "${umbrella.founder}" has no person id (failed earlier?)`);
			result.orgs.failed.push({ name: umbrella.name, error: `founder person "${umbrella.founder}" not available` });
			continue;
		}
		try {
			const id = await seedOrg(client, orgTypeId, umbrella, founderPersonId ?? '', DRY_RUN, result, 'umbrella');
			if (id) umbrellaIdMap.set(umbrella.name, id);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  [umbrella] "${umbrella.name}": FAILED — ${msg}`);
			result.orgs.failed.push({ name: umbrella.name, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Phase 3: Seed collectives (founder parent + umbrella parent)
	// -------------------------------------------------------------------------
	console.log(`\n[seed-collectives] Phase 3: seeding ${manifest.collectives.length} collectives...`);
	const collectiveIdMap = new Map<string, string>(); // name → _id

	for (const collective of manifest.collectives) {
		const founderPersonId = personIdMap.get(collective.founder);
		if (!founderPersonId && !DRY_RUN) {
			console.error(`  [collective] "${collective.name}": SKIP — founder "${collective.founder}" has no person id`);
			result.orgs.failed.push({ name: collective.name, error: `founder person "${collective.founder}" not available` });
			continue;
		}
		try {
			const id = await seedOrg(client, orgTypeId, collective, founderPersonId ?? '', DRY_RUN, result, 'collective');
			if (id) {
				collectiveIdMap.set(collective.name, id);

				// Add umbrella parent as second POST (idempotent: check before adding)
				const umbrellaId = umbrellaIdMap.get(collective.umbrella);
				if (umbrellaId) {
					if (DRY_RUN) {
						console.log(`  [collective] "${collective.name}": WOULD CHECK umbrella parent "${collective.umbrella}" (skip add if already present)`);
					} else {
						// Fetch current parents; only add if not already present.
						const parentResp = await listEntities(client, {
							'_type.string': 'organization',
							'_id': id,
							props: '_parent',
						});
						const existingParentIds: string[] = [];
						const raw = parentResp.entities[0] as Record<string, unknown>;
						const parents = raw['_parent'];
						if (Array.isArray(parents)) {
							for (const p of parents as Array<{ reference?: string }>) {
								if (p.reference) existingParentIds.push(p.reference);
							}
						}
						if (existingParentIds.includes(umbrellaId)) {
							console.log(`  [collective] "${collective.name}": umbrella parent already present — skip`);
						} else {
							await addProperties(client, id, [{ type: '_parent', reference: umbrellaId }], false);
							console.log(`  [collective] "${collective.name}": umbrella parent "${collective.umbrella}" (${umbrellaId}) added`);
						}
					}
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  [collective] "${collective.name}": FAILED — ${msg}`);
			result.orgs.failed.push({ name: collective.name, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Phase 4: Seed sections
	// -------------------------------------------------------------------------
	const totalSections = manifest.collectives.reduce((n, c) => n + c.sections.length, 0);
	console.log(`\n[seed-collectives] Phase 4: seeding ${totalSections} sections...`);
	// section key = "collectiveName/sectionName" → _id
	const sectionIdMap = new Map<string, string>();

	for (const collective of manifest.collectives) {
		const collectiveId = collectiveIdMap.get(collective.name);
		if (!collectiveId && !DRY_RUN) {
			console.error(`  [section] skipping sections for "${collective.name}" — org not available`);
			continue;
		}
		for (const sectionSpec of collective.sections) {
			try {
				const id = await seedSection(
					client,
					sectionTypeId,
					{ name: collective.name, _id: collectiveId ?? '' },
					sectionSpec,
					voiceMap,
					DRY_RUN,
					result
				);
				if (id) sectionIdMap.set(`${collective.name}/${sectionSpec.name}`, id);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`  [section] "${sectionSpec.name}" under "${collective.name}": FAILED — ${msg}`);
				result.sections.failed.push({ name: sectionSpec.name, collective: collective.name, error: msg });
			}
		}
	}

	// -------------------------------------------------------------------------
	// Phase 5: Seed members
	// -------------------------------------------------------------------------
	const totalMembers = manifest.collectives.reduce(
		(n, c) => n + c.sections.reduce((m, s) => m + s.persons.length, 0),
		0
	);
	console.log(`\n[seed-collectives] Phase 5: seeding ${totalMembers} members...`);

	for (const collective of manifest.collectives) {
		const collectiveId = collectiveIdMap.get(collective.name);
		if (!collectiveId && !DRY_RUN) {
			console.error(`  [member] skipping members for "${collective.name}" — org not available`);
			continue;
		}
		for (const sectionSpec of collective.sections) {
			const sectionId = sectionIdMap.get(`${collective.name}/${sectionSpec.name}`);
			if (!sectionId && !DRY_RUN) {
				console.error(`  [member] skipping members for "${collective.name}/${sectionSpec.name}" — section not available`);
				continue;
			}
			for (const personName of sectionSpec.persons) {
				const personId = personIdMap.get(personName);
				if (!personId && !DRY_RUN) {
					console.error(`  [member] skipping "${personName}" — person not available`);
					result.members.failed.push({ person: personName, collective: collective.name, section: sectionSpec.name, error: 'person not available' });
					continue;
				}
				try {
					await seedMember(
						client,
						memberTypeId,
						collectiveId ?? '',
						sectionId ?? '',
						personId ?? '',
						personName,
						collective.name,
						sectionSpec.name,
						DRY_RUN,
						result
					);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`  [member] "${personName}" in "${collective.name}/${sectionSpec.name}": FAILED — ${msg}`);
					result.members.failed.push({ person: personName, collective: collective.name, section: sectionSpec.name, error: msg });
				}
			}
		}
	}

	// -------------------------------------------------------------------------
	// Summary + artifact
	// -------------------------------------------------------------------------
	const executedAt = new Date().toISOString();

	const totalFailed =
		result.persons.failed.length +
		result.orgs.failed.length +
		result.sections.failed.length +
		result.members.failed.length;

	console.log('\n[seed-collectives] ===== SUMMARY =====');
	if (DRY_RUN) {
		console.log(`persons  : ${result.persons.wouldCreate.length} would create, ${result.persons.skipped.length} already exist`);
		console.log(`orgs     : ${result.orgs.wouldCreate.length} would create, ${result.orgs.skipped.length} already exist`);
		console.log(`sections : ${result.sections.wouldCreate.length} would create, ${result.sections.skipped.length} already exist`);
		console.log(`members  : ${result.members.wouldCreate.length} would create, ${result.members.skipped.length} already exist`);
	} else {
		console.log(`persons  : ${result.persons.created.length} created, ${result.persons.skipped.length} skipped, ${result.persons.failed.length} failed`);
		console.log(`orgs     : ${result.orgs.created.length} created, ${result.orgs.skipped.length} skipped, ${result.orgs.failed.length} failed`);
		console.log(`sections : ${result.sections.created.length} created, ${result.sections.skipped.length} skipped, ${result.sections.failed.length} failed`);
		console.log(`members  : ${result.members.created.length} created, ${result.members.skipped.length} skipped, ${result.members.failed.length} failed`);
	}

	if (!DRY_RUN) {
		const artifact = {
			executedAt,
			db: ENTU_DB,
			dryRun: false,
			result,
		};
		const resultsDir = join(import.meta.dirname ?? '', 'seed-results');
		mkdirSync(resultsDir, { recursive: true });
		const fileName = `seed-collectives-${executedAt.replace(/[:.]/g, '-')}.json`;
		const filePath = join(resultsDir, fileName);
		writeFileSync(filePath, JSON.stringify(artifact, null, 2));
		console.log(`[seed-collectives] result artifact: ${filePath}`);
	}

	if (totalFailed > 0) {
		console.error(`[seed-collectives] ${totalFailed} failures — exit 1`);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('[seed-collectives] fatal:', err);
	process.exit(1);
});
