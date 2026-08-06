/**
 * probe-slice3-onboarding-b-observe-2026-08-06.ts
 *
 * Slice-3 #17 gating: OBSERVE step, before any fix. Person B (mikela.biri@gmail.com)
 * just OAuth-signed-in on prod polyphony; their `person` was auto-created with no
 * member yet. Load-bearing onboarding question: what _sharing does an OAuth-auto-
 * created person land with?
 *
 * READ-ONLY. No mutations. Reports (does not act on):
 *   1. B's freshly auto-created person — entity-level _sharing, verbatim.
 *   2. Field-level _sharing boundary for name/email/notes on A + B (prop-def tier,
 *      since Entu buckets field visibility by the property-DEFINITION's _sharing,
 *      not a per-value override — confirmed mechanism from the 2026-08-05
 *      mvox_collective probe). Also raw per-entity property presence for A/B.
 *   3. An existing member's shape (session-37 test member) as the template to
 *      match when B's member gets provisioned in the follow-up write script.
 *   5. Size: A + B member/person + shared-field counts.
 *
 * Run: npx tsx scripts/migrations/probes/probe-slice3-onboarding-b-observe-2026-08-06.ts
 */

import { getJwt, listEntities, fetchEntity, POLYPHONY_META_TYPE_ENTITY_ID, POLYPHONY_META_TYPE_PROPERTY_ID, type EntuClient } from '../lib/entu-client.ts';
import { writeResultArtifact } from '../perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const PERSON_A_ID = '6a2fc05e4cd971291c5d5ddc'; // Mihkel primary, slice-2 test person
const PERSON_A_EMAIL_EXPECTED = 'mihkel.putrinsh@gmail.com';
const PERSON_B_EMAIL = 'mikela.biri@gmail.com';
const EXISTING_MEMBER_TEMPLATE_ID = '6a2fdb434cd971291c5d5e85'; // A's own EFK member (session-37)
const EFK_ORG_ID = '69c7f8718489bfcb0e81b065';

const log = (msg: string) => console.log(`[observe] ${msg}`);
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
	// 1. Find B's freshly auto-created person, report _sharing verbatim
	// -----------------------------------------------------------------
	section("1. Find person B (mikela.biri@gmail.com), report _sharing verbatim");
	// Try a direct nested-field query first (unverified whether Entu supports
	// filtering on a sub-key of a compound property like entu_user.email);
	// fall back to a full-list client-side scan if it returns nothing.
	let personB: Record<string, unknown> | undefined;
	const directQuery = await listEntities(client, {
		'entu_user.email': PERSON_B_EMAIL,
		'_type.string': 'person',
		props: '_id,name,email,entu_user,_sharing,_created',
	});
	log(`direct entu_user.email query: ${(directQuery.entities ?? []).length} result(s)`);
	personB = directQuery.entities?.[0];
	if (!personB) {
		log('direct query returned nothing — falling back to full-list client-side scan');
		const wider = await listEntities(client, {
			'_type.string': 'person',
			props: '_id,name,email,entu_user,_sharing,_created',
			limit: '500',
		});
		log(`scanned ${(wider.entities ?? []).length} persons (api count=${wider.count ?? 'n/a'})`);
		personB = (wider.entities ?? []).find((p) => (p.entu_user as any[])?.[0]?.email === PERSON_B_EMAIL);
	}

	if (!personB) {
		log('PERSON B NOT FOUND by entu_user.email match in newest 100 persons.');
		result.personB = { found: false };
	} else {
		const sharingB = sharingOf(personB);
		log(`FOUND: ${personB._id}`);
		log(`  entu_user.email: ${(personB.entu_user as any[])?.[0]?.email}`);
		log(`  name: ${JSON.stringify(personB.name ?? null)}`);
		log(`  email (own field): ${JSON.stringify(personB.email ?? null)}`);
		log(`  _sharing VERBATIM: ${JSON.stringify(sharingB)}`);
		result.personB = {
			found: true,
			id: personB._id,
			entuUserEmail: (personB.entu_user as any[])?.[0]?.email,
			name: personB.name ?? null,
			email: personB.email ?? null,
			sharing: sharingB,
			rawEntuUser: personB.entu_user ?? null,
		};
	}

	// -----------------------------------------------------------------
	// Confirm A's identity
	// -----------------------------------------------------------------
	section('1b. Confirm person A identity');
	const personA = await fetchEntity(client, PERSON_A_ID);
	const aEmail = (personA.entu_user as any[])?.[0]?.email;
	const aMatches = aEmail === PERSON_A_EMAIL_EXPECTED;
	log(`A (${PERSON_A_ID}): entu_user.email=${aEmail} matchesExpected=${aMatches} name=${JSON.stringify(personA.name ?? null)}`);
	result.personA = { id: PERSON_A_ID, entuUserEmail: aEmail, matchesExpected: aMatches, name: personA.name ?? null, sharing: sharingOf(personA) };

	// -----------------------------------------------------------------
	// 2. Field-level _sharing (prop-def tier) for name/email/notes on person type
	// -----------------------------------------------------------------
	section('2. person type prop-def _sharing for name/email/notes (schema-level, applies to both A and B)');
	const personType = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': 'person',
		props: '_id,name',
	});
	const personTypeId = personType.entities[0]?._id ?? null;
	log(`person type id: ${personTypeId}`);
	const fieldNames = ['name', 'email', 'notes'];
	const propDefSharing: Record<string, unknown> = {};
	if (personTypeId) {
		for (const f of fieldNames) {
			const pd = await findPropDef(client, personTypeId, f);
			const s = pd ? sharingOf(pd) : null;
			log(`  ${f}: propDef=${pd ? pd._id : 'MISSING'} sharing=${JSON.stringify(s)}`);
			propDefSharing[f] = pd ? { propDefId: pd._id, sharing: s } : { propDefId: null, exists: false };
		}
	}
	result.personFieldPropDefSharing = propDefSharing;

	// Raw per-entity field presence for A and B (notes may not exist on either).
	section('2b. Raw per-entity field values (A + B) — name/email/notes presence');
	const aFull = await fetchEntity(client, PERSON_A_ID, );
	const aFields = { name: aFull.name ?? null, email: (aFull as any).email ?? null, notes: (aFull as any).notes ?? null };
	log(`A fields: ${JSON.stringify(aFields)}`);
	result.personA_fields = aFields;
	if (personB?._id) {
		const bFull = await fetchEntity(client, personB._id as string);
		const bFields = { name: bFull.name ?? null, email: (bFull as any).email ?? null, notes: (bFull as any).notes ?? null };
		log(`B fields: ${JSON.stringify(bFields)}`);
		result.personB_fields = bFields;
	}

	// -----------------------------------------------------------------
	// 3. Existing member shape (template for B's provisioning)
	// -----------------------------------------------------------------
	section('3. Existing member shape (template) — A own EFK member');
	const templateMember = await fetchEntity(client, EXISTING_MEMBER_TEMPLATE_ID);
	log(JSON.stringify(templateMember, null, 2));
	result.memberTemplate = templateMember;

	// -----------------------------------------------------------------
	// 5. Size existing data
	// -----------------------------------------------------------------
	section('5. Size: A + B member/person + shared-field counts');
	const aMembers = await listEntities(client, {
		'_type.string': 'member',
		'person.reference': PERSON_A_ID,
		props: '_id,_parent,status',
	});
	log(`A member count: ${(aMembers.entities ?? []).length}`);
	let bMembers: { entities?: Record<string, unknown>[] } = { entities: [] };
	if (personB?._id) {
		bMembers = await listEntities(client, {
			'_type.string': 'member',
			'person.reference': personB._id as string,
			props: '_id,_parent,status',
		});
	}
	log(`B member count: ${(bMembers.entities ?? []).length}`);
	result.sizing = {
		aMemberCount: (aMembers.entities ?? []).length,
		aMembers: aMembers.entities ?? [],
		bMemberCount: (bMembers.entities ?? []).length,
		bMembers: bMembers.entities ?? [],
	};

	const artifactPath = await writeResultArtifact('slice3-onboarding-b-observe', result);
	log(`\nresult artifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
