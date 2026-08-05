/**
 * probe-slice2-rsvp-gating-2026-08-06.ts
 *
 * Slice-2 (RSVP singer-side, mvox-dev/mvox-app#8) gating probe for the PO
 * before any breakdown. Team-lead's unauthenticated probes returned 0 for
 * member/rsvp/organization — those types are private/domain-shared, so 0
 * could mean rights-gating rather than absence. This probe runs AUTHENTICATED
 * (ENTU_API_KEY, db-owner) against live polyphony so absence-vs-hidden is
 * resolved definitively.
 *
 * READ-ONLY. No mutations. Does not create, does not seed member entities —
 * per team-lead's directive, if members are absent this is escalated, not
 * improvised (member shape is the roster slice, Mihkel's call).
 *
 * Answers:
 *   1. Does a `member` exist for person=6a2fc05e4cd971291c5d5ddc under EFK,
 *      status=active? (resolves EFK org id first)
 *   2. Does the `rsvp` type-def exist?
 *   3. Do the 4 sentinel ref props (rsvp) + 4 count formulas + rsvp_tally
 *      (event) exist, and are they sharing:public?
 *
 * Run: npx tsx scripts/migrations/probes/probe-slice2-rsvp-gating-2026-08-06.ts
 */

import {
	getJwt,
	listEntities,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
} from '../lib/entu-client.ts';
import { writeResultArtifact } from '../perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const PO_PERSON_ID = '6a2fc05e4cd971291c5d5ddc';

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

function sharingOf(entity: Record<string, unknown>): string {
	const arr = entity._sharing as Array<{ string?: string }> | undefined;
	return arr?.[0]?.string ?? 'ABSENT';
}

async function findTypeEntity(client: EntuClient, name: string) {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': name,
		props: '_id,name,_sharing',
	});
	return resp.entities[0] ?? null;
}

async function findPropDef(client: EntuClient, parentTypeId: string, name: string) {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': parentTypeId,
		'name.string': name,
		props: '_id,name,_sharing,formula',
	});
	return resp.entities[0] ?? null;
}

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString(), poPersonId: PO_PERSON_ID };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	section('1a. Resolve EFK org id');
	const orgResp = await listEntities(client, {
		'_type.string': 'organization',
		'name.string': 'Eesti Filharmoonia Kammerkoor',
		props: '_id,name,_sharing',
	});
	const efk = orgResp.entities[0] ?? null;
	if (!efk) {
		// fall back to a substring-tolerant pass — name.string is an exact filter,
		// so try the un-filtered organization list and match client-side.
		const allOrgs = await listEntities(client, { '_type.string': 'organization', props: '_id,name', limit: '50' });
		const match = (allOrgs.entities ?? []).find((o) =>
			String((o.name as any)?.[0]?.string ?? '').match(/EFK|Filharmoonia/i),
		);
		log(`exact-name lookup found nothing; substring fallback: ${match ? match._id : 'NONE'}`);
		result.efkOrg = match ? { id: match._id, name: (match.name as any)?.[0]?.string } : null;
	} else {
		log(`EFK org: ${efk._id} name="${(efk.name as any)?.[0]?.string}" sharing=${sharingOf(efk)}`);
		result.efkOrg = { id: efk._id, name: (efk.name as any)?.[0]?.string, sharing: sharingOf(efk) };
	}
	const efkId = (result.efkOrg as any)?.id ?? null;

	section('1b. member for PO test person under EFK, status=active');
	if (!efkId) {
		log('SKIP — no EFK org id resolved');
		result.member = { queried: false, reason: 'no EFK org id' };
	} else {
		const memberResp = await listEntities(client, {
			'_type.string': 'member',
			'person.reference': PO_PERSON_ID,
			'_parent.reference': efkId,
			props: '_id,person,_parent,status,_sharing',
		});
		const members = memberResp.entities ?? [];
		log(`member count: ${members.length} (api count=${memberResp.count ?? 'n/a'})`);
		for (const m of members) {
			const status = (m.status as any)?.[0]?.string ?? null;
			log(`  member ${m._id}: status=${status} sharing=${sharingOf(m)}`);
		}
		result.member = {
			queried: true,
			count: members.length,
			rows: members.map((m) => ({
				id: m._id,
				status: (m.status as any)?.[0]?.string ?? null,
				sharing: sharingOf(m),
			})),
		};
	}

	section('2. rsvp type-def exists?');
	const rsvpType = await findTypeEntity(client, 'rsvp');
	log(rsvpType ? `rsvp type EXISTS: ${rsvpType._id} sharing=${sharingOf(rsvpType)}` : 'rsvp type MISSING');
	result.rsvpType = rsvpType ? { id: rsvpType._id, sharing: sharingOf(rsvpType) } : null;

	section('3a. rsvp sentinel ref props (going_ref/not_going_ref/maybe_ref/late_ref)');
	const sentinelNames = ['going_ref', 'not_going_ref', 'maybe_ref', 'late_ref'];
	const sentinels: Record<string, unknown> = {};
	if (rsvpType) {
		for (const name of sentinelNames) {
			const pd = await findPropDef(client, rsvpType._id, name);
			log(pd ? `  ${name}: EXISTS (${pd._id}) sharing=${sharingOf(pd)}` : `  ${name}: MISSING`);
			sentinels[name] = pd ? { id: pd._id, sharing: sharingOf(pd) } : null;
		}
	} else {
		log('  SKIP — rsvp type missing');
	}
	result.rsvpSentinelProps = sentinels;

	section('3b. event count formulas (rsvp_*_count) + rsvp_tally');
	const eventType = await findTypeEntity(client, 'event');
	log(eventType ? `event type: ${eventType._id}` : 'event type MISSING (unexpected)');
	const formulaNames = [
		'rsvp_going_count',
		'rsvp_not_going_count',
		'rsvp_maybe_count',
		'rsvp_late_count',
		'rsvp_tally',
	];
	const formulas: Record<string, unknown> = {};
	if (eventType) {
		for (const name of formulaNames) {
			const pd = await findPropDef(client, eventType._id, name);
			const formulaStr = (pd?.formula as any)?.[0]?.string ?? null;
			log(pd ? `  ${name}: EXISTS (${pd._id}) sharing=${sharingOf(pd)} formula="${formulaStr}"` : `  ${name}: MISSING`);
			formulas[name] = pd ? { id: pd._id, sharing: sharingOf(pd), formula: formulaStr } : null;
		}
	} else {
		log('  SKIP — event type missing');
	}
	result.eventCountFormulas = formulas;

	section('Verdict inputs');
	const memberExists = ((result.member as any)?.count ?? 0) > 0;
	const rsvpTypeExists = !!rsvpType;
	const sentinelsAllExist = Object.values(sentinels).every((v) => v !== null);
	const formulasAllExist = Object.values(formulas).every((v) => v !== null);
	log(
		`memberExists=${memberExists} rsvpTypeExists=${rsvpTypeExists} ` +
			`sentinelsAllExist=${sentinelsAllExist} formulasAllExist=${formulasAllExist}`,
	);
	result.verdictInputs = { memberExists, rsvpTypeExists, sentinelsAllExist, formulasAllExist };

	const artifactPath = await writeResultArtifact('slice2-rsvp-gating', result);
	log(`result artifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
