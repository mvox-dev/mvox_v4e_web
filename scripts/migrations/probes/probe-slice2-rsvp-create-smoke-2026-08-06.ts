/**
 * probe-slice2-rsvp-create-smoke-2026-08-06.ts
 *
 * Slice-2 #10 opening move (mvox-dev/mvox-app#8) — authorized live smoke-create
 * to pin the rsvp CREATE wire shape against live polyphony before Josquin builds
 * the data layer on it. Exact shape mirrors the canonical harvest
 * src/lib/rsvp/rsvpData.ts createRsvp() — confirmed identical by reading that
 * function before writing this probe.
 *
 * Sequence: manifest (exact POST body) → CREATE → re-GET (verify shape) →
 * DELETE (cleanup, don't pollute Mihkel's live-gate agenda) → re-GET (confirm gone).
 *
 * Uses ENTU_API_KEY (PO/db-owner key) — this pins the WIRE SHAPE only. The
 * singer-writes-on-own-token RIGHTS path is a separate concern (#13, Mihkel's
 * real token) and is NOT validated by this probe.
 *
 * LIVE. One create + one delete. Nothing else mutated.
 * Authorization: team-lead, explicit "I authorize this run", distinct token
 * (not inferred from task-assignment wording, per the re-tightened gate).
 *
 * Run: npx tsx scripts/migrations/probes/probe-slice2-rsvp-create-smoke-2026-08-06.ts
 */

import {
	getJwt,
	fetchEntity,
	createEntity,
	deleteEntity,
	type EntuClient,
	type EntuProperty,
} from '../lib/entu-client.ts';
import { writeResultArtifact } from '../perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

// From probe-slice2-rsvp-gating-2026-08-06 + probe-agenda-empty-investigation-2026-08-06.
const RSVP_TYPE_ID = '6a0d2e8590c8df7a1cc7df1b';
const PO_PERSON_ID = '6a2fc05e4cd971291c5d5ddc';
const PO_MEMBER_ID = '6a2fdb434cd971291c5d5e85';
// "Tuesday rehearsals", Season 1 "Fila hooaeg", start_datetime 2026-09-01T16:00 — a real upcoming EFK rehearsal.
const EVENT_ID = '6a1d6b6210cc20db24e7ce70';
const STATUS: 'going' | 'not_going' | 'maybe' | 'late' = 'going';

const log = (msg: string) => console.log(`[smoke] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString() };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// Matches src/lib/rsvp/rsvpData.ts createRsvp() exactly (read before writing this probe).
	const props: EntuProperty[] = [
		{ type: '_type', reference: RSVP_TYPE_ID },
		{ type: '_parent', reference: PO_PERSON_ID },
		{ type: 'event', reference: EVENT_ID } as unknown as EntuProperty,
		{ type: 'member', reference: PO_MEMBER_ID } as unknown as EntuProperty,
		{ type: 'status', string: STATUS },
		{ type: `${STATUS}_ref`, reference: EVENT_ID } as unknown as EntuProperty,
	];

	section('Manifest: exact POST body');
	log(`POST ${API_BASE}/${DB}/entity`);
	log(JSON.stringify(props, null, 2));
	result.postBody = props;

	section('1. CREATE');
	const created = await createEntity(client, props);
	log(`response: ${JSON.stringify(created)}`);
	log(`_id: ${created._id} (accepted: ${!!created._id})`);
	result.createResponse = created;
	result.createAccepted = !!created._id;
	const rsvpId = created._id;

	section('2. Re-GET — verify shape');
	const readBack = await fetchEntity(client, rsvpId);
	log(`entity: ${JSON.stringify(readBack, null, 2)}`);
	result.readBack = readBack;

	const eventArr = (readBack.event as any[]) ?? [];
	const memberArr = (readBack.member as any[]) ?? [];
	const statusArr = (readBack.status as any[]) ?? [];
	const goingRefArr = (readBack.going_ref as any[]) ?? [];
	const notGoingRefArr = (readBack.not_going_ref as any[]) ?? [];
	const maybeRefArr = (readBack.maybe_ref as any[]) ?? [];
	const lateRefArr = (readBack.late_ref as any[]) ?? [];
	const sharingArr = (readBack._sharing as any[]) ?? [];

	const checks = {
		eventIsReference: eventArr[0]?.reference === EVENT_ID && eventArr[0]?.string === undefined,
		memberIsReference: memberArr[0]?.reference === PO_MEMBER_ID && memberArr[0]?.string === undefined,
		statusIsString: statusArr[0]?.string === STATUS && statusArr[0]?.reference === undefined,
		goingRefIsReference: goingRefArr[0]?.reference === EVENT_ID,
		otherSentinelsAbsent: notGoingRefArr.length === 0 && maybeRefArr.length === 0 && lateRefArr.length === 0,
		sharingAbsent: sharingArr.length === 0,
	};
	log(`checks: ${JSON.stringify(checks, null, 2)}`);
	result.checks = checks;
	result.rightsNote =
		'Created via ENTU_API_KEY (PO/db-owner) — pins WIRE SHAPE only. Singer-writes-on-own-token RIGHTS path is NOT validated here; that is #13 (Mihkel real token).';

	section('3. DELETE — cleanup');
	await deleteEntity(client, rsvpId);
	log(`deleted entity ${rsvpId}`);

	section('4. Re-GET — confirm gone');
	let confirmedGone = false;
	try {
		await fetchEntity(client, rsvpId);
		log('UNEXPECTED: entity still fetchable after DELETE');
	} catch (err) {
		confirmedGone = true;
		log(`confirmed gone: ${(err as Error).message}`);
	}
	result.confirmedGone = confirmedGone;

	const allChecksPass = Object.values(checks).every(Boolean);
	result.verdict = { allChecksPass, confirmedGone, smokeClean: allChecksPass && confirmedGone };
	log(`\nVERDICT: allChecksPass=${allChecksPass} confirmedGone=${confirmedGone}`);

	const artifactPath = await writeResultArtifact('slice2-rsvp-create-smoke', result);
	log(`result artifact: ${artifactPath}`);

	if (!allChecksPass || !confirmedGone) {
		console.error('FAIL: one or more checks did not pass, or cleanup did not confirm.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
