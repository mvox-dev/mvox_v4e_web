/**
 * cleanup-fila-hooaeg-end-date-2026-08-06.ts
 *
 * Data hygiene (task #10): season "Fila hooaeg" (6a1d6b6210cc20db24e7ce58) has
 * end_date=2026-07-28 but owns rehearsal events through 2026-12-15
 * (probe-agenda-empty-investigation-2026-08-06). end_date no longer gates the
 * agenda (query-logic fix lands separately) — this is cosmetic-only: keep the
 * record self-consistent for anyone reading it directly.
 *
 * Single UPDATE op: DELETE the current end_date property value, POST a new one.
 * Idempotent: if end_date is already >= NEW_END_DATE, this is a no-op.
 *
 * Manifest-first. Default DRY_RUN (prints current value + proposed value + the
 * exact op, no mutation). --live executes.
 *
 * Run:
 *   pnpm exec tsx scripts/migrations/cleanup-fila-hooaeg-end-date-2026-08-06.ts
 *   pnpm exec tsx scripts/migrations/cleanup-fila-hooaeg-end-date-2026-08-06.ts --live
 *
 * Authorization: team-lead task #10 dispatch, 2026-08-05T22:06:30Z — explicit
 * "team-lead has authorized" for this exact scoped op (single property, one
 * entity, cosmetic, reversible).
 */

import { getJwt, fetchEntity, deletePropertyValue, postProperties, type EntuClient, type EntuProperty } from './lib/entu-client.ts';
import { writeResultArtifact } from './perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--live');

const SEASON_ID = '6a1d6b6210cc20db24e7ce58';
// Last known rehearsal event under this season is 2026-12-15 (probe-agenda-empty-investigation).
// New end_date gives a small buffer past that (calendar year end) rather than the exact last
// event date, so the season doesn't drift stale again the moment a same-week event is added.
const NEW_END_DATE = '2026-12-31';

const log = (msg: string) => console.log(`[cleanup] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function main() {
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	section('Manifest: current value → proposed value');
	const before = await fetchEntity(client, SEASON_ID);
	const name = (before.name as any)?.[0]?.string ?? null;
	const endDateProp = (before.end_date as any)?.[0] ?? null;
	const currentEndDate = endDateProp?.date ?? null;
	const currentEndDateValueId = endDateProp?._id ?? null;

	log(`season: ${SEASON_ID} ("${name}")`);
	log(`current end_date: ${currentEndDate} (property value _id: ${currentEndDateValueId})`);
	log(`proposed end_date: ${NEW_END_DATE}`);

	const alreadyCovers = currentEndDate && new Date(currentEndDate) >= new Date(NEW_END_DATE);
	if (alreadyCovers) {
		log('SKIP: current end_date already >= proposed value. No-op (idempotent).');
		await writeResultArtifact('cleanup-fila-hooaeg-end-date', {
			timestamp: new Date().toISOString(),
			dryRun: DRY_RUN,
			seasonId: SEASON_ID,
			skipped: true,
			reason: 'current end_date already covers proposed value',
			currentEndDate,
			proposedEndDate: NEW_END_DATE,
		});
		return;
	}

	log('planned op:');
	if (currentEndDateValueId) {
		log(`  1. DELETE /property/${currentEndDateValueId}  (removes current end_date value)`);
	} else {
		log('  1. (skip — no existing end_date value to delete)');
	}
	log(`  2. POST /entity/${SEASON_ID}  [{ type: 'end_date', date: '${NEW_END_DATE}' }]`);

	if (DRY_RUN) {
		section('DRY_RUN — no mutation performed');
		log('Re-run with --live to execute.');
		await writeResultArtifact('cleanup-fila-hooaeg-end-date', {
			timestamp: new Date().toISOString(),
			dryRun: true,
			seasonId: SEASON_ID,
			currentEndDate,
			currentEndDateValueId,
			proposedEndDate: NEW_END_DATE,
			wouldExecute: true,
		});
		return;
	}

	section('LIVE — executing');
	if (currentEndDateValueId) {
		await deletePropertyValue(client, currentEndDateValueId);
		log(`deleted property value ${currentEndDateValueId}`);
	}
	const newProp = { type: 'end_date', date: NEW_END_DATE } as unknown as EntuProperty;
	await postProperties(client, SEASON_ID, [newProp]);
	log(`posted new end_date=${NEW_END_DATE}`);

	section('Post-write verification');
	const after = await fetchEntity(client, SEASON_ID);
	const afterEndDateArr = (after.end_date as any) ?? [];
	const afterEndDate = afterEndDateArr[0]?.date ?? null;
	const afterEndDateValueId = afterEndDateArr[0]?._id ?? null;
	const singleValue = afterEndDateArr.length === 1;
	const valueMatches = afterEndDate === `${NEW_END_DATE}T00:00:00.000Z`;
	const newValueId = afterEndDateValueId !== currentEndDateValueId;

	log(`end_date after write: ${afterEndDate} (property value _id: ${afterEndDateValueId})`);
	log(`array length === 1: ${singleValue} (no double-append)`);
	log(`value matches proposed: ${valueMatches}`);
	log(`new property value _id (not reused old one): ${newValueId}`);

	const verified = singleValue && valueMatches && newValueId;
	log(`VERIFIED: ${verified}`);

	const artifactPath = await writeResultArtifact('cleanup-fila-hooaeg-end-date', {
		timestamp: new Date().toISOString(),
		dryRun: false,
		seasonId: SEASON_ID,
		before: { endDate: currentEndDate, endDateValueId: currentEndDateValueId },
		after: { endDate: afterEndDate, endDateValueId: afterEndDateValueId },
		checks: { singleValue, valueMatches, newValueId },
		verified,
	});
	log(`result artifact: ${artifactPath}`);

	if (!verified) {
		console.error('FAIL: post-write verification did not pass.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
