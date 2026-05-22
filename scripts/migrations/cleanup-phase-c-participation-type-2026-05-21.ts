/**
 * Phase C.2 — cleanup-phase-c-participation-type
 *
 * Retires the `participation` type-def and all its prop-defs from polyphony.
 * Zero instances exist (confirmed by pre-flight probe eb3038f). No instance
 * data to migrate or preserve.
 *
 * IDs consumed from pre-flight artifact:
 *   probe-phase-c-preflight-2026-05-21T15-28-23-732.json
 *   typeDefIds.participation:  69c7ea588489bfcb0e81a137
 *   propDefs.participation:    5 prop-defs
 *
 * Run: DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-participation-type-2026-05-21.ts
 * Live: DRY_RUN=false pnpm exec tsx ...
 * Auth: live mode requires team-lead "I authorize this run" SendMessage (auth-gate).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt, listInstancesByType, deleteEntity, type EntuClient } from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

// IDs from pre-flight probe eb3038f
const TYPE_DEF_ID = '69c7ea588489bfcb0e81a137';
const PROP_DEFS = [
	{ _id: '69c7ea588489bfcb0e81a13e', name: 'name' },
	{ _id: '69c7ea588489bfcb0e81a14a', name: 'member' },
	{ _id: '69c7ea588489bfcb0e81a156', name: 'rsvp' },
	{ _id: '69c7ea588489bfcb0e81a163', name: 'attended' },
	{ _id: '69c7ea598489bfcb0e81a16d', name: 'noted_by' },
];

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

async function main() {
	console.log('Phase C.2 — cleanup-phase-c-participation-type');
	console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	const startedAt = new Date().toISOString();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const artifact: {
		phase: string;
		script: string;
		dryRun: boolean;
		startedAt: string;
		completedAt: string;
		initialInstances: number;
		propDefsResult: Array<{ id: string; name: string; outcome: string }>;
		typeDefResult: { id: string; outcome: string };
		exitCode: number;
		errors: string[];
	} = {
		phase: 'C.2',
		script: 'cleanup-phase-c-participation-type',
		dryRun: DRY_RUN,
		startedAt,
		completedAt: '',
		initialInstances: 0,
		propDefsResult: [],
		typeDefResult: { id: TYPE_DEF_ID, outcome: '' },
		exitCode: 0,
		errors: [],
	};

	try {
		// Pre-flight: verify 0 instances
		console.log('=== Pre-flight: instance count ===');
		const resp = await listInstancesByType(client, 'participation', '_id');
		const instances = (resp as { entities?: unknown[] }).entities ?? [];
		artifact.initialInstances = instances.length;
		console.log(`  participation instances: ${instances.length} (expected 0)`);
		if (instances.length > 0) {
			throw new Error(
				`HALT: expected 0 participation instances, found ${instances.length}. Investigate before proceeding.`,
			);
		}

		// Delete prop-defs
		console.log('\n=== Delete prop-defs ===');
		for (const pd of PROP_DEFS) {
			if (DRY_RUN) {
				console.log(`  [DRY-RUN] WOULD DELETE entity (prop-def) _id=${pd._id} name="${pd.name}"`);
				artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'would-delete' });
			} else {
				try {
					await deleteEntity(client, pd._id);
					console.log(`  DELETED prop-def "${pd.name}" _id=${pd._id}`);
					artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'deleted' });
				} catch (err) {
					const msg = String(err);
					console.error(`  FAILED to delete prop-def "${pd.name}" _id=${pd._id}: ${msg}`);
					artifact.propDefsResult.push({ id: pd._id, name: pd.name, outcome: 'failed' });
					artifact.errors.push(`prop-def ${pd._id} (${pd.name}): ${msg}`);
				}
			}
		}

		// Delete type-def
		console.log('\n=== Delete type-def ===');
		if (DRY_RUN) {
			console.log(`  [DRY-RUN] WOULD DELETE entity (type-def) _id=${TYPE_DEF_ID}`);
			artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'would-delete' };
		} else {
			try {
				await deleteEntity(client, TYPE_DEF_ID);
				console.log(`  DELETED type-def _id=${TYPE_DEF_ID}`);
				artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'deleted' };
			} catch (err) {
				const msg = String(err);
				console.error(`  FAILED to delete type-def _id=${TYPE_DEF_ID}: ${msg}`);
				artifact.typeDefResult = { id: TYPE_DEF_ID, outcome: 'failed' };
				artifact.errors.push(`type-def ${TYPE_DEF_ID}: ${msg}`);
			}
		}
	} catch (err) {
		const msg = String(err);
		console.error('\nERROR:', msg);
		artifact.errors.push(msg);
		artifact.exitCode = 1;
	}

	artifact.completedAt = new Date().toISOString();
	if (artifact.errors.length > 0 && artifact.exitCode === 0) artifact.exitCode = 1;

	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const dir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `cleanup-phase-c-participation-type-${ts}.json`);
	writeFileSync(path, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${path}`);

	console.log('\n=== SUMMARY ===');
	console.log(`initialInstances: ${artifact.initialInstances}`);
	console.log(`propDefs: ${artifact.propDefsResult.map((r) => r.outcome).join(', ')}`);
	console.log(`typeDef: ${artifact.typeDefResult.outcome}`);
	console.log(`errors: ${artifact.errors.length}`);

	if (artifact.exitCode !== 0) process.exit(1);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
