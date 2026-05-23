/**
 * Seed CHORE-60 librarian bundle data into the polyphony Entu DB.
 *
 * Creates: 1 library, 8 persons, 8 members, 13 works, 21 editions, 552 copies,
 * 4 overdue lending records. All entities child of EFK (Eesti Filharmoonia
 * Kammerkoor, the real-world EPCC).
 *
 * Source manifest: scripts/migrations/seed-sources/librarian-bundle.json
 *
 * Idempotent: check-then-create at every level. Safe to re-run.
 * Dry-run (default): pass --dry-run (or omit MVOX_SEED_LIVE=1) to preview.
 * Live:  MVOX_SEED_LIVE=1 pnpm exec tsx scripts/migrations/seed-librarian-bundle-data.ts
 * Teardown: --teardown flag deletes all seeded entities in reverse order.
 */

import {
	getJwt,
	listEntities,
	listInstancesByType,
	createEntity,
	deleteEntity,
	type EntuClient,
	type EntuProperty,
} from './lib/entu-client.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = isDryRun() && process.env.MVOX_SEED_LIVE !== '1';
const TEARDOWN = process.argv.includes('--teardown');
const ENTU_API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const ENTU_DB = process.env.ENTU_DB ?? 'polyphony';
const ENTU_API_KEY = process.env.ENTU_API_KEY;

if (!ENTU_API_KEY) {
	console.error('ERROR: ENTU_API_KEY is not set');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Type entity IDs (stable in polyphony)
// ---------------------------------------------------------------------------

const TYPE_IDS = {
	person: '69bcfd8e9c031ab8e6ce805f',
	organization: '69c7ea478489bfcb0e819e3d',
	section: '69c7ea498489bfcb0e819ea3',
	member: '69c7ea4a8489bfcb0e819edd',
	library: '6a0d2e8090c8df7a1cc7dd9d',
	work: '69c7ea4c8489bfcb0e819f3e',
	edition: '69c7ea4e8489bfcb0e819f9c',
	copy: '6a0d2e8190c8df7a1cc7ddb0',
	lending: '6a0d2e8190c8df7a1cc7dde8',
	voice: '69bcfd8e9c031ab8e6ce8034', // meta-type for entity-types; voices are instances
};

// The 5 seeded global voices (from seed-voices.ts)
const VOICE_IDS: Record<string, string> = {
	soprano: '6a0d6d8290c8df7a1cc7e120',
	alto: '6a0d6d8290c8df7a1cc7e10e',
	tenor: '6a0d6d8290c8df7a1cc7e126',
	bass: '6a0d6d8290c8df7a1cc7e11a',
};

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface LoanSpec {
	copy_number: number;
	member_id: string;
	assigned_at: string;
}

interface EditionSpec {
	id: string;
	name: string;
	edition_type: string;
	voicing: string;
	publisher: string;
	year: number;
	catalogue?: string;
	total: number;
	location?: string;
	limitless?: boolean;
	loans: LoanSpec[];
}

interface WorkSpec {
	id: string;
	composer: string;
	title: string;
	original_language: string;
	genre: string[];
	editions: EditionSpec[];
}

interface MemberSpec {
	id: string;
	name: string;
	voice: string;
}

interface Manifest {
	choir: { name: string; entu_id: string; library_name: string };
	voice_map: Record<string, string>;
	section_map: Record<string, string>;
	members: MemberSpec[];
	works: WorkSpec[];
}

// ---------------------------------------------------------------------------
// Result artifact types
// ---------------------------------------------------------------------------

interface EntityOp {
	action: 'SKIP' | 'CREATE' | 'WOULD_CREATE' | 'DELETE' | 'WOULD_DELETE';
	id?: string;
	label: string;
}

interface ResultPayload {
	run_at: string;
	dry_run: boolean;
	teardown: boolean;
	library: EntityOp;
	persons: EntityOp[];
	members: EntityOp[];
	works: EntityOp[];
	editions: EntityOp[];
	copies: { total: number; created: number; skipped: number };
	lendings: EntityOp[];
	errors: string[];
	summary: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helper: resolve existing entity by type + filter
// ---------------------------------------------------------------------------

async function findExisting(
	client: EntuClient,
	typeName: string,
	filters: Record<string, string>,
): Promise<string | null> {
	const query = { '_type.string': typeName, props: '_id', limit: '5', ...filters };
	const resp = await listEntities(client, query);
	if ((resp.entities ?? []).length > 0) return resp.entities[0]._id;
	return null;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function runTeardown(client: EntuClient, manifest: Manifest): Promise<ResultPayload> {
	const result: ResultPayload = {
		run_at: new Date().toISOString(),
		dry_run: DRY_RUN,
		teardown: true,
		library: { action: 'SKIP', label: 'library' },
		persons: [],
		members: [],
		works: [],
		editions: [],
		copies: { total: 0, created: 0, skipped: 0 },
		lendings: [],
		errors: [],
		summary: {},
	};

	const ekfId = manifest.choir.entu_id;
	console.log(`Teardown mode. DRY_RUN=${DRY_RUN}`);

	// Find library
	const libraryId = await findExisting(client, 'library', { '_parent.reference': ekfId });
	if (!libraryId) {
		console.log('  Library not found — nothing to tear down.');
		result.summary = {
			libraries: 0,
			lendings: 0,
			copies: 0,
			editions: 0,
			works: 0,
			members: 0,
			persons: 0,
		};
		return result;
	}
	console.log(`  Found library: ${libraryId}`);

	// Collect all entity IDs to delete
	const toDelete: { type: string; id: string; label: string }[] = [];

	// Lendings
	const lendResp = await listEntities(client, {
		'_type.string': 'lending',
		'_parent.reference': libraryId,
		props: '_id',
		limit: '1000',
	});
	for (const e of lendResp.entities ?? []) {
		toDelete.push({ type: 'lending', id: e._id, label: `lending ${e._id}` });
	}

	// Copies (children of editions which are children of works)
	const workResp = await listEntities(client, {
		'_type.string': 'work',
		'_parent.reference': libraryId,
		props: '_id',
		limit: '100',
	});
	for (const work of workResp.entities ?? []) {
		const edResp = await listEntities(client, {
			'_type.string': 'edition',
			'_parent.reference': work._id,
			props: '_id',
			limit: '100',
		});
		for (const ed of edResp.entities ?? []) {
			const copyResp = await listEntities(client, {
				'_type.string': 'copy',
				'_parent.reference': ed._id,
				props: '_id',
				limit: '1000',
			});
			for (const cp of copyResp.entities ?? []) {
				toDelete.push({ type: 'copy', id: cp._id, label: `copy ${cp._id}` });
			}
			toDelete.push({ type: 'edition', id: ed._id, label: `edition ${ed._id}` });
		}
		toDelete.push({ type: 'work', id: work._id, label: `work ${work._id}` });
	}

	// Library
	toDelete.push({ type: 'library', id: libraryId, label: `library ${libraryId}` });

	// Bundle persons/members (identified by name)
	for (const m of manifest.members) {
		const personId = await findExisting(client, 'person', { 'name.string': m.name });
		if (personId) {
			const memberId = await findExisting(client, 'member', {
				'_parent.reference': ekfId,
				'person.reference': personId,
			});
			if (memberId) toDelete.push({ type: 'member', id: memberId, label: `member ${m.name}` });
			toDelete.push({ type: 'person', id: personId, label: `person ${m.name}` });
		}
	}

	let deleted = 0;
	for (const item of toDelete) {
		console.log(`  ${DRY_RUN ? 'WOULD DELETE' : 'DELETE'} ${item.type}: ${item.label}`);
		if (!DRY_RUN) {
			try {
				await deleteEntity(client, item.id);
				deleted++;
			} catch (e) {
				const msg = `DELETE failed for ${item.label}: ${String(e)}`;
				console.error(`  ERROR: ${msg}`);
				result.errors.push(msg);
			}
		}
	}

	result.summary = {
		would_delete: DRY_RUN ? toDelete.length : 0,
		deleted: DRY_RUN ? 0 : deleted,
		errors: result.errors.length,
	};
	console.log(`Teardown complete. ${JSON.stringify(result.summary)}`);
	return result;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function runSeed(client: EntuClient, manifest: Manifest): Promise<ResultPayload> {
	const result: ResultPayload = {
		run_at: new Date().toISOString(),
		dry_run: DRY_RUN,
		teardown: false,
		library: { action: 'SKIP', label: 'library' },
		persons: [],
		members: [],
		works: [],
		editions: [],
		copies: { total: 0, created: 0, skipped: 0 },
		lendings: [],
		errors: [],
		summary: {},
	};

	const ekfId = manifest.choir.entu_id;
	console.log(`Seed mode. DRY_RUN=${DRY_RUN}. Target org: ${ekfId}`);

	// ------------------------------------------------------------------
	// Phase 1 — Library
	// ------------------------------------------------------------------

	let libraryId: string | null = await findExisting(client, 'library', {
		'_parent.reference': ekfId,
	});

	if (libraryId) {
		console.log(`  Library SKIP (exists): ${libraryId}`);
		result.library = { action: 'SKIP', id: libraryId, label: manifest.choir.library_name };
	} else {
		console.log(`  Library ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: ${manifest.choir.library_name}`);
		if (!DRY_RUN) {
			const r = await createEntity(client, [
				{ type: '_type', reference: TYPE_IDS.library },
				{ type: '_parent', reference: ekfId },
				{ type: '_sharing', string: 'private' },
				{ type: 'name', string: manifest.choir.library_name },
			]);
			libraryId = r._id;
			result.library = { action: 'CREATE', id: libraryId, label: manifest.choir.library_name };
			console.log(`    → created: ${libraryId}`);
		} else {
			result.library = { action: 'WOULD_CREATE', label: manifest.choir.library_name };
		}
	}

	// ------------------------------------------------------------------
	// Phase 2 — Resolve EFK sections
	// ------------------------------------------------------------------

	const sectionNameToId: Record<string, string> = {};
	const sectionResp = await listEntities(client, {
		'_type.string': 'section',
		'_parent.reference': ekfId,
		props: '_id,name',
		limit: '20',
	});
	for (const e of sectionResp.entities ?? []) {
		const nameVals = e.name as Array<{ string: string }> | undefined;
		if (nameVals && nameVals.length > 0) {
			sectionNameToId[nameVals[0].string] = e._id;
		}
	}
	console.log(
		`  Resolved ${Object.keys(sectionNameToId).length} EFK sections: ${Object.keys(sectionNameToId).join(', ')}`,
	);

	// ------------------------------------------------------------------
	// Phase 3 — Persons + Members
	// ------------------------------------------------------------------

	const memberBundleIdToMemberId: Record<string, string> = {};

	for (const m of manifest.members) {
		// Resolve or create person
		let personId = await findExisting(client, 'person', { 'name.string': m.name });

		if (personId) {
			console.log(`  Person SKIP (exists): ${m.name} → ${personId}`);
			result.persons.push({ action: 'SKIP', id: personId, label: m.name });
		} else {
			console.log(`  Person ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: ${m.name}`);
			if (!DRY_RUN) {
				const voiceName = manifest.voice_map[m.voice];
				const voiceId = VOICE_IDS[voiceName];
				const props: EntuProperty[] = [
					{ type: '_type', reference: TYPE_IDS.person },
					{ type: '_sharing', string: 'public' },
					{ type: 'name', string: m.name },
				];
				if (voiceId) props.push({ type: 'voice', reference: voiceId });
				const r = await createEntity(client, props);
				personId = r._id;
				result.persons.push({ action: 'CREATE', id: personId, label: m.name });
				console.log(`    → created: ${personId}`);
			} else {
				result.persons.push({ action: 'WOULD_CREATE', label: m.name });
			}
		}

		// Resolve or create member
		if (!personId) {
			// dry-run: can't check member without personId
			result.members.push({ action: 'WOULD_CREATE', label: `member for ${m.name}` });
			continue;
		}

		let memberId = await findExisting(client, 'member', {
			'_parent.reference': ekfId,
			'person.reference': personId,
		});

		if (memberId) {
			console.log(`  Member SKIP (exists): ${m.name} → ${memberId}`);
			result.members.push({ action: 'SKIP', id: memberId, label: `member for ${m.name}` });
		} else {
			console.log(`  Member ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: ${m.name}`);
			if (!DRY_RUN) {
				const sectionName = manifest.section_map[m.voice];
				const sectionId = sectionNameToId[sectionName];
				const props: EntuProperty[] = [
					{ type: '_type', reference: TYPE_IDS.member },
					{ type: '_parent', reference: ekfId },
					{ type: '_sharing', string: 'private' },
					{ type: 'person', reference: personId },
					{ type: 'status', string: 'active' },
				];
				if (sectionId) props.push({ type: '_parent', reference: sectionId });
				const r = await createEntity(client, props);
				memberId = r._id;
				result.members.push({ action: 'CREATE', id: memberId, label: `member for ${m.name}` });
				console.log(`    → created: ${memberId}`);
			} else {
				result.members.push({ action: 'WOULD_CREATE', label: `member for ${m.name}` });
			}
		}

		if (memberId) memberBundleIdToMemberId[m.id] = memberId;
	}

	// ------------------------------------------------------------------
	// Phase 4 — Works, Editions, Copies, Lendings
	// ------------------------------------------------------------------

	if (!libraryId && !DRY_RUN) {
		result.errors.push('Library ID missing after Phase 1 — cannot create works');
		return result;
	}

	// Map edition bundle ID → Entu copy entity IDs for this run
	// Key: `${editionBundleId}:${copyNumber}` → copyEntityId
	const copyIdMap: Record<string, string> = {};

	for (const work of manifest.works) {
		// -- Work --
		const workFilters: Record<string, string> = { 'name.string': work.title };
		if (libraryId) workFilters['_parent.reference'] = libraryId;

		let workId: string | null = libraryId ? await findExisting(client, 'work', workFilters) : null;

		if (workId) {
			console.log(`  Work SKIP: "${work.title}" → ${workId}`);
			result.works.push({ action: 'SKIP', id: workId, label: work.title });
		} else {
			console.log(`  Work ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: "${work.title}"`);
			if (!DRY_RUN && libraryId) {
				const props: EntuProperty[] = [
					{ type: '_type', reference: TYPE_IDS.work },
					{ type: '_parent', reference: libraryId },
					{ type: '_sharing', string: 'private' },
					{ type: 'name', string: work.title },
					{ type: 'composer', string: work.composer },
					{ type: 'original_language', string: work.original_language },
				];
				for (const g of work.genre) {
					props.push({ type: 'genre', string: g });
				}
				const r = await createEntity(client, props);
				workId = r._id;
				result.works.push({ action: 'CREATE', id: workId, label: work.title });
				console.log(`    → work created: ${workId}`);
			} else {
				result.works.push({ action: 'WOULD_CREATE', label: work.title });
			}
		}

		// -- Editions --
		for (const ed of work.editions) {
			const edFilters: Record<string, string> = { 'name.string': ed.name };
			if (workId) edFilters['_parent.reference'] = workId;

			let editionId: string | null = workId
				? await findExisting(client, 'edition', edFilters)
				: null;

			if (editionId) {
				console.log(`    Edition SKIP: "${ed.name}" → ${editionId}`);
				result.editions.push({
					action: 'SKIP',
					id: editionId,
					label: `${work.title} — ${ed.name}`,
				});
			} else {
				console.log(`    Edition ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: "${ed.name}"`);
				if (!DRY_RUN && workId) {
					const props: EntuProperty[] = [
						{ type: '_type', reference: TYPE_IDS.edition },
						{ type: '_parent', reference: workId },
						{ type: '_sharing', string: 'private' },
						{ type: 'name', string: ed.name },
						{ type: 'edition_type', string: ed.edition_type },
						{ type: 'voicing', string: ed.voicing },
						{ type: 'publisher', string: ed.publisher },
						{ type: 'year', number: ed.year },
					];
					if (ed.catalogue) {
						props.push({ type: 'license_note', string: `Catalogue: ${ed.catalogue}` });
					}
					if (ed.limitless) {
						props.push({
							type: 'license_note',
							string: 'Unlimited — no physical copies (digital/score)',
						});
					}
					const r = await createEntity(client, props);
					editionId = r._id;
					result.editions.push({
						action: 'CREATE',
						id: editionId,
						label: `${work.title} — ${ed.name}`,
					});
					console.log(`      → edition created: ${editionId}`);
				} else {
					result.editions.push({ action: 'WOULD_CREATE', label: `${work.title} — ${ed.name}` });
				}
			}

			// -- Copies --
			if (ed.total > 0) {
				for (let n = 1; n <= ed.total; n++) {
					result.copies.total++;
					const copyFilters: Record<string, string> = { 'copy_number.number': String(n) };
					if (editionId) copyFilters['_parent.reference'] = editionId;

					const existingCopyId = editionId ? await findExisting(client, 'copy', copyFilters) : null;

					if (existingCopyId) {
						result.copies.skipped++;
						copyIdMap[`${ed.id}:${n}`] = existingCopyId;
					} else {
						if (!DRY_RUN && editionId) {
							const locationNote = ed.location ? `Location: ${ed.location}` : undefined;
							const props: EntuProperty[] = [
								{ type: '_type', reference: TYPE_IDS.copy },
								{ type: '_parent', reference: editionId },
								{ type: '_sharing', string: 'private' },
								{ type: 'name', string: `Copy #${n}` },
								{ type: 'copy_number', number: n },
							];
							if (locationNote) props.push({ type: 'notes', string: locationNote });
							const r = await createEntity(client, props);
							copyIdMap[`${ed.id}:${n}`] = r._id;
							result.copies.created++;
						} else {
							result.copies.created++; // WOULD CREATE
						}
					}
				}
				if (!DRY_RUN) {
					console.log(
						`      Copies for "${ed.name}": ${ed.total} (created ${result.copies.created} so far, skipped ${result.copies.skipped})`,
					);
				} else {
					console.log(`      Copies WOULD CREATE: ${ed.total} for "${ed.name}"`);
				}
			}
		}
	}

	// ------------------------------------------------------------------
	// Phase 5 — Lendings (4 overdue Pärt Magnificat)
	// ------------------------------------------------------------------

	if (!libraryId && !DRY_RUN) {
		result.errors.push('Library ID missing — cannot create lending records');
		return result;
	}

	for (const work of manifest.works) {
		for (const ed of work.editions) {
			for (const loan of ed.loans) {
				const copyKey = `${ed.id}:${loan.copy_number}`;
				const copyId = copyIdMap[copyKey] ?? null;
				const memberId = memberBundleIdToMemberId[loan.member_id] ?? null;

				const label = `lending copy #${loan.copy_number} of "${ed.name}" → ${loan.member_id}`;

				if (!copyId || !memberId) {
					if (DRY_RUN) {
						console.log(`    Lending WOULD CREATE: ${label}`);
						result.lendings.push({ action: 'WOULD_CREATE', label });
					} else {
						const msg = `Cannot create lending — copyId=${copyId}, memberId=${memberId}`;
						console.error(`    ERROR: ${msg}`);
						result.errors.push(msg);
					}
					continue;
				}

				const existingLendingId = await findExisting(client, 'lending', {
					'_parent.reference': libraryId!,
					'copy.reference': copyId,
				});

				if (existingLendingId) {
					console.log(`    Lending SKIP: ${label} → ${existingLendingId}`);
					result.lendings.push({ action: 'SKIP', id: existingLendingId, label });
				} else {
					console.log(`    Lending ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}: ${label}`);
					if (!DRY_RUN && libraryId) {
						const r = await createEntity(client, [
							{ type: '_type', reference: TYPE_IDS.lending },
							{ type: '_parent', reference: libraryId },
							{ type: '_sharing', string: 'private' },
							{ type: 'copy', reference: copyId },
							{ type: 'member', reference: memberId },
							{ type: 'assigned_at', string: loan.assigned_at },
						]);
						result.lendings.push({ action: 'CREATE', id: r._id, label });
						console.log(`      → lending created: ${r._id}`);
					} else {
						result.lendings.push({ action: 'WOULD_CREATE', label });
					}
				}
			}
		}
	}

	// ------------------------------------------------------------------
	// Summary
	// ------------------------------------------------------------------

	const countOp = (ops: EntityOp[], action: string) =>
		ops.filter((o) => o.action === action || o.action === `WOULD_${action}`).length;

	result.summary = {
		library_created:
			result.library.action === 'CREATE' || result.library.action === 'WOULD_CREATE' ? 1 : 0,
		persons_created: countOp(result.persons, 'CREATE'),
		persons_skipped: countOp(result.persons, 'SKIP'),
		members_created: countOp(result.members, 'CREATE'),
		members_skipped: countOp(result.members, 'SKIP'),
		works_created: countOp(result.works, 'CREATE'),
		works_skipped: countOp(result.works, 'SKIP'),
		editions_created: countOp(result.editions, 'CREATE'),
		editions_skipped: countOp(result.editions, 'SKIP'),
		copies_created: result.copies.created,
		copies_skipped: result.copies.skipped,
		lendings_created: countOp(result.lendings, 'CREATE'),
		lendings_skipped: countOp(result.lendings, 'SKIP'),
		errors: result.errors.length,
	};

	console.log('\nSummary:', JSON.stringify(result.summary, null, 2));
	return result;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
	const manifestPath = join('scripts', 'migrations', 'seed-sources', 'librarian-bundle.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Manifest;

	const jwt = await getJwt({
		apiBase: ENTU_API_BASE,
		db: ENTU_DB,
		apiKey: ENTU_API_KEY!,
	});

	const client: EntuClient = { apiBase: ENTU_API_BASE, db: ENTU_DB, jwt };

	let result: ResultPayload;

	if (TEARDOWN) {
		result = await runTeardown(client, manifest);
	} else {
		result = await runSeed(client, manifest);
	}

	const slug = TEARDOWN
		? 'seed-librarian-bundle-teardown'
		: DRY_RUN
			? 'seed-librarian-bundle-dry-run'
			: 'seed-librarian-bundle-live';

	const artifactPath = await writeResultArtifact(slug, result);
	console.log(`\nResult artifact: ${artifactPath}`);

	if (result.errors.length > 0) {
		console.error(`\n${result.errors.length} errors — see artifact for details`);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
