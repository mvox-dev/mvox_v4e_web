/**
 * probe-slice3-sharing-and-addUser-2026-08-06.ts
 *
 * Slice-3 #17 follow-up, Gama's two read-only asks (non-blocking, both GO):
 *
 * PROBE A — round out the person-type prop-def _sharing census to 4 fields:
 *   name, email, notes (already reported: all domain) + preferred_contact_email.
 *   Canonical v4E has notes/email/preferred_contact_email all PRIVATE — polyphony's
 *   live values decide whether email is diverging in the LOOSENING direction.
 *
 * PROBE B — onboarding mechanism: why did mikela.biri@gmail.com's OAuth sign-in
 * produce no polyphony person? Per team memory, `add_user` on the DB entity gates
 * OAuth person auto-provisioning (absent -> sign-in returns accounts:[]). Check
 * whether polyphony's db entity carries add_user, and what shape (open vs
 * account-scoped).
 *
 * READ-ONLY. No mutations. Report only — no action taken on findings.
 *
 * Run: npx tsx scripts/migrations/probes/probe-slice3-sharing-and-addUser-2026-08-06.ts
 */

import {
	getJwt,
	fetchEntity,
	listEntities,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	POLYPHONY_DB_ENTITY_ID,
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

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

function sharingOf(entity: Record<string, unknown>): { value: string | null; valueId: string | null } {
	const arr = (entity._sharing as any[]) ?? [];
	return { value: arr[0]?.string ?? null, valueId: arr[0]?._id ?? null };
}

async function findPropDef(client: EntuClient, parentTypeId: string, name: string) {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': parentTypeId,
		'name.string': name,
		props: '_id,name,_sharing',
	});
	return resp.entities[0] ?? null;
}

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString() };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// -----------------------------------------------------------------
	// PROBE A: 4-field prop-def _sharing census on person type
	// -----------------------------------------------------------------
	section('PROBE A: person prop-def _sharing — name/email/notes/preferred_contact_email');
	const personType = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': 'person',
		props: '_id,name',
	});
	const personTypeId = personType.entities[0]?._id ?? null;
	log(`person type id: ${personTypeId}`);

	const fields = ['name', 'email', 'notes', 'preferred_contact_email'];
	const fieldSharing: Record<string, unknown> = {};
	if (personTypeId) {
		for (const f of fields) {
			const pd = await findPropDef(client, personTypeId, f);
			const s = pd ? sharingOf(pd) : null;
			log(`  ${f}: propDef=${pd ? pd._id : 'MISSING'} sharing=${JSON.stringify(s)}`);
			fieldSharing[f] = pd ? { propDefId: pd._id, sharing: s } : { propDefId: null, exists: false };
		}
	}
	result.probeA_personFieldSharing = fieldSharing;

	const canonical = { name: null, email: 'private', notes: 'private', preferred_contact_email: 'private' };
	const divergence: Record<string, unknown> = {};
	for (const f of fields) {
		const live = (fieldSharing[f] as any)?.sharing?.value ?? null;
		const canon = (canonical as any)[f];
		divergence[f] = { live, canonical: canon, diverges: canon !== null && live !== canon };
	}
	log(`\ndivergence vs canonical v4E: ${JSON.stringify(divergence, null, 2)}`);
	result.probeA_divergenceVsCanonical = divergence;

	// -----------------------------------------------------------------
	// PROBE B: polyphony db entity — add_user config
	// -----------------------------------------------------------------
	section('PROBE B: polyphony db entity — add_user (OAuth auto-provision gate)');
	log(`db entity id: ${POLYPHONY_DB_ENTITY_ID}`);
	const dbEntity = await fetchEntity(client, POLYPHONY_DB_ENTITY_ID);
	log(`full db entity keys: ${Object.keys(dbEntity).join(', ')}`);
	const addUser = (dbEntity as any).add_user ?? null;
	log(`add_user raw: ${JSON.stringify(addUser, null, 2)}`);
	result.probeB_dbEntity = { id: POLYPHONY_DB_ENTITY_ID, allKeys: Object.keys(dbEntity), add_user: addUser };

	if (addUser === null) {
		log('add_user is ABSENT on the db entity.');
		result.probeB_verdict = {
			addUserPresent: false,
			interpretation:
				'add_user absent on the db entity — per team memory this is the OAuth auto-provision gate; absence would mean fresh OAuth identities do not get a person auto-created, consistent with the observed B-not-found finding. Not independently verified beyond this read — reporting the raw value, not asserting the causal mechanism as confirmed.',
		};
	} else {
		const values = Array.isArray(addUser) ? addUser : [addUser];
		log(`add_user has ${values.length} value(s) — ${values.length === 0 ? 'open/unrestricted shape' : 'scoped to specific value(s)'}`);
		result.probeB_verdict = {
			addUserPresent: true,
			valueCount: values.length,
			values,
		};
	}

	const artifactPath = await writeResultArtifact('slice3-sharing-and-addUser', result);
	log(`\nresult artifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
