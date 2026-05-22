/**
 * Phase D — YELLOW-D4: Set _inheritrights=false on organization TYPE entity
 *
 * Sub-op 5 flipped _inheritrights=false on all 6 org INSTANCES. The organization
 * TYPE entity still has _inheritrights=true, so new org instances born after that
 * fix would inherit true and require a manual flip.
 *
 * This script aligns the TYPE-level default with v4E schema.ts (organization
 * _inheritrights: false already declared). No Schema-Change trailer needed.
 *
 * Organization TYPE entity _id: 69c7ea478489bfcb0e819e3d
 * (confirmed by probe-phase-d-rights-audit-2026-05-21)
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-org-type-default-2026-05-21.ts [--dry-run]
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

const ORG_TYPE_ID = '69c7ea478489bfcb0e819e3d';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

const DRY_RUN = isDryRun();
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

// Read current state
const typeEntity = await fetchEntity(client, ORG_TYPE_ID);
const irValues = (typeEntity['_inheritrights'] ?? []) as Array<{ _id?: string; boolean?: boolean }>;
console.log(`Current _inheritrights values: ${JSON.stringify(irValues)}`);

// Idempotency check
const alreadyFalse = irValues.length === 1 && irValues[0].boolean === false;
if (alreadyFalse) {
	console.log('Already correct: _inheritrights=false on org type. No action needed.');
	await writeResultArtifact('cleanup-phase-d-org-type-default-2026-05-21', {
		orgTypeId: ORG_TYPE_ID,
		status: 'already_correct',
		irValues,
		dryRun: DRY_RUN,
	});
	process.exit(0);
}

// Delete all existing _inheritrights values
const toDelete = irValues.filter((v) => v._id);
console.log(`Values to delete: ${toDelete.length}`);
for (const v of toDelete) {
	if (!v._id) continue;
	console.log(`  DELETE /property/${v._id} (boolean=${v.boolean})`);
	if (!DRY_RUN) {
		await deletePropertyValue(client, v._id);
	}
}

// POST false
console.log('POST _inheritrights=false');
if (!DRY_RUN) {
	await postProperties(client, ORG_TYPE_ID, [{ type: '_inheritrights', boolean: false }]);
}

// Verify
let finalValue: boolean | null = null;
if (!DRY_RUN) {
	const updated = await fetchEntity(client, ORG_TYPE_ID);
	const updatedIr = (updated['_inheritrights'] ?? []) as Array<{ _id?: string; boolean?: boolean }>;
	console.log(`After write: ${JSON.stringify(updatedIr)}`);
	if (updatedIr.length !== 1 || updatedIr[0].boolean !== false) {
		console.error('VERIFY FAILED — unexpected state after write');
		process.exit(1);
	}
	finalValue = updatedIr[0].boolean ?? null;
	console.log(`VERIFY OK: _inheritrights=${finalValue}`);
}

const artifact = await writeResultArtifact('cleanup-phase-d-org-type-default-2026-05-21', {
	orgTypeId: ORG_TYPE_ID,
	previousValues: irValues,
	deletedCount: toDelete.length,
	valueWritten: DRY_RUN ? false : true,
	verified: DRY_RUN ? 'dry-run' : finalValue === false,
	dryRun: DRY_RUN,
});
console.log(`Artifact: ${artifact}`);
console.log('Done.');
