/**
 * Phase D cleanup — restore Test User name from probe leftover "probe-q4-person-2" → "Test User"
 *
 * Test User entity _id: 6a097dcc90c8df7a1cc7d6dd (from probe-phase-d-discovery)
 * The name "probe-q4-person-2" was left as a probe artefact during session 9 discovery work.
 * PO authorized: restore to "Test User".
 *
 * Strategy: GET current name values, DELETE all existing values, POST "Test User"
 * (POST appends — must clear first to avoid accumulation)
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-test-user-name-2026-05-21.ts [--dry-run]
 */

import {
	getJwt,
	fetchEntity,
	deletePropertyValue,
	postProperties,
	type EntuClient,
} from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? process.env.ENTU_DATABASE ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

const TEST_USER_ID = '6a097dcc90c8df7a1cc7d6dd';
const EXPECTED_STALE = 'probe-q4-person-2';
const TARGET_NAME = 'Test User';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

const DRY_RUN = isDryRun();
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

const entity = await fetchEntity(client, TEST_USER_ID);
const nameValues = (entity.name ?? []) as Array<{ _id?: string; string?: string }>;
console.log('Current name values:', JSON.stringify(nameValues));

const staleValues = nameValues.filter((v) => v._id);
const currentNames = nameValues.map((v) => v.string ?? '');

if (currentNames.includes(TARGET_NAME) && currentNames.every((n) => n === TARGET_NAME)) {
	console.log(`Already clean: name="${TARGET_NAME}". No action needed.`);
	await writeResultArtifact('cleanup-phase-d-test-user-name-2026-05-21', {
		testUserId: TEST_USER_ID,
		status: 'already_clean',
		currentNames,
	});
	process.exit(0);
}

console.log(`Stale values to delete: ${staleValues.length}`);
for (const v of staleValues) {
	if (!v._id) continue;
	console.log(`  DELETE /property/${v._id} (string="${v.string}")`);
	if (!DRY_RUN) {
		await deletePropertyValue(client, v._id);
	}
}

console.log(`POST name="${TARGET_NAME}"`);
if (!DRY_RUN) {
	await postProperties(client, TEST_USER_ID, [{ type: 'name', string: TARGET_NAME }]);
}

// Verify
let finalName: string | undefined;
if (!DRY_RUN) {
	const updated = await fetchEntity(client, TEST_USER_ID);
	const updatedNames = (updated.name ?? []) as Array<{ _id?: string; string?: string }>;
	console.log('After write:', JSON.stringify(updatedNames));
	if (updatedNames.length !== 1 || updatedNames[0].string !== TARGET_NAME) {
		console.error('VERIFY FAILED — unexpected state after write');
		process.exit(1);
	}
	finalName = updatedNames[0].string;
	console.log(`VERIFY OK: name="${finalName}"`);
}

const artifact = await writeResultArtifact('cleanup-phase-d-test-user-name-2026-05-21', {
	testUserId: TEST_USER_ID,
	staleNames: currentNames,
	staleValuesDeleted: staleValues.length,
	nameWritten: TARGET_NAME,
	verified: !DRY_RUN ? finalName === TARGET_NAME : 'dry-run',
	dryRun: DRY_RUN,
});
console.log(`Artifact: ${artifact}`);
console.log('Done.');
