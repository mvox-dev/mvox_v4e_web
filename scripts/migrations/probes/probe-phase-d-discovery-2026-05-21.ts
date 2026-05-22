/**
 * Phase D discovery probe — read-only
 * Maps current live state before any Phase D mutations.
 *
 * Questions answered:
 * 1. Total person instance count
 * 2. Persons with forename set (count + list)
 * 3. Persons with surname set (count)
 * 4. Persons with name already set (count) — expect ~120 seed persons
 * 5. Persons with only one of forename/surname (edge case)
 * 6. Persons with NEITHER forename nor surname AND no name (edge case — expect 0)
 * 7. _inheritrights value on each of the 6 organization instances (by name + ID)
 * 8. All _DEPRECATED_* entity types on the polyphony db (name + ID)
 * 9. Instance count for each _DEPRECATED_* type
 *
 * Authorization: read-only. No writes.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt, listInstancesByType, POLYPHONY_META_TYPE_ENTITY_ID } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

async function rawGet(jwt: string, path: string): Promise<unknown> {
	const url = `${API_BASE}/${DB}/${path}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

interface PersonEntity {
	_id: string;
	forename?: Array<{ _id?: string; string?: string }>;
	surname?: Array<{ _id?: string; string?: string }>;
	name?: Array<{ _id?: string; string?: string }>;
}

interface OrgEntity {
	_id: string;
	name?: Array<{ _id?: string; string?: string }>;
	_inheritrights?: Array<{ _id?: string; boolean?: boolean }>;
}

interface TypeEntity {
	_id: string;
	name?: Array<{ _id?: string; string?: string }>;
}

async function main() {
	console.log('Phase D discovery probe — read-only');
	console.log(`DB: ${DB}`);
	console.log(`Time: ${new Date().toISOString()}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

	// ── 1–6: Person analysis ────────────────────────────────────────────────────
	console.log('=== PERSONS ===');
	const personResp = (await rawGet(
		jwt,
		'entity/?_type.string=person&props=_id,forename,surname,name&limit=500',
	)) as { entities?: PersonEntity[]; count?: number };

	const persons = personResp.entities ?? [];
	const totalPersons = personResp.count ?? 0;
	console.log(`1. Total person instances: ${totalPersons}`);

	const withForename = persons.filter((p) => Array.isArray(p.forename) && p.forename.length > 0);
	const withSurname = persons.filter((p) => Array.isArray(p.surname) && p.surname.length > 0);
	const withName = persons.filter(
		(p) => Array.isArray(p.name) && p.name.length > 0 && (p.name[0].string ?? '').match(/\S/),
	);
	const forenameOnly = persons.filter(
		(p) =>
			Array.isArray(p.forename) &&
			p.forename.length > 0 &&
			!(Array.isArray(p.surname) && p.surname.length > 0),
	);
	const surnameOnly = persons.filter(
		(p) =>
			Array.isArray(p.surname) &&
			p.surname.length > 0 &&
			!(Array.isArray(p.forename) && p.forename.length > 0),
	);
	const neitherNoName = persons.filter(
		(p) =>
			!(Array.isArray(p.forename) && p.forename.length > 0) &&
			!(Array.isArray(p.surname) && p.surname.length > 0) &&
			!(Array.isArray(p.name) && p.name.length > 0 && (p.name[0].string ?? '').match(/\S/)),
	);

	console.log(`2. Persons with forename set: ${withForename.length}`);
	console.log(`3. Persons with surname set: ${withSurname.length}`);
	console.log(`4. Persons with name (non-whitespace) already set: ${withName.length}`);
	console.log(`5a. Persons with forename ONLY (no surname): ${forenameOnly.length}`);
	console.log(`5b. Persons with surname ONLY (no forename): ${surnameOnly.length}`);
	console.log(`6. Persons with NEITHER forename/surname NOR name: ${neitherNoName.length}`);

	if (forenameOnly.length > 0) {
		console.log('   [EDGE CASE] forename-only persons:');
		for (const p of forenameOnly) {
			console.log(
				`     _id=${p._id} forename="${p.forename?.[0]?.string}" name="${p.name?.[0]?.string ?? '(none)'}"`,
			);
		}
	}
	if (surnameOnly.length > 0) {
		console.log('   [EDGE CASE] surname-only persons:');
		for (const p of surnameOnly) {
			console.log(
				`     _id=${p._id} surname="${p.surname?.[0]?.string}" name="${p.name?.[0]?.string ?? '(none)'}"`,
			);
		}
	}
	if (neitherNoName.length > 0) {
		console.log('   [EDGE CASE] persons with neither forename/surname nor name:');
		for (const p of neitherNoName) {
			console.log(`     _id=${p._id}`);
		}
	}

	// Collect backfill targets: have forename+surname but no (non-whitespace) name
	const backfillTargets = persons.filter(
		(p) =>
			Array.isArray(p.forename) &&
			p.forename.length > 0 &&
			Array.isArray(p.surname) &&
			p.surname.length > 0 &&
			!(Array.isArray(p.name) && p.name.length > 0 && (p.name[0].string ?? '').match(/\S/)),
	);
	console.log(`\n   Backfill targets (have forename+surname, no name): ${backfillTargets.length}`);

	// Persons with both forename+surname AND name already set (skip backfill, still delete forename/surname)
	const hasAllThree = persons.filter(
		(p) =>
			Array.isArray(p.forename) &&
			p.forename.length > 0 &&
			Array.isArray(p.surname) &&
			p.surname.length > 0 &&
			Array.isArray(p.name) &&
			p.name.length > 0 &&
			(p.name[0].string ?? '').match(/\S/),
	);
	console.log(
		`   Have forename+surname AND name (skip backfill, still delete forename/surname): ${hasAllThree.length}`,
	);

	// Total persons needing forename/surname deletion (any that have at least one)
	const needForenameSurnameDelete = persons.filter(
		(p) =>
			(Array.isArray(p.forename) && p.forename.length > 0) ||
			(Array.isArray(p.surname) && p.surname.length > 0),
	);
	const totalForenameValues = withForename.reduce((sum, p) => sum + (p.forename?.length ?? 0), 0);
	const totalSurnameValues = withSurname.reduce((sum, p) => sum + (p.surname?.length ?? 0), 0);
	console.log(`   Persons needing forename/surname deletion: ${needForenameSurnameDelete.length}`);
	console.log(`   Total forename property values to delete: ${totalForenameValues}`);
	console.log(`   Total surname property values to delete: ${totalSurnameValues}`);

	// ── 7: Organization _inheritrights ─────────────────────────────────────────
	console.log('\n=== ORGANIZATION _inheritrights ===');
	const orgResp = (await rawGet(
		jwt,
		'entity/?_type.string=organization&props=_id,name,_inheritrights&limit=500',
	)) as { entities?: OrgEntity[]; count?: number };

	const orgs = orgResp.entities ?? [];
	console.log(`7. Organization instances: ${orgResp.count ?? 0}`);
	for (const org of orgs) {
		const orgName = org.name?.[0]?.string ?? '(unnamed)';
		const inheritRightsArr = org._inheritrights ?? [];
		const inheritRightsVal = inheritRightsArr.length > 0 ? inheritRightsArr[0].boolean : undefined;
		const current =
			inheritRightsVal === undefined ? '(not set — inherits by default)' : String(inheritRightsVal);
		const needsFlip = inheritRightsVal !== false;
		console.log(
			`   _id=${org._id}  name="${orgName}"  _inheritrights=${current}  ${needsFlip ? '[NEEDS FLIP TO FALSE]' : '[already false — OK]'}`,
		);
	}

	// ── 8–9: _DEPRECATED_* entity types ────────────────────────────────────────
	console.log('\n=== _DEPRECATED_* ENTITY TYPES ===');
	const allTypesResp = (await rawGet(
		jwt,
		`entity/?_type.reference=${POLYPHONY_META_TYPE_ENTITY_ID}&props=_id,name&limit=500`,
	)) as { entities?: TypeEntity[]; count?: number };

	const allTypes = allTypesResp.entities ?? [];
	const deprecatedTypes = allTypes.filter((t) =>
		(t.name?.[0]?.string ?? '').startsWith('_DEPRECATED_'),
	);

	console.log(`8. Total entity types on db: ${allTypesResp.count ?? 0}`);
	console.log(`   _DEPRECATED_* types found: ${deprecatedTypes.length}`);

	const deprecatedResults: Array<{ _id: string; name: string; instanceCount: number }> = [];

	for (const dt of deprecatedTypes) {
		const typeName = dt.name?.[0]?.string ?? '(unnamed)';
		// Query instances of this deprecated type by its _id reference
		const instanceResp = (await rawGet(
			jwt,
			`entity/?_type.reference=${dt._id}&props=_id&limit=1`,
		)) as { entities?: Array<{ _id: string }>; count?: number };
		const instanceCount = instanceResp.count ?? 0;
		deprecatedResults.push({ _id: dt._id, name: typeName, instanceCount });
		const safeToDelete =
			instanceCount === 0 ? '[SAFE TO DELETE]' : `[BLOCKED: ${instanceCount} instances remain]`;
		console.log(`9. type "${typeName}" _id=${dt._id}  instances=${instanceCount}  ${safeToDelete}`);
	}

	// ── Summary ─────────────────────────────────────────────────────────────────
	const summary = {
		probeDate: new Date().toISOString(),
		persons: {
			total: totalPersons,
			withForename: withForename.length,
			withSurname: withSurname.length,
			withNameAlreadySet: withName.length,
			forenameOnly: forenameOnly.length,
			surnameOnly: surnameOnly.length,
			neitherNoName: neitherNoName.length,
			backfillTargets: backfillTargets.length,
			hasAllThree: hasAllThree.length,
			totalForenameValues,
			totalSurnameValues,
			backfillTargetIds: backfillTargets.map((p) => ({
				_id: p._id,
				forename: p.forename?.[0]?.string,
				surname: p.surname?.[0]?.string,
				forenameValueId: p.forename?.[0]?._id,
				surnameValueId: p.surname?.[0]?._id,
			})),
		},
		organizations: orgs.map((org) => ({
			_id: org._id,
			name: org.name?.[0]?.string ?? '(unnamed)',
			_inheritrights: org._inheritrights?.[0]?.boolean ?? null,
			_inheritrightsValueId: org._inheritrights?.[0]?._id ?? null,
			needsFlip: (org._inheritrights?.[0]?.boolean ?? null) !== false,
		})),
		deprecatedTypes: deprecatedResults,
	};

	console.log('\n=== SUMMARY ===');
	console.log(`Persons total: ${totalPersons}`);
	console.log(`  → backfill name from forename+surname: ${backfillTargets.length}`);
	console.log(
		`  → delete forename values: ${totalForenameValues} across ${withForename.length} persons`,
	);
	console.log(
		`  → delete surname values: ${totalSurnameValues} across ${withSurname.length} persons`,
	);
	console.log(
		`  → edge cases: forenameOnly=${forenameOnly.length}, surnameOnly=${surnameOnly.length}, neitherNoName=${neitherNoName.length}`,
	);
	const orgsNeedingFlip = summary.organizations.filter((o) => o.needsFlip);
	console.log(`Orgs needing _inheritrights=false flip: ${orgsNeedingFlip.length} / ${orgs.length}`);
	const deprecatedSafeToDelete = deprecatedResults.filter((d) => d.instanceCount === 0);
	const deprecatedBlocked = deprecatedResults.filter((d) => d.instanceCount > 0);
	console.log(
		`_DEPRECATED_* types: ${deprecatedResults.length} total, ${deprecatedSafeToDelete.length} safe to delete, ${deprecatedBlocked.length} blocked`,
	);

	// Write result artifact
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const dir = join('scripts', 'migrations', 'seed-results');
	mkdirSync(dir, { recursive: true });
	const filePath = join(dir, `probe-phase-d-discovery-${ts}.json`);
	writeFileSync(filePath, JSON.stringify(summary, null, 2));
	console.log(`\nArtifact written: ${filePath}`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
