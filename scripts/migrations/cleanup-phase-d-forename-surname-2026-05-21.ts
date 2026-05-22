/**
 * Phase D — Sub-ops 3+4: Delete forename/surname values + retire prop-defs
 *
 * Sub-op 3: DELETE forename + surname property VALUES from the 2 real persons
 *   - PO (69bcfd8e9c031ab8e6ce8079): forename _id=69bcfd8e9c031ab8e6ce8174, surname _id=69bcfd8e9c031ab8e6ce81d3
 *   - Test User (6a097dcc90c8df7a1cc7d6dd): forename + surname (live _ids fetched at runtime)
 *
 * Sub-op 4: DELETE the forename and surname prop-def entities
 *   - These are type-def entities; use DELETE /entity/{propDefId}
 *   - Prop-def _ids fetched at runtime by querying _type.reference=POLYPHONY_META_TYPE_PROPERTY_ID
 *     with name.string=forename / name.string=surname scoped to the person type
 *
 * Safety: verify no other person instances have forename/surname values before
 * retiring the prop-defs. If any remain, abort with a list.
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-forename-surname-2026-05-21.ts [--dry-run]
 *
 * Prerequisite: sub-op 2 (seed name backfill) must have completed. Both real persons
 * must have non-whitespace name already (verified by sub-op 1 formula materialization).
 */

import {
	getJwt,
	fetchEntity,
	deletePropertyValue,
	deleteEntity,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
} from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

// Real persons with forename/surname (from discovery probe)
const REAL_PERSONS = [
	{ _id: '69bcfd8e9c031ab8e6ce8079', label: 'PO' },
	{ _id: '6a097dcc90c8df7a1cc7d6dd', label: 'Test User' },
];

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

interface PersonEntity {
	_id: string;
	name?: Array<{ _id?: string; string?: string }>;
	forename?: Array<{ _id?: string; string?: string }>;
	surname?: Array<{ _id?: string; string?: string }>;
}

interface PropDefEntity {
	_id: string;
	name?: Array<{ _id?: string; string?: string }>;
	_parent?: Array<{ _id?: string; reference?: string }>;
}

async function rawGet(jwt: string, path: string): Promise<unknown> {
	const url = `${API_BASE}/${DB}/${path}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

async function main() {
	const dryRun = isDryRun();
	console.log('Phase D — Sub-ops 3+4: Delete forename/surname values + retire prop-defs');
	console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const result: {
		dryRun: boolean;
		runAt: string;
		subOp3: {
			persons: Array<{
				_id: string;
				label: string;
				name: string | null;
				forenameValueId: string | null;
				surnameValueId: string | null;
				forenameDeleted: boolean;
				surnameDeleted: boolean;
			}>;
		};
		subOp4: {
			forename: { propDefId: string | null; deleted: boolean };
			surname: { propDefId: string | null; deleted: boolean };
		};
		safeguardPassed: boolean;
		error: string | null;
	} = {
		dryRun,
		runAt: new Date().toISOString(),
		subOp3: { persons: [] },
		subOp4: {
			forename: { propDefId: null, deleted: false },
			surname: { propDefId: null, deleted: false },
		},
		safeguardPassed: false,
		error: null,
	};

	try {
		// ── Step 1: Find forename + surname prop-def _ids ─────────────────────────
		console.log('=== Step 1: Find forename + surname prop-def entities ===');

		// Query prop-defs by name — filter to person type by checking _parent
		// We know the person type has _id visible from any person instance's _type field
		// Get person type _id from an instance
		const personSample = (await rawGet(
			jwt,
			'entity/?_type.string=person&props=_id,_type&limit=1',
		)) as {
			entities?: Array<{ _id: string; _type?: Array<{ reference?: string }> }>;
		};
		const personTypeId = personSample.entities?.[0]?._type?.[0]?.reference;
		if (!personTypeId) throw new Error('Could not determine person type entity _id');
		console.log(`  person type _id: ${personTypeId}`);

		// Find forename prop-def: a property-type entity named "forename" with _parent=personTypeId
		const forenameDefsResp = (await rawGet(
			jwt,
			`entity/?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}&name.string=forename&props=_id,name,_parent&limit=50`,
		)) as { entities?: PropDefEntity[]; count?: number };

		const forenameDefs = (forenameDefsResp.entities ?? []).filter((e) =>
			(e._parent ?? []).some((p) => p.reference === personTypeId),
		);
		console.log(`  forename prop-defs under person type: ${forenameDefs.length}`);
		if (forenameDefs.length !== 1) {
			throw new Error(
				`Expected exactly 1 forename prop-def under person type, found ${forenameDefs.length}: ${JSON.stringify(forenameDefs.map((e) => e._id))}`,
			);
		}
		const forenameDefId = forenameDefs[0]._id;
		result.subOp4.forename.propDefId = forenameDefId;
		console.log(`  forename prop-def _id: ${forenameDefId}`);

		const surnameDefsResp = (await rawGet(
			jwt,
			`entity/?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}&name.string=surname&props=_id,name,_parent&limit=50`,
		)) as { entities?: PropDefEntity[]; count?: number };

		const surnameDefs = (surnameDefsResp.entities ?? []).filter((e) =>
			(e._parent ?? []).some((p) => p.reference === personTypeId),
		);
		console.log(`  surname prop-defs under person type: ${surnameDefs.length}`);
		if (surnameDefs.length !== 1) {
			throw new Error(
				`Expected exactly 1 surname prop-def under person type, found ${surnameDefs.length}: ${JSON.stringify(surnameDefs.map((e) => e._id))}`,
			);
		}
		const surnameDefId = surnameDefs[0]._id;
		result.subOp4.surname.propDefId = surnameDefId;
		console.log(`  surname prop-def _id: ${surnameDefId}`);

		// ── Step 2: Safeguard — verify only the 2 expected persons have forename/surname ──
		console.log('\n=== Step 2: Safeguard — scan all persons for forename/surname ===');
		const allPersonsResp = (await rawGet(
			jwt,
			'entity/?_type.string=person&props=_id,name,forename,surname&limit=500',
		)) as { entities?: PersonEntity[]; count?: number };

		const personsWithForename = (allPersonsResp.entities ?? []).filter(
			(p) => Array.isArray(p.forename) && p.forename.length > 0,
		);
		const personsWithSurname = (allPersonsResp.entities ?? []).filter(
			(p) => Array.isArray(p.surname) && p.surname.length > 0,
		);

		const expectedIds = new Set(REAL_PERSONS.map((p) => p._id));
		const unexpectedForename = personsWithForename.filter((p) => !expectedIds.has(p._id));
		const unexpectedSurname = personsWithSurname.filter((p) => !expectedIds.has(p._id));

		if (unexpectedForename.length > 0 || unexpectedSurname.length > 0) {
			console.log('  SAFEGUARD FAILED: unexpected persons with forename/surname:');
			for (const p of unexpectedForename) {
				console.log(
					`    forename: _id=${p._id} forename=${JSON.stringify(p.forename?.map((v) => v.string))}`,
				);
			}
			for (const p of unexpectedSurname) {
				console.log(
					`    surname:  _id=${p._id} surname=${JSON.stringify(p.surname?.map((v) => v.string))}`,
				);
			}
			throw new Error('Safeguard failed — unexpected forename/surname values found. Aborting.');
		}

		console.log(
			`  Persons with forename: ${personsWithForename.length} (expected: ${REAL_PERSONS.length})`,
		);
		console.log(
			`  Persons with surname: ${personsWithSurname.length} (expected: ${REAL_PERSONS.length})`,
		);
		console.log('  Safeguard PASSED — only expected persons have forename/surname');
		result.safeguardPassed = true;

		// ── Step 3 (Sub-op 3): Delete forename + surname values from real persons ─
		console.log('\n=== Step 3 (Sub-op 3): Delete forename/surname values from real persons ===');
		for (const person of REAL_PERSONS) {
			const entity = (await fetchEntity(client, person._id)) as PersonEntity;
			const currentName = entity.name?.[0]?.string ?? null;
			const forenameValues = entity.forename ?? [];
			const surnameValues = entity.surname ?? [];

			console.log(`\n  Person: ${person.label} (_id=${person._id})`);
			console.log(`    current name: "${currentName}"`);
			console.log(
				`    forename values: ${JSON.stringify(forenameValues.map((v) => ({ _id: v._id, string: v.string })))}`,
			);
			console.log(
				`    surname values: ${JSON.stringify(surnameValues.map((v) => ({ _id: v._id, string: v.string })))}`,
			);

			const personResult = {
				_id: person._id,
				label: person.label,
				name: currentName,
				forenameValueId: forenameValues[0]?._id ?? null,
				surnameValueId: surnameValues[0]?._id ?? null,
				forenameDeleted: false,
				surnameDeleted: false,
			};

			// Verify person has a real name before deleting forename/surname
			if (!currentName || !currentName.match(/\S/)) {
				throw new Error(
					`Safety: ${person.label} has no real name ("${currentName}") — cannot delete forename/surname`,
				);
			}

			if (dryRun) {
				for (const v of forenameValues) {
					console.log(`    [DRY-RUN] WOULD DELETE forename value _id=${v._id}`);
				}
				for (const v of surnameValues) {
					console.log(`    [DRY-RUN] WOULD DELETE surname value _id=${v._id}`);
				}
			} else {
				for (const v of forenameValues) {
					if (v._id) {
						await deletePropertyValue(client, v._id);
						console.log(`    DELETED forename value _id=${v._id}`);
						personResult.forenameDeleted = true;
					}
				}
				for (const v of surnameValues) {
					if (v._id) {
						await deletePropertyValue(client, v._id);
						console.log(`    DELETED surname value _id=${v._id}`);
						personResult.surnameDeleted = true;
					}
				}
			}

			result.subOp3.persons.push(personResult);
		}

		// ── Step 4 (Sub-op 4): Retire forename + surname prop-defs ───────────────
		console.log('\n=== Step 4 (Sub-op 4): Retire forename + surname prop-defs ===');

		// Re-verify all forename/surname values are gone before retiring prop-defs
		if (!dryRun) {
			const verifyResp = (await rawGet(
				jwt,
				'entity/?_type.string=person&props=_id,forename,surname&limit=500',
			)) as { entities?: PersonEntity[] };

			const remainingForename = (verifyResp.entities ?? []).filter(
				(p) => Array.isArray(p.forename) && p.forename.length > 0,
			);
			const remainingSurname = (verifyResp.entities ?? []).filter(
				(p) => Array.isArray(p.surname) && p.surname.length > 0,
			);

			if (remainingForename.length > 0 || remainingSurname.length > 0) {
				console.log('  WARNING: forename/surname values still present after sub-op 3:');
				for (const p of remainingForename) console.log(`    _id=${p._id} has forename`);
				for (const p of remainingSurname) console.log(`    _id=${p._id} has surname`);
				throw new Error('Cannot retire prop-defs while instance values remain.');
			}
			console.log('  Verified: no forename/surname instance values remain');
		}

		if (dryRun) {
			console.log(`  [DRY-RUN] WOULD DELETE entity (forename prop-def) _id=${forenameDefId}`);
			console.log(`  [DRY-RUN] WOULD DELETE entity (surname prop-def) _id=${surnameDefId}`);
		} else {
			await deleteEntity(client, forenameDefId);
			console.log(`  DELETED forename prop-def entity _id=${forenameDefId}`);
			result.subOp4.forename.deleted = true;

			await deleteEntity(client, surnameDefId);
			console.log(`  DELETED surname prop-def entity _id=${surnameDefId}`);
			result.subOp4.surname.deleted = true;
		}
	} catch (err) {
		result.error = String(err);
		console.error('\nERROR:', err);
	}

	// Write artifact
	const filePath = await writeResultArtifact('cleanup-phase-d-forename-surname', result);
	console.log(`\nArtifact: ${filePath}`);

	// Summary
	console.log('\n=== SUMMARY ===');
	if (dryRun) {
		console.log('DRY-RUN: WOULD:');
		for (const p of REAL_PERSONS) {
			console.log(`  DELETE forename + surname values from ${p.label} (${p._id})`);
		}
		console.log(`  DELETE forename prop-def entity (${result.subOp4.forename.propDefId})`);
		console.log(`  DELETE surname prop-def entity (${result.subOp4.surname.propDefId})`);
		console.log('No writes performed. Re-run without --dry-run to execute.');
	} else if (result.error) {
		console.log(`FAILED: ${result.error}`);
		process.exit(1);
	} else {
		console.log('Sub-op 3: forename/surname values deleted from real persons');
		console.log('Sub-op 4: forename + surname prop-def entities deleted');
		console.log('Phase D person cleanup complete.');
	}
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
