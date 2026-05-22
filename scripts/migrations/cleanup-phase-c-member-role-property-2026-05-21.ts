/**
 * Phase C.4 — cleanup-phase-c-member-role-property
 *
 * Deletes the 8 `role` property-values from the PO's 4 member entities,
 * then retires the `role` prop-def on the `member` type.
 *
 * Wire shape: property-value DELETE → DELETE /property/{value-id}
 * (NOT DELETE /entity — these are property-value _ids, not entity _ids).
 * Per architecture-decisions "Entu mutation-op wire shapes".
 *
 * IDs consumed from pre-flight artifact:
 *   probe-phase-c-preflight-2026-05-21T15-28-23-732.json
 *   memberRoleValues: 4 members × 2 values = 8 total
 *   memberRolePropDef._id: 69c7ea4b8489bfcb0e819f11
 *
 * Must precede C.5 in live execution.
 *
 * Run: DRY_RUN=true pnpm exec tsx scripts/migrations/cleanup-phase-c-member-role-property-2026-05-21.ts
 * Live: DRY_RUN=false pnpm exec tsx ...
 * Auth: live mode requires team-lead "I authorize this run" SendMessage (auth-gate).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	getJwt,
	fetchEntity,
	deletePropertyValue,
	deleteEntity,
	type EntuClient,
} from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

// IDs from pre-flight probe eb3038f
const MEMBER_ROLE_VALUES: Record<
	string,
	Array<{ _id: string; reference: string; displayName: string }>
> = {
	'69c7f8728489bfcb0e81b085': [
		{
			_id: '69c7f8728489bfcb0e81b08b',
			reference: '69c7f8708489bfcb0e81b020',
			displayName: 'Owner',
		},
		{
			_id: '69c7f8728489bfcb0e81b08c',
			reference: '69c7f8708489bfcb0e81b02e',
			displayName: 'Admin',
		},
	],
	'69c7f8788489bfcb0e81b1c9': [
		{
			_id: '69c7f8788489bfcb0e81b1cf',
			reference: '69c7f8708489bfcb0e81b020',
			displayName: 'Owner',
		},
		{
			_id: '69c7f8788489bfcb0e81b1d0',
			reference: '69c7f8708489bfcb0e81b02e',
			displayName: 'Admin',
		},
	],
	'69c7f87e8489bfcb0e81b304': [
		{
			_id: '69c7f87e8489bfcb0e81b30a',
			reference: '69c7f8708489bfcb0e81b020',
			displayName: 'Owner',
		},
		{
			_id: '69c7f87e8489bfcb0e81b30b',
			reference: '69c7f8708489bfcb0e81b02e',
			displayName: 'Admin',
		},
	],
	'69c7f8878489bfcb0e81b510': [
		{
			_id: '69c7f8878489bfcb0e81b516',
			reference: '69c7f8708489bfcb0e81b020',
			displayName: 'Owner',
		},
		{
			_id: '69c7f8878489bfcb0e81b517',
			reference: '69c7f8708489bfcb0e81b02e',
			displayName: 'Admin',
		},
	],
};
const ROLE_PROP_DEF_ID = '69c7ea4b8489bfcb0e819f11';
const EXPECTED_VALUE_COUNT = 8;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

async function main() {
	console.log('Phase C.4 — cleanup-phase-c-member-role-property');
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
		initialValueCount: number;
		preservation: Array<{
			memberId: string;
			roleValues: Array<{ _id: string; reference: string; displayName: string }>;
		}>;
		valueDeletions: Array<{
			memberId: string;
			valueId: string;
			displayName: string;
			outcome: string;
		}>;
		postDeleteVerified: boolean | null;
		propDefResult: { id: string; name: string; outcome: string };
		exitCode: number;
		errors: string[];
	} = {
		phase: 'C.4',
		script: 'cleanup-phase-c-member-role-property',
		dryRun: DRY_RUN,
		startedAt,
		completedAt: '',
		initialValueCount: 0,
		preservation: [],
		valueDeletions: [],
		postDeleteVerified: null,
		propDefResult: { id: ROLE_PROP_DEF_ID, name: 'role', outcome: '' },
		exitCode: 0,
		errors: [],
	};

	try {
		// Pre-flight: verify total value count from preflight
		console.log('=== Pre-flight: verify role value count ===');
		let liveValueCount = 0;
		for (const [memberId, values] of Object.entries(MEMBER_ROLE_VALUES)) {
			// Fetch live to confirm values still exist (not double-counting)
			const entity = (await fetchEntity(client, memberId)) as {
				role?: Array<{ _id?: string; string?: string }>;
			};
			const liveVals = (entity.role ?? []).filter((v) => v._id);
			liveValueCount += liveVals.length;
			console.log(
				`  member ${memberId}: ${liveVals.length} live role values (preflight: ${values.length})`,
			);
			if (liveVals.length !== values.length) {
				throw new Error(
					`HALT: member ${memberId} has ${liveVals.length} role values live, preflight expected ${values.length}. Drift detected.`,
				);
			}
			const liveIds = new Set(liveVals.map((v) => v._id));
			const missingIds = values.filter((v) => !liveIds.has(v._id));
			if (missingIds.length > 0) {
				throw new Error(
					`HALT: member ${memberId} missing hardcoded value IDs: ${missingIds.map((v) => v._id).join(', ')}. ID drift — preflight IDs no longer present live.`,
				);
			}
		}
		artifact.initialValueCount = liveValueCount;
		console.log(`  Total live role values: ${liveValueCount} (expected ${EXPECTED_VALUE_COUNT})`);
		if (liveValueCount !== EXPECTED_VALUE_COUNT) {
			throw new Error(
				`HALT: total role values ${liveValueCount} != expected ${EXPECTED_VALUE_COUNT}.`,
			);
		}

		// Preservation snapshot
		console.log('\n=== Preservation snapshot ===');
		for (const [memberId, values] of Object.entries(MEMBER_ROLE_VALUES)) {
			artifact.preservation.push({ memberId, roleValues: values });
			console.log(`  member ${memberId}: ${values.map((v) => v.displayName).join(', ')}`);
		}

		// Delete property values (DELETE /property/{value-id})
		console.log('\n=== Delete role property values ===');
		for (const [memberId, values] of Object.entries(MEMBER_ROLE_VALUES)) {
			for (const val of values) {
				if (DRY_RUN) {
					console.log(
						`  [DRY-RUN] WOULD DELETE /property/${val._id} (${val.displayName} on ${memberId})`,
					);
					artifact.valueDeletions.push({
						memberId,
						valueId: val._id,
						displayName: val.displayName,
						outcome: 'would-delete',
					});
				} else {
					try {
						await deletePropertyValue(client, val._id);
						console.log(
							`  DELETED role value "${val.displayName}" _id=${val._id} on member ${memberId}`,
						);
						artifact.valueDeletions.push({
							memberId,
							valueId: val._id,
							displayName: val.displayName,
							outcome: 'deleted',
						});
					} catch (err) {
						const msg = String(err);
						console.error(`  FAILED to delete role value ${val._id}: ${msg}`);
						artifact.valueDeletions.push({
							memberId,
							valueId: val._id,
							displayName: val.displayName,
							outcome: 'failed',
						});
						artifact.errors.push(`role value ${val._id} on member ${memberId}: ${msg}`);
					}
				}
			}
		}

		// Post-delete verification (live only)
		if (!DRY_RUN) {
			console.log('\n=== Post-delete verification ===');
			let remainingTotal = 0;
			for (const memberId of Object.keys(MEMBER_ROLE_VALUES)) {
				const entity = (await fetchEntity(client, memberId)) as { role?: Array<{ _id?: string }> };
				const remaining = (entity.role ?? []).filter((v) => v._id).length;
				remainingTotal += remaining;
				console.log(`  member ${memberId}: ${remaining} remaining role values (expected 0)`);
			}
			artifact.postDeleteVerified = remainingTotal === 0;
			if (remainingTotal !== 0) {
				throw new Error(
					`HALT: post-delete verification failed — ${remainingTotal} role values remain across all members.`,
				);
			}
			console.log('  Post-delete: VERIFIED (0 remaining across all members)');
		}

		// Delete role prop-def on member type
		console.log('\n=== Delete role prop-def on member type ===');
		if (DRY_RUN) {
			console.log(`  [DRY-RUN] WOULD DELETE entity (prop-def) _id=${ROLE_PROP_DEF_ID} name="role"`);
			artifact.propDefResult = { id: ROLE_PROP_DEF_ID, name: 'role', outcome: 'would-delete' };
		} else {
			try {
				await deleteEntity(client, ROLE_PROP_DEF_ID);
				console.log(`  DELETED role prop-def _id=${ROLE_PROP_DEF_ID}`);
				artifact.propDefResult = { id: ROLE_PROP_DEF_ID, name: 'role', outcome: 'deleted' };
			} catch (err) {
				const msg = String(err);
				console.error(`  FAILED to delete role prop-def _id=${ROLE_PROP_DEF_ID}: ${msg}`);
				artifact.propDefResult = { id: ROLE_PROP_DEF_ID, name: 'role', outcome: 'failed' };
				artifact.errors.push(`role prop-def ${ROLE_PROP_DEF_ID}: ${msg}`);
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
	const path = join(dir, `cleanup-phase-c-member-role-property-${ts}.json`);
	writeFileSync(path, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${path}`);

	console.log('\n=== SUMMARY ===');
	console.log(`initialValueCount: ${artifact.initialValueCount}`);
	console.log(`preservation: ${artifact.preservation.length} members`);
	console.log(`valueDeletions: ${artifact.valueDeletions.map((r) => r.outcome).join(', ')}`);
	console.log(`postDeleteVerified: ${artifact.postDeleteVerified}`);
	console.log(`propDefResult: ${artifact.propDefResult.outcome}`);
	console.log(`errors: ${artifact.errors.length}`);

	if (artifact.exitCode !== 0) process.exit(1);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
