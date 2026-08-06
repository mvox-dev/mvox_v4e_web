/**
 * cleanup-t4-3-profile-type-person-reduction-2026-08-06.ts
 *
 * T4.3 / #24 — create the `profile` type (name+email prop-defs, narrow scope per
 * Mihkel), then remove person's name/email/notes prop-defs. Locked design doc
 * (Josquin, commit f4e9c18, workspace-app):
 * docs/design/2026-08-06-T4.3-profile-type-and-person-reduction.md §4.
 * Payloads below are copied verbatim from that doc, not reconstructed.
 *
 * Identity: MUST be the db-root key (ENTU_API_KEY -> person 69bcfd8e...8079).
 * That identity is _owner on the person prop-defs; an _editor gets 403 on
 * DELETE /entity (standing gotcha).
 *
 * Sequence: step 0 drift check (read-only) -> step 1 create profile type ->
 * step 2 create name+email prop-defs on profile -> step 3 DELETE the 3 person
 * prop-defs -> step 4 read-back (not inferred from POST/DELETE 200s) + purge
 * check (do name/email VALUES survive prop-def deletion? design doc predicts
 * yes -- propertiesToEntity builds private[] from raw property rows regardless
 * of any prop-def).
 *
 * If step 0 finds drift from the expected state, STOP before any mutation.
 *
 * Default DRY_RUN (prints manifest, no mutation). --live executes.
 *
 * Run:
 *   pnpm exec tsx scripts/migrations/cleanup-t4-3-profile-type-person-reduction-2026-08-06.ts
 *   pnpm exec tsx scripts/migrations/cleanup-t4-3-profile-type-person-reduction-2026-08-06.ts --live
 *
 * Authorization: team-lead explicit "I authorize this run. Execute now." (distinct
 * token, 2026-08-06), after independently verifying every target and Mihkel's go.
 */

import {
	getJwt,
	fetchEntity,
	listEntities,
	createEntity,
	deleteEntity,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	POLYPHONY_DB_ENTITY_ID,
	type EntuClient,
	type EntuProperty,
} from './lib/entu-client.ts';
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

const DB_ROOT_PERSON_ID = '69bcfd8e9c031ab8e6ce8079'; // db-root identity; must be the JWT's own person
const PERSON_TYPE_ID = '69bcfd8e9c031ab8e6ce805f';
const PERSON_NAME_PROPDEF_ID = '69bcfd8e9c031ab8e6ce8068';
const PERSON_EMAIL_PROPDEF_ID = '69bcfd8e9c031ab8e6ce8063';
const PERSON_NOTES_PROPDEF_ID = '69bcfd8e9c031ab8e6ce8069';
const PERSON_A_ID = '6a2fc05e4cd971291c5d5ddc'; // domain email-bearer, for purge check
const SAMPLE_PUBLIC_PERSON_ID = '6a0dd2384ff8277cd4305e9e'; // "Aino Kask"

const log = (msg: string) => console.log(`[t4.3] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

function sharingOf(entity: Record<string, unknown>): string {
	return (entity._sharing as any[])?.[0]?.string ?? 'ABSENT';
}

async function findPropDef(client: EntuClient, parentTypeId: string, name: string) {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': parentTypeId,
		'name.string': name,
		props: '_id,name,_sharing,type',
	});
	return resp.entities[0] ?? null;
}

async function main() {
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// -----------------------------------------------------------------
	// Step 0: drift check (read-only, always runs, even in --live mode,
	// before any mutation).
	// -----------------------------------------------------------------
	section('Step 0 — drift check (read-only)');
	const nameDef = await fetchEntity(client, PERSON_NAME_PROPDEF_ID).catch(() => null);
	const emailDef = await fetchEntity(client, PERSON_EMAIL_PROPDEF_ID).catch(() => null);
	const notesDef = await fetchEntity(client, PERSON_NOTES_PROPDEF_ID).catch(() => null);
	const profileTypeExisting = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': 'profile',
		props: '_id',
	});

	const nameOk = nameDef && (nameDef.name as any)?.[0]?.string === 'name';
	const emailOk = emailDef && (emailDef.name as any)?.[0]?.string === 'email';
	const notesOk = notesDef && (notesDef.name as any)?.[0]?.string === 'notes';
	const profileAbsent = (profileTypeExisting.entities ?? []).length === 0;

	log(`person.name propDef (${PERSON_NAME_PROPDEF_ID}): ${nameOk ? 'OK' : 'DRIFT'}`);
	log(`person.email propDef (${PERSON_EMAIL_PROPDEF_ID}): ${emailOk ? 'OK' : 'DRIFT'}`);
	log(`person.notes propDef (${PERSON_NOTES_PROPDEF_ID}): ${notesOk ? 'OK' : 'DRIFT'}`);
	log(`profile type absent (count 0): ${profileAbsent ? 'OK' : 'DRIFT — profile type already exists!'}`);

	if (!nameOk || !emailOk || !notesOk || !profileAbsent) {
		console.error('STOP: drift detected from the expected state. Not proceeding. Report to team-lead.');
		await writeResultArtifact('t4-3-profile-type-person-reduction', {
			timestamp: new Date().toISOString(),
			stoppedOnDrift: true,
			nameOk,
			emailOk,
			notesOk,
			profileAbsent,
			profileTypeExisting: profileTypeExisting.entities,
		});
		process.exit(1);
	}
	log('No drift. Safe to proceed.');

	if (DRY_RUN) {
		section('DRY_RUN — manifest only, no mutation performed');
		log('Would create profile type + name/email prop-defs, then DELETE person name/email/notes prop-defs.');
		log('Re-run with --live to execute.');
		return;
	}

	// -----------------------------------------------------------------
	// Step 1: create the `profile` type.
	// -----------------------------------------------------------------
	section('Step 1 — create profile type');
	const profileTypeProps: EntuProperty[] = [
		{ type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID } as unknown as EntuProperty,
		{ type: 'name', string: 'profile' },
		{ type: 'label', language: 'en', string: 'Profile' } as unknown as EntuProperty,
		{ type: 'label', language: 'et', string: 'Profiil' } as unknown as EntuProperty,
		{ type: '_sharing', string: 'public' },
		{ type: '_parent', reference: POLYPHONY_DB_ENTITY_ID } as unknown as EntuProperty,
		{ type: '_owner', reference: DB_ROOT_PERSON_ID } as unknown as EntuProperty,
	];
	const createdType = await createEntity(client, profileTypeProps);
	const profileTypeId = createdType._id;
	log(`profile type created: ${profileTypeId}`);

	// -----------------------------------------------------------------
	// Step 2: create name + email prop-defs on the profile type.
	// -----------------------------------------------------------------
	section('Step 2 — create name + email prop-defs on profile');
	const propDefSpecs: Array<{ name: string; labelEn: string; labelEt: string }> = [
		{ name: 'name', labelEn: 'Name', labelEt: 'Nimi' },
		{ name: 'email', labelEn: 'Email', labelEt: 'Email' },
	];
	const createdPropDefIds: Record<string, string> = {};
	for (const spec of propDefSpecs) {
		const props: EntuProperty[] = [
			{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID } as unknown as EntuProperty,
			{ type: '_parent', reference: profileTypeId } as unknown as EntuProperty,
			{ type: 'name', string: spec.name },
			{ type: 'type', string: 'string' },
			{ type: '_sharing', string: 'public' },
			{ type: 'search', boolean: true },
			{ type: 'label', language: 'en', string: spec.labelEn } as unknown as EntuProperty,
			{ type: 'label', language: 'et', string: spec.labelEt } as unknown as EntuProperty,
		];
		const created = await createEntity(client, props);
		createdPropDefIds[spec.name] = created._id;
		log(`profile.${spec.name} prop-def created: ${created._id}`);
	}

	// -----------------------------------------------------------------
	// Step 3: DELETE the 3 person prop-defs (entities, not property values).
	// -----------------------------------------------------------------
	section('Step 3 — DELETE person name/email/notes prop-defs');
	await deleteEntity(client, PERSON_NAME_PROPDEF_ID);
	log(`deleted person.name propDef ${PERSON_NAME_PROPDEF_ID}`);
	await deleteEntity(client, PERSON_EMAIL_PROPDEF_ID);
	log(`deleted person.email propDef ${PERSON_EMAIL_PROPDEF_ID}`);
	await deleteEntity(client, PERSON_NOTES_PROPDEF_ID);
	log(`deleted person.notes propDef ${PERSON_NOTES_PROPDEF_ID}`);

	// -----------------------------------------------------------------
	// Step 4: read-back verification (not inferred from POST/DELETE 200s).
	// -----------------------------------------------------------------
	section('Step 4 — read-back verification');

	const profileTypeReadBack = await fetchEntity(client, profileTypeId);
	const profileTypeSharing = sharingOf(profileTypeReadBack);
	const profileTypeOwnerIds = ((profileTypeReadBack._owner as any[]) ?? []).map((o) => o.reference);
	const profileTypeInheritRights = (profileTypeReadBack._inheritrights as any[])?.[0]?.boolean ?? null;
	log(`profile type _sharing: ${profileTypeSharing}`);
	log(`profile type _owner includes db-root: ${profileTypeOwnerIds.includes(DB_ROOT_PERSON_ID)}`);
	log(`profile type _inheritrights: ${profileTypeInheritRights}`);

	const profilePropDefsResp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': profileTypeId,
		props: '_id,name,_sharing,type,_owner',
	});
	const profilePropDefs = (profilePropDefsResp.entities ?? []).map((d) => ({
		id: d._id,
		name: (d.name as any)?.[0]?.string,
		sharing: sharingOf(d),
		type: (d.type as any)?.[0]?.string,
	}));
	log(`profile prop-defs (expect exactly name+email, both public): ${JSON.stringify(profilePropDefs)}`);

	const personPropDefsResp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': PERSON_TYPE_ID,
		props: '_id,name',
		limit: '50',
	});
	const personPropDefNames = (personPropDefsResp.entities ?? []).map((d) => (d.name as any)?.[0]?.string).sort();
	const nameGone = !personPropDefNames.includes('name');
	const emailGone = !personPropDefNames.includes('email');
	const notesGone = !personPropDefNames.includes('notes');
	const keptEntuUser = personPropDefNames.includes('entu_user');
	const keptEntuApiKey = personPropDefNames.includes('entu_api_key');
	const keptEntuPasskey = personPropDefNames.includes('entu_passkey');
	log(`person prop-defs remaining (${personPropDefNames.length}): ${JSON.stringify(personPropDefNames)}`);
	log(
		`name/email/notes GONE: ${nameGone}/${emailGone}/${notesGone}; ` +
			`entu_user/entu_api_key/entu_passkey KEPT: ${keptEntuUser}/${keptEntuApiKey}/${keptEntuPasskey}`,
	);

	section('Purge check — do name/email VALUES survive prop-def deletion?');
	const purgeTargets = [
		{ label: 'db-root Mihkel (private)', id: DB_ROOT_PERSON_ID },
		{ label: 'domain Mihkel', id: PERSON_A_ID },
		{ label: 'sample public person', id: SAMPLE_PUBLIC_PERSON_ID },
	];
	const purgeResults = [];
	for (const target of purgeTargets) {
		const p = await fetchEntity(client, target.id);
		const name = (p.name as any)?.[0]?.string ?? null;
		const email = (p.email as any)?.[0]?.string ?? null;
		log(`  ${target.label} (${target.id}): name=${JSON.stringify(name)} email=${JSON.stringify(email)}`);
		purgeResults.push({ ...target, name, email });
	}

	const verified =
		profileTypeSharing === 'public' &&
		profileTypeOwnerIds.includes(DB_ROOT_PERSON_ID) &&
		profileTypeInheritRights === true &&
		profilePropDefs.length === 2 &&
		profilePropDefs.every((d) => d.sharing === 'public') &&
		nameGone &&
		emailGone &&
		notesGone &&
		keptEntuUser &&
		keptEntuApiKey &&
		keptEntuPasskey;

	log(`\nVERIFIED: ${verified}`);

	const result = {
		timestamp: new Date().toISOString(),
		profileTypeId,
		profilePropDefIds: createdPropDefIds,
		readBack: {
			profileType: { sharing: profileTypeSharing, ownerIncludesDbRoot: profileTypeOwnerIds.includes(DB_ROOT_PERSON_ID), inheritRights: profileTypeInheritRights },
			profilePropDefs,
			personPropDefsRemaining: personPropDefNames,
			nameGone,
			emailGone,
			notesGone,
			keptEntuUser,
			keptEntuApiKey,
			keptEntuPasskey,
		},
		purgeCheck: purgeResults,
		verified,
	};

	const artifactPath = await writeResultArtifact('t4-3-profile-type-person-reduction', result);
	log(`\nresult artifact: ${artifactPath}`);

	if (!verified) {
		console.error('FAIL: one or more read-back checks did not pass.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
