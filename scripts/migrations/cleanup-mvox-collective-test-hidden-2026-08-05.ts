/**
 * cleanup-mvox-collective-test-hidden-2026-08-05.ts
 *
 * Removes the throwaway `test_hidden` experiment created by
 * probe-mvox-collective-unshared-prop-2026-08-05.ts (bucket-model live
 * confirmation, PO-directed, 2026-08-05). Leaves the real `mvox_collective`
 * marker (type, `name` prop-def, singleton instance) untouched.
 *
 * Reverse creation order: instance value first, then the prop-def entity.
 * Idempotent: each step checks existence first, so re-running after a
 * manual/partial cleanup is safe.
 *
 * Confirms afterward that the marker still reads clean:
 *   GET /polyphony/entity?_type.string=mvox_collective&props=name&limit=1
 *   → expect count=1, name="Eesti Filharmoonia Kammerkoor"
 *
 * Usage:
 *   pnpm exec tsx scripts/migrations/cleanup-mvox-collective-test-hidden-2026-08-05.ts --dry-run
 *   pnpm exec tsx scripts/migrations/cleanup-mvox-collective-test-hidden-2026-08-05.ts --live
 *
 * (*MVOX:Perotin*)
 */

import {
	getJwt,
	fetchEntity,
	deletePropertyValue,
	deleteEntity,
	listEntities,
	type EntuClient,
} from './lib/entu-client.ts';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.ts';

const DRY_RUN = isDryRun();
const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

const INSTANCE_ID = '6a73880436c951d9114ec650';
const TEST_VALUE_PROP_ID = '6a738c2336c951d9114ec661';
const TEST_PROPDEF_ID = '6a738c2336c951d9114ec657';
const TYPE_NAME = 'mvox_collective';
const EXPECTED_NAME = 'Eesti Filharmoonia Kammerkoor';

if (!API_KEY) {
	console.error('[cleanup-mvox-collective-test-hidden] ERROR: ENTU_API_KEY not set');
	process.exit(1);
}

async function main() {
	console.log(`[cleanup-mvox-collective-test-hidden] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${DB}`);
	const startedAt = new Date();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const result: Record<string, unknown> = { dryRun: DRY_RUN, startedAt: startedAt.toISOString() };

	// Step 1: instance value
	console.log(`[step 1] test_hidden value on instance...`);
	const instance = await fetchEntity(client, INSTANCE_ID);
	const stillHasValue = Boolean(
		(instance.test_hidden as Array<{ _id: string }> | undefined)?.some(
			(v) => v._id === TEST_VALUE_PROP_ID,
		),
	);
	if (!stillHasValue) {
		console.log(`  already absent — skip`);
		result.instanceValueCleanup = 'already_absent';
	} else if (DRY_RUN) {
		console.log(`  WOULD DELETE ${TEST_VALUE_PROP_ID}`);
		result.instanceValueCleanup = 'would_delete';
	} else {
		await deletePropertyValue(client, TEST_VALUE_PROP_ID);
		console.log(`  DELETED ${TEST_VALUE_PROP_ID}`);
		result.instanceValueCleanup = 'deleted';
	}

	// Step 2: prop-def entity
	console.log(`[step 2] test_hidden prop-def...`);
	let propDefExists = true;
	try {
		await fetchEntity(client, TEST_PROPDEF_ID);
	} catch {
		propDefExists = false;
	}
	if (!propDefExists) {
		console.log(`  already absent (404) — skip`);
		result.propDefCleanup = 'already_absent';
	} else if (DRY_RUN) {
		console.log(`  WOULD DELETE ${TEST_PROPDEF_ID}`);
		result.propDefCleanup = 'would_delete';
	} else {
		await deleteEntity(client, TEST_PROPDEF_ID);
		console.log(`  DELETED ${TEST_PROPDEF_ID}`);
		result.propDefCleanup = 'deleted';
	}

	// Step 3: confirm the real marker still reads clean
	console.log(`[step 3] confirm marker still reads clean...`);
	if (DRY_RUN) {
		console.log(`  (skipped in dry-run)`);
		result.markerVerification = 'skipped_dry_run';
	} else {
		const resp = await listEntities(client, {
			'_type.string': TYPE_NAME,
			props: 'name',
			limit: '1',
		});
		const name = (resp.entities[0]?.name as Array<{ string?: string }> | undefined)?.[0]?.string ?? null;
		const pass = resp.count === 1 && name === EXPECTED_NAME;
		result.markerVerification = { count: resp.count, name, expected: EXPECTED_NAME, pass };
		console.log(`  count=${resp.count} name=${JSON.stringify(name)} — ${pass ? 'PASS' : 'FAIL'}`);
	}

	result.completedAt = new Date().toISOString();
	const artifactPath = await writeResultArtifact('cleanup-mvox-collective-test-hidden', result, {
		at: startedAt,
	});
	console.log(`[cleanup-mvox-collective-test-hidden] artifact: ${artifactPath}`);
	console.log(`[cleanup-mvox-collective-test-hidden] done.`);
}

main().catch((err) => {
	console.error('[cleanup-mvox-collective-test-hidden] FATAL:', err);
	process.exit(1);
});
