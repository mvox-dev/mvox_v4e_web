/**
 * probe-slice3-invite-join-2026-06-14.ts
 *
 * Phase 0 live probes for Slice 3 (invite & join).
 * Answers three questions:
 *   A) Live shapes for invitation, application, member type-defs + instances
 *   B) Accept-identity decision: path A (application under own person) vs path B
 *   C) Org-service key rights feasibility + minimum-rights spec
 *
 * Authorization: team-lead dispatch 2026-06-14 — read probes freely +
 * reversible single-instance write probes on polyphony using _probe_* names.
 * Cleans up all _probe_* entities before reporting.
 *
 * Does NOT modify any real (non-probe) entity.
 * Does NOT provision any CF secret.
 * Does NOT create the application type-def (only checks if it exists).
 *
 * (*MVOX:Perotin*)
 */

import {
	getJwt,
	createEntity,
	fetchEntity,
	listEntities,
	listInstancesByType,
	deleteEntity,
	postProperties,
	deletePropertyValue,
	POLYPHONY_META_TYPE_ENTITY_ID,
} from '../lib/entu-client.ts';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source credentials.env first.');
	process.exit(1);
}

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);

// ────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────

interface TypeLookupResult {
	found: boolean;
	typeId?: string;
	raw?: Record<string, unknown>;
}

async function findTypeByName(
	jwt: string,
	typeName: string,
): Promise<TypeLookupResult> {
	const res = await listEntities(
		{ apiBase: API_BASE, db: DB, jwt },
		{
			'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
			'name.string': typeName,
			props: '_id,name,_sharing,_owner,_editor,_viewer',
			limit: '5',
		},
	);
	if (res.count === 0) return { found: false };
	const ent = res.entities[0] as Record<string, unknown>;
	return { found: true, typeId: ent._id as string, raw: ent };
}

async function fetchTypeDetails(
	jwt: string,
	typeId: string,
): Promise<Record<string, unknown>> {
	// Fetch the type entity and its prop-def children
	const typeEnt = await fetchEntity({ apiBase: API_BASE, db: DB, jwt }, typeId);
	// Also fetch prop-defs (children of the type entity)
	const propDefs = await listEntities(
		{ apiBase: API_BASE, db: DB, jwt },
		{
			'_parent.reference': typeId,
			'_type.reference': '69bcfd8e9c031ab8e6ce8048', // _property meta type
			props: 'name,type,formula,_sharing,mandatory,list',
			limit: '100',
		},
	);
	return { typeEntity: typeEnt, propDefs: propDefs.entities, propDefCount: propDefs.count };
}

// ────────────────────────────────────────────────────────────────
// main
// ────────────────────────────────────────────────────────────────

const probeEntitiesCreated: string[] = [];

async function main() {
	log(`Auth: exchanging API key for JWT (db=${DB})...`);
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	log('Auth OK. JWT obtained.');

	// Verify accounts binding
	const authCheckRes = await fetch(
		`${API_BASE}/auth?db=${encodeURIComponent(DB)}`,
		{ headers: { Authorization: `Bearer ${API_KEY}` } },
	);
	const authCheck = await authCheckRes.json() as { accounts?: unknown[] };
	if (!authCheck.accounts || authCheck.accounts.length === 0) {
		console.error('ERROR: API key returned accounts:[] — key may be rotated. Check Entu UI.');
		process.exit(1);
	}
	log(`Accounts bound: ${JSON.stringify(authCheck.accounts)}`);

	const client = { apiBase: API_BASE, db: DB, jwt };

	// ──────────────────────────────────────────────────────────────
	// SECTION A — Live shapes: invitation, application, member
	// ──────────────────────────────────────────────────────────────
	section('A) TYPE-DEF SHAPES: invitation, application, member');

	// A1: invitation type
	log('Looking up invitation type-def...');
	const invitationLookup = await findTypeByName(jwt, 'invitation');
	let invitationTypeId: string | undefined;
	let invitationPropDefs: unknown[] = [];
	if (invitationLookup.found && invitationLookup.typeId) {
		invitationTypeId = invitationLookup.typeId;
		log(`invitation type found: ${invitationTypeId}`);
		const details = await fetchTypeDetails(jwt, invitationTypeId);
		invitationPropDefs = (details.propDefs ?? []) as unknown[];
		const typeEnt = details.typeEntity as Record<string, unknown>;
		log(`invitation type-def _sharing: ${JSON.stringify(typeEnt._sharing ?? 'ABSENT')}`);
		log(`invitation prop-def count: ${details.propDefCount}`);
		log(`invitation prop-defs:\n${JSON.stringify(invitationPropDefs, null, 2)}`);
	} else {
		log('WARNING: invitation type NOT FOUND in polyphony');
	}

	// A2: application type
	log('\nLooking up application type-def...');
	const applicationLookup = await findTypeByName(jwt, 'application');
	let applicationTypeId: string | undefined;
	let applicationPropDefs: unknown[] = [];
	if (applicationLookup.found && applicationLookup.typeId) {
		applicationTypeId = applicationLookup.typeId;
		log(`application type found: ${applicationTypeId}`);
		const details = await fetchTypeDetails(jwt, applicationTypeId);
		applicationPropDefs = (details.propDefs ?? []) as unknown[];
		const typeEnt = details.typeEntity as Record<string, unknown>;
		log(`application type-def _sharing: ${JSON.stringify(typeEnt._sharing ?? 'ABSENT')}`);
		log(`application prop-def count: ${details.propDefCount}`);
		log(`application prop-defs:\n${JSON.stringify(applicationPropDefs, null, 2)}`);
	} else {
		log('WARNING: application type NOT FOUND in polyphony — will need type-def-create decision');
	}

	// A3: member type
	log('\nLooking up member type-def...');
	const memberLookup = await findTypeByName(jwt, 'member');
	let memberTypeId: string | undefined;
	let memberPropDefs: unknown[] = [];
	if (memberLookup.found && memberLookup.typeId) {
		memberTypeId = memberLookup.typeId;
		log(`member type found: ${memberTypeId} (cross-check: expect ${process.env.ENTU_MEMBER_TYPE_ID})`);
		const details = await fetchTypeDetails(jwt, memberTypeId);
		memberPropDefs = (details.propDefs ?? []) as unknown[];
		const typeEnt = details.typeEntity as Record<string, unknown>;
		log(`member type-def _sharing: ${JSON.stringify(typeEnt._sharing ?? 'ABSENT')}`);
		log(`member prop-def count: ${details.propDefCount}`);
		log(`member prop-defs:\n${JSON.stringify(memberPropDefs, null, 2)}`);
	} else {
		log('WARNING: member type NOT FOUND in polyphony');
	}

	// A4: sample member instances (multi-parent shape, person ref, status)
	log('\nFetching 3 sample member instances to observe multi-parent shape...');
	const memberInstances = await listInstancesByType(
		client,
		'member',
		'_parent,person,status,_sharing,_owner',
		3,
	);
	log(`member instance count: ${memberInstances.count}`);
	log(`first 3 member instances:\n${JSON.stringify(memberInstances.entities.slice(0, 3), null, 2)}`);

	// A5: sample invitation instances (if any exist)
	log('\nFetching invitation instances (if any exist)...');
	const invitationInstances = await listInstancesByType(
		client,
		'invitation',
		'_parent,email,token,expires_at,inviter,sections,message,_sharing',
		5,
	);
	log(`invitation instance count: ${invitationInstances.count}`);
	if (invitationInstances.count > 0) {
		log(`sample invitation instances:\n${JSON.stringify(invitationInstances.entities.slice(0, 2), null, 2)}`);
	}

	// A6: sample application instances (if any exist)
	log('\nFetching application instances (if any exist)...');
	const applicationInstances = await listInstancesByType(
		client,
		'application',
		'_parent,person,status,_sharing,_owner',
		5,
	);
	log(`application instance count: ${applicationInstances.count}`);
	if (applicationInstances.count > 0) {
		log(`sample application instances:\n${JSON.stringify(applicationInstances.entities.slice(0, 2), null, 2)}`);
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION B — rsvp precedent (application creator rule analog)
	// ──────────────────────────────────────────────────────────────
	section('B) RSVP PRECEDENT: creator rule & parent rule');

	// B1: fetch the rsvp type to confirm its parent/creator model
	log('Looking up rsvp type-def for precedent comparison...');
	const rsvpLookup = await findTypeByName(jwt, 'rsvp');
	if (rsvpLookup.found && rsvpLookup.typeId) {
		const details = await fetchTypeDetails(jwt, rsvpLookup.typeId);
		log(`rsvp prop-def count: ${details.propDefCount}`);
		log(`rsvp prop-defs:\n${JSON.stringify(details.propDefs, null, 2)}`);
		// Sample rsvp instances to see _parent shape
		const rsvpInstances = await listInstancesByType(
			client,
			'rsvp',
			'_parent,event,member,status,_sharing,_owner',
			2,
		);
		log(`rsvp instance count: ${rsvpInstances.count}`);
		if (rsvpInstances.count > 0) {
			log(`sample rsvp instances:\n${JSON.stringify(rsvpInstances.entities, null, 2)}`);
		}
	} else {
		log('rsvp type NOT FOUND');
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION C — Write probes: org-service key rights feasibility
	// ──────────────────────────────────────────────────────────────
	section('C) ORG-SERVICE KEY RIGHTS FEASIBILITY');

	// Our existing API key credentials represent the PO person entity (org _owner).
	// That IS an elevated credential — owner of all 4 collectives.
	// This models what an "org-service key" would be (BFF service account with
	// elevated rights in the org subtree).

	// C1: Confirm we can read a private entity (org entity with _inheritrights=false)
	log('C1: Can we read org entities (private, _inheritrights=false)?');
	const orgs = await listInstancesByType(
		client,
		'organization',
		'_id,name,_sharing,_inheritrights',
		3,
	);
	log(`org count: ${orgs.count}`);
	log(`sample org: ${JSON.stringify(orgs.entities[0], null, 2)}`);

	// C2: Create a probe invitation entity under an org (simulates BFF creating invite)
	// We need to find an org to use as parent
	const targetOrgId = (orgs.entities[0] as Record<string, unknown>)._id as string;
	log(`\nC2: Create _probe_ invitation under org ${targetOrgId}...`);

	if (!invitationTypeId) {
		log('SKIP C2: invitation type-def not found — cannot create probe invitation');
	} else {
		try {
			const probeInvite = await createEntity(client, [
				{ type: '_type', reference: invitationTypeId },
				{ type: '_parent', reference: targetOrgId },
				{ type: '_sharing', string: 'private' },
				{ type: 'email', string: '_probe_invite@example.ee' },
				{ type: 'token', string: '_probe_token_abc123' },
				{ type: 'expires_at', string: '2026-07-01' },
			]);
			probeEntitiesCreated.push(probeInvite._id);
			log(`Probe invitation created: ${probeInvite._id}`);

			// C3: Read it back — confirm org-owner can read a private invitation
			const readBack = await fetchEntity(client, probeInvite._id);
			log(`C3: Read back probe invitation OK: _sharing=${JSON.stringify((readBack as Record<string, unknown>)._sharing ?? 'ABSENT')}`);
			log(`Probe invitation props: ${JSON.stringify(readBack, null, 2)}`);
		} catch (e) {
			log(`C2/C3 FAILED: ${String(e)}`);
		}
	}

	// C4: Create a probe member with multi-parent (org + section)
	// Find a section to use as second parent
	log('\nC4: Create _probe_ member with multi-parent (org + section)...');
	const sections = await listInstancesByType(
		client,
		'section',
		'_id,name,_parent',
		2,
	);
	log(`section count: ${sections.count}`);
	const targetSectionId = sections.count > 0
		? (sections.entities[0] as Record<string, unknown>)._id as string
		: undefined;

	// Find a person entity for the member reference (use existing Test User)
	const persons = await listInstancesByType(
		client,
		'person',
		'_id,name',
		2,
		{ 'name.string': 'Test User' },
	);
	const testPersonId = persons.count > 0
		? (persons.entities[0] as Record<string, unknown>)._id as string
		: undefined;
	log(`Test User person: ${testPersonId ?? 'NOT FOUND'}`);

	if (memberTypeId && testPersonId) {
		try {
			// First POST: create member under org
			const probeMember = await createEntity(client, [
				{ type: '_type', reference: memberTypeId },
				{ type: '_parent', reference: targetOrgId },
				{ type: '_sharing', string: 'private' },
				{ type: 'person', reference: testPersonId },
				{ type: 'status', string: '_probe_active' },
			]);
			probeEntitiesCreated.push(probeMember._id);
			log(`Probe member created (under org): ${probeMember._id}`);

			// Second POST: add section as second parent
			if (targetSectionId) {
				log(`C4b: Adding section ${targetSectionId} as second parent...`);
				await postProperties(client, probeMember._id, [
					{ type: '_parent', reference: targetSectionId },
				]);
				log('C4b: Second parent posted OK');

				// Read back to confirm multi-parent
				const memberReadBack = await fetchEntity(client, probeMember._id);
				const mb = memberReadBack as Record<string, unknown>;
				log(`C4b probe member _parent: ${JSON.stringify(mb._parent ?? 'ABSENT')}`);
				log(`C4b probe member full: ${JSON.stringify(memberReadBack, null, 2)}`);
			}
		} catch (e) {
			log(`C4 FAILED: ${String(e)}`);
		}
	} else {
		log(`SKIP C4: memberTypeId=${memberTypeId}, testPersonId=${testPersonId}`);
	}

	// C5: Test delete capability on probe entities — simulate invitation.delete + application.delete
	// (we'll delete them in cleanup anyway, so this IS the feasibility check)
	log('\nC5: Delete capability will be confirmed during cleanup below.');

	// ──────────────────────────────────────────────────────────────
	// CLEANUP — Delete all probe entities
	// ──────────────────────────────────────────────────────────────
	section('CLEANUP: deleting all _probe_* entities');
	let cleanupOk = true;
	for (const probeId of probeEntitiesCreated) {
		try {
			await deleteEntity(client, probeId);
			log(`Deleted probe entity: ${probeId}`);
		} catch (e) {
			log(`ERROR deleting probe entity ${probeId}: ${String(e)}`);
			cleanupOk = false;
		}
	}
	// Verify deletions
	for (const probeId of probeEntitiesCreated) {
		try {
			await fetchEntity(client, probeId);
			log(`WARNING: probe entity ${probeId} still exists after DELETE`);
			cleanupOk = false;
		} catch {
			log(`Confirmed 404 on deleted probe: ${probeId}`);
		}
	}

	if (cleanupOk) {
		log('CLEANUP COMPLETE — all probe entities deleted and verified 404');
	} else {
		log('WARNING: some cleanup steps failed — manual inspection needed');
	}

	// ──────────────────────────────────────────────────────────────
	// SUMMARY
	// ──────────────────────────────────────────────────────────────
	section('SUMMARY');
	console.log(JSON.stringify({
		timestamp: new Date().toISOString(),
		db: DB,
		typeIds: {
			invitation: invitationTypeId ?? null,
			application: applicationTypeId ?? null,
			member: memberTypeId ?? null,
		},
		counts: {
			invitation: invitationInstances.count,
			application: applicationInstances.count,
			member: memberInstances.count,
		},
		propDefCounts: {
			invitation: invitationPropDefs.length,
			application: applicationPropDefs.length,
			member: memberPropDefs.length,
		},
		cleanupOk,
		probeEntitiesCreated: probeEntitiesCreated.length,
	}, null, 2));
}

main().catch((e) => {
	console.error('PROBE FAILED:', e);
	process.exit(1);
});
