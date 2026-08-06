/**
 * probe-slice2-rsvp-private-sharing-2026-08-06.ts
 *
 * Follow-up to probe-slice2-rsvp-create-smoke-2026-08-06 (which found: rsvp
 * auto-inherits _sharing:domain from a domain-shared person parent, contradicting
 * the "private by default" assumption in src/lib/rsvp/rsvpData.ts createRsvp()).
 * Canonical schema requires rsvp to be _sharing:private (counts-never-names model
 * depends on it). This probe settles HOW to make that stick.
 *
 * Phase A: create WITH explicit {type:'_sharing', string:'private'} in the props.
 *   Does it stick, or does entu-api's create-time inherit override it back to domain?
 * Phase B (fallback, only meaningful if A does not stick): create WITHOUT explicit
 *   _sharing (as before), then DELETE the auto-injected _sharing property value,
 *   re-GET — does it fall to private/absent, or re-materialize domain?
 * Phase C: with whichever approach yields private, confirm the OWNER key can still
 *   read the entity back by id (mechanic check only — true singer-token read is #13).
 * Cleanup: DELETE every smoke rsvp created here; confirm each is gone (404).
 *
 * LIVE. Two creates + two deletes (one per phase, A and B), nothing else mutated.
 * Authorization: team-lead, explicit "I authorize this run", distinct token.
 *
 * Run: npx tsx scripts/migrations/probes/probe-slice2-rsvp-private-sharing-2026-08-06.ts
 */

import {
	getJwt,
	fetchEntity,
	createEntity,
	deleteEntity,
	deletePropertyValue,
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

const RSVP_TYPE_ID = '6a0d2e8590c8df7a1cc7df1b';
const PO_PERSON_ID = '6a2fc05e4cd971291c5d5ddc';
const PO_MEMBER_ID = '6a2fdb434cd971291c5d5e85';
const EVENT_ID = '6a1d6b6210cc20db24e7ce70'; // "Tuesday rehearsals", 2026-09-01
const STATUS = 'going';

const log = (msg: string) => console.log(`[private-probe] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

function baseProps(): EntuProperty[] {
	return [
		{ type: '_type', reference: RSVP_TYPE_ID },
		{ type: '_parent', reference: PO_PERSON_ID },
		{ type: 'event', reference: EVENT_ID } as unknown as EntuProperty,
		{ type: 'member', reference: PO_MEMBER_ID } as unknown as EntuProperty,
		{ type: 'status', string: STATUS },
		{ type: `${STATUS}_ref`, reference: EVENT_ID } as unknown as EntuProperty,
	];
}

function sharingOf(entity: Record<string, unknown>): { value: string | null; valueId: string | null } {
	const arr = (entity._sharing as any[]) ?? [];
	return { value: arr[0]?.string ?? null, valueId: arr[0]?._id ?? null };
}

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString() };
	const cleanupIds: string[] = [];

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// ---------------------------------------------------------------------
	// Phase A: explicit _sharing:private in the create payload
	// ---------------------------------------------------------------------
	section('Phase A: explicit _sharing:private at CREATE');
	const propsA: EntuProperty[] = [...baseProps(), { type: '_sharing', string: 'private' }];
	log(`POST body: ${JSON.stringify(propsA)}`);
	const createdA = await createEntity(client, propsA);
	cleanupIds.push(createdA._id);
	log(`created: ${createdA._id}`);

	const readA = await fetchEntity(client, createdA._id);
	const sharingA = sharingOf(readA);
	log(`re-GET _sharing: ${JSON.stringify(sharingA)}`);
	const phaseASticks = sharingA.value === 'private';
	log(`Phase A explicit-private STICKS: ${phaseASticks}`);

	result.phaseA = {
		postBody: propsA,
		createdId: createdA._id,
		createResponseProperties: createdA.properties ?? null,
		readBackSharing: sharingA,
		sticks: phaseASticks,
	};

	// ---------------------------------------------------------------------
	// Phase C (owner-read-back) for Phase A's entity, since it's the primary
	// candidate mechanism if it stuck.
	// ---------------------------------------------------------------------
	if (phaseASticks) {
		section('Phase C (via A): owner-key read-back of a private rsvp');
		const readBackAgain = await fetchEntity(client, createdA._id);
		const ownerCanRead = readBackAgain._id === createdA._id;
		log(`owner-key GET /entity/${createdA._id} succeeded: ${ownerCanRead}`);
		result.phaseC_viaA = { ownerCanRead };
	}

	// ---------------------------------------------------------------------
	// Phase B: fallback — create without explicit _sharing, then DELETE the
	// auto-injected value, re-GET to see if it falls to private/absent or
	// re-materializes domain. Run regardless of Phase A's outcome so both
	// mechanisms are documented for the team, not just whichever one "won".
	// ---------------------------------------------------------------------
	section('Phase B: create without _sharing, then DELETE auto-injected value');
	const propsB = baseProps();
	log(`POST body: ${JSON.stringify(propsB)}`);
	const createdB = await createEntity(client, propsB);
	cleanupIds.push(createdB._id);
	log(`created: ${createdB._id}`);

	const readB1 = await fetchEntity(client, createdB._id);
	const sharingB1 = sharingOf(readB1);
	log(`re-GET _sharing (before correction): ${JSON.stringify(sharingB1)}`);

	let sharingB2: { value: string | null; valueId: string | null } = { value: null, valueId: null };
	if (sharingB1.valueId) {
		await deletePropertyValue(client, sharingB1.valueId);
		log(`deleted auto-injected _sharing value ${sharingB1.valueId}`);
		const readB2 = await fetchEntity(client, createdB._id);
		sharingB2 = sharingOf(readB2);
		log(`re-GET _sharing (after DELETE, no re-POST): ${JSON.stringify(sharingB2)}`);
	} else {
		log('no _sharing value was auto-injected — nothing to delete');
	}
	const phaseBYieldsAbsent = sharingB1.valueId ? sharingB2.value === null : sharingB1.value === null;
	log(`Phase B (delete-auto-injected) yields ABSENT (=private by default): ${phaseBYieldsAbsent}`);

	result.phaseB = {
		postBody: propsB,
		createdId: createdB._id,
		sharingBeforeCorrection: sharingB1,
		sharingAfterCorrection: sharingB2,
		yieldsAbsent: phaseBYieldsAbsent,
	};

	if (phaseBYieldsAbsent) {
		section('Phase C (via B): owner-key read-back of an absent-sharing (private) rsvp');
		const readBackB = await fetchEntity(client, createdB._id);
		const ownerCanRead = readBackB._id === createdB._id;
		log(`owner-key GET /entity/${createdB._id} succeeded: ${ownerCanRead}`);
		result.phaseC_viaB = { ownerCanRead };
	}

	// ---------------------------------------------------------------------
	// Cleanup: delete every smoke rsvp, confirm gone.
	// ---------------------------------------------------------------------
	section('Cleanup: DELETE all smoke rsvps, confirm gone');
	const cleanupResults: Record<string, boolean> = {};
	for (const id of cleanupIds) {
		await deleteEntity(client, id);
		log(`deleted entity ${id}`);
		try {
			await fetchEntity(client, id);
			log(`  UNEXPECTED: ${id} still fetchable after DELETE`);
			cleanupResults[id] = false;
		} catch {
			log(`  confirmed gone: ${id}`);
			cleanupResults[id] = true;
		}
	}
	result.cleanup = cleanupResults;
	const allCleanedUp = Object.values(cleanupResults).every(Boolean);

	section('Verdict: working private-create mechanism');
	const verdict = {
		explicitPrivateAtCreateSticks: phaseASticks,
		deleteAutoInjectedFallbackYieldsAbsent: phaseBYieldsAbsent,
		recommendedMechanism: phaseASticks
			? "Add {type:'_sharing', string:'private'} to the createRsvp() props array — sticks through create, no follow-up needed."
			: phaseBYieldsAbsent
				? 'Create without _sharing, then DELETE the auto-injected _sharing property value in a follow-up call — falls to ABSENT (=private by default), matching the original code comment intent.'
				: 'NEITHER approach yields private — escalate, do not guess further.',
		allCleanedUp,
	};
	log(JSON.stringify(verdict, null, 2));
	result.verdict = verdict;

	const artifactPath = await writeResultArtifact('slice2-rsvp-private-sharing', result);
	log(`result artifact: ${artifactPath}`);

	if (!allCleanedUp) {
		console.error('FAIL: cleanup did not confirm all smoke rsvps gone.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
