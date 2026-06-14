/**
 * probe-slice3-list-visibility-definitive-2026-06-14.ts
 *
 * DEFINITIVE probe for the Slice 3 LIST-visibility gating question:
 *   Does a _viewer-granted private `application` appear in a non-omniscient org admin's LIST query?
 *
 * Requires TWO API keys via env vars:
 *   ENTU_API_KEY           — PO's key (db-owner, used for setup + teardown only)
 *   ENTU_ADMIN_KEY         — second OAuth account's entu_api_key (the non-omniscient admin)
 *
 * Setup: after the second account logs in via https://entu.app with their Google account
 * and selects the polyphony db, a person entity is auto-created. PO then adds an
 * entu_api_key property to that person entity (Pérotin does this under the PO key after
 * receiving the new person entity _id from the before/after person-list diff). The raw
 * key value is set as ENTU_ADMIN_KEY in credentials.env before running this script.
 *
 * Probe design:
 *   - Admin identity: second OAuth account, granted _owner on EFK by PO before probe run
 *   - Singer identity: synthesized — PO creates _probe_singer_person (private, no-inherit)
 *     and _probe_app_viewer_test (private, under singer person)
 *   - PO explicit _owner removed from app — but Entu blocks last-owner deletion.
 *     Instead: the admin is NOT PO, so the admin's rights come solely from the _viewer grant
 *     (or not). The admin is non-omniscient (not on DB root _viewer list).
 *
 * Questions answered:
 *   Q1: Does admin's LIST return _viewer-granted private app? (by target_org, unfiltered, by _viewer.ref)
 *   Q2: Can the new (non-member) admin account read the org's _owner list?
 *       (gating question for approach 3: singer needs to enumerate admin persons to grant _viewer to them)
 *
 * Negative controls:
 *   - BEFORE _viewer grant: admin sees nothing (confirms non-omniscience)
 *   - AFTER _viewer grant: check each LIST variant
 *
 * Authorization: team-lead "I authorize this run" (required — gate applies even with prep done)
 * Cleanup: all _probe_* entities, entu_api_key props, EFK _owner grant — confirmed 404/deleted.
 *
 * (*MVOX:Perotin*)
 */

import {
	getJwt,
	createEntity,
	fetchEntity,
	listEntities,
	postProperties,
	deletePropertyValue,
	deleteEntity,
	POLYPHONY_DB_ENTITY_ID,
} from '../lib/entu-client.ts';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? 'polyphony';
const PO_API_KEY = process.env.ENTU_API_KEY ?? '';
const ADMIN_API_KEY = process.env.ENTU_ADMIN_KEY ?? '';

if (!PO_API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source credentials.env first.');
	process.exit(1);
}
if (!ADMIN_API_KEY) {
	console.error('ERROR: ENTU_ADMIN_KEY not set. Add the second account key to credentials.env.');
	process.exit(1);
}

// Known entity IDs (confirmed live from prior probes)
const APPLICATION_TYPE_ID = '6a0d2e8390c8df7a1cc7de81';
const PERSON_TYPE_ID = '69bcfd8e9c031ab8e6ce805f';
const EFK_ORG_ID = '69c7f8718489bfcb0e81b065';
const PO_PERSON_ID = '69bcfd8e9c031ab8e6ce8079';

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);

interface ProbeResult {
	timestamp: string;

	// Identity verification
	poAccountsBound: boolean;
	adminAccountsBound: boolean;
	adminPersonId: string | null;
	adminOnDbRootViewer: boolean; // must be FALSE for clean probe

	// Q2: can non-member admin read org _owner list?
	q2_adminCanReadEfkOrg: boolean;
	q2_adminSeesOwnerList: boolean;
	q2_efkOwnerRefs: string[];

	// Setup
	efkOwnerGrantPropValueId: string | null; // _id of the _owner grant we add to EFK for admin
	probeSingerPersonId: string | null;
	probeAppId: string | null;
	appSharingAfterCreate: string;

	// Negative control (before _viewer grant)
	nc_adminGetById: { httpStatus: number | 'error' };
	nc_adminListByTargetOrg: { count: number; appFound: boolean };
	nc_adminListUnfiltered: { count: number; appFound: boolean };
	nc_adminListByViewerRef: { count: number; appFound: boolean };

	// _viewer grant
	viewerGrantSuccess: boolean;
	viewerGrantPropValueId: string | null;

	// Positive test (after _viewer grant)
	pt_adminGetById: { httpStatus: number | 'error'; entityFound: boolean };
	pt_adminListByTargetOrg: { count: number; appFound: boolean };
	pt_adminListUnfiltered: { count: number; appFound: boolean };
	pt_adminListByViewerRef: { count: number; appFound: boolean };

	// Teardown
	teardownEfkOwnerGrantRemoved: boolean;
	teardownConfirmed404_app: boolean;
	teardownConfirmed404_singerPerson: boolean;
	teardownAdminKeyPropRemoved: boolean;

	// Verdict
	q1_verdict: string;
	q2_verdict: string;
	confidenceLevel: 'HIGH' | 'MEDIUM' | 'INCONCLUSIVE';
}

async function tryFetchHttpStatus(jwt: string, entityId: string): Promise<number | 'error'> {
	try {
		const url = `${API_BASE}/${DB}/entity/${entityId}`;
		const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
		return res.status;
	} catch {
		return 'error';
	}
}

async function tryListApps(jwt: string, extraQuery: Record<string, string> = {}): Promise<{ count: number; entities: Array<{ _id: string }> }> {
	try {
		const params = new URLSearchParams({ '_type.string': 'application', limit: '100', ...extraQuery });
		const url = `${API_BASE}/${DB}/entity?${params}`;
		const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
		if (!res.ok) return { count: 0, entities: [] };
		const body = (await res.json()) as { entities?: Array<{ _id: string }>; count?: number };
		return { count: body.count ?? 0, entities: body.entities ?? [] };
	} catch {
		return { count: 0, entities: [] };
	}
}

async function main(): Promise<void> {
	const result: ProbeResult = {
		timestamp: new Date().toISOString(),
		poAccountsBound: false,
		adminAccountsBound: false,
		adminPersonId: null,
		adminOnDbRootViewer: false,
		q2_adminCanReadEfkOrg: false,
		q2_adminSeesOwnerList: false,
		q2_efkOwnerRefs: [],
		efkOwnerGrantPropValueId: null,
		probeSingerPersonId: null,
		probeAppId: null,
		appSharingAfterCreate: 'UNKNOWN',
		nc_adminGetById: { httpStatus: 'error' },
		nc_adminListByTargetOrg: { count: 0, appFound: false },
		nc_adminListUnfiltered: { count: 0, appFound: false },
		nc_adminListByViewerRef: { count: 0, appFound: false },
		viewerGrantSuccess: false,
		viewerGrantPropValueId: null,
		pt_adminGetById: { httpStatus: 'error', entityFound: false },
		pt_adminListByTargetOrg: { count: 0, appFound: false },
		pt_adminListUnfiltered: { count: 0, appFound: false },
		pt_adminListByViewerRef: { count: 0, appFound: false },
		teardownEfkOwnerGrantRemoved: false,
		teardownConfirmed404_app: false,
		teardownConfirmed404_singerPerson: false,
		teardownAdminKeyPropRemoved: false,
		q1_verdict: 'NOT RUN',
		q2_verdict: 'NOT RUN',
		confidenceLevel: 'INCONCLUSIVE',
	};

	// ── Step 0: PO JWT ────────────────────────────────────────────
	section('Step 0: PO identity verification');
	const poAuthUrl = `${API_BASE}/auth?db=${DB}`;
	const poAuthRes = await fetch(poAuthUrl, { headers: { Authorization: `Bearer ${PO_API_KEY}` } });
	const poAuthBody = (await poAuthRes.json()) as { token: string; accounts: Array<{ _id: string }> };
	const poJwt = poAuthBody.token;
	result.poAccountsBound = (poAuthBody.accounts ?? []).some(a => a._id === DB);
	log(`PO accountsBound: ${result.poAccountsBound}`);
	if (!result.poAccountsBound) { console.error('PO JWT invalid — aborting'); process.exit(1); }

	const poClient = { apiBase: API_BASE, db: DB, jwt: poJwt };

	// ── Step 1: Admin JWT ─────────────────────────────────────────
	section('Step 1: Admin identity verification');
	const adminAuthUrl = `${API_BASE}/auth?db=${DB}`;
	const adminAuthRes = await fetch(adminAuthUrl, { headers: { Authorization: `Bearer ${ADMIN_API_KEY}` } });
	const adminAuthBody = (await adminAuthRes.json()) as { token: string; accounts: Array<{ _id: string; user?: { _id: string } }> };
	const adminJwt = adminAuthBody.token;
	const adminAccounts = adminAuthBody.accounts ?? [];
	result.adminAccountsBound = adminAccounts.some(a => a._id === DB);
	log(`Admin accountsBound: ${result.adminAccountsBound}`);

	if (!result.adminAccountsBound) {
		console.error('ADMIN JWT has no accounts — the second OAuth account may not be linked to polyphony. Aborting.');
		process.exit(1);
	}

	// Find admin's person ID from accounts
	const adminAccount = adminAccounts.find(a => a._id === DB);
	result.adminPersonId = adminAccount?.user?._id ?? null;
	log(`Admin person ID: ${result.adminPersonId}`);

	if (!result.adminPersonId) {
		console.error('Cannot determine admin person ID from auth response. Aborting.');
		process.exit(1);
	}

	// Verify admin is NOT on DB root viewer list (confirms non-omniscience)
	const adminClient = { apiBase: API_BASE, db: DB, jwt: adminJwt };
	const dbEntity = await fetchEntity(poClient, POLYPHONY_DB_ENTITY_ID);
	const dbViewers = (dbEntity._viewer as Array<{ reference: string }> | undefined) ?? [];
	result.adminOnDbRootViewer = dbViewers.some(v => v.reference === result.adminPersonId);
	log(`Admin on DB root _viewer: ${result.adminOnDbRootViewer}`);
	if (result.adminOnDbRootViewer) {
		console.error('WARNING: Admin is on DB root viewer list — this would contaminate the probe. Aborting.');
		process.exit(1);
	}
	log('Admin confirmed NOT on DB root viewer list — probe is uncontaminated.');

	// ── Step 2: Q2 — can admin read org _owner list? ─────────────
	section('Step 2: Q2 — admin reads EFK org _owner list (BEFORE being granted org _owner)');
	// EFK is domain-shared — any authenticated user should be able to read it
	// but the _owner list visibility depends on Entu's rights model
	try {
		const efkStatus = await tryFetchHttpStatus(adminJwt, EFK_ORG_ID);
		result.q2_adminCanReadEfkOrg = efkStatus === 200;
		log(`Admin GET EFK org: HTTP ${efkStatus}`);

		if (efkStatus === 200) {
			const efkUrl = `${API_BASE}/${DB}/entity/${EFK_ORG_ID}`;
			const efkRes = await fetch(efkUrl, { headers: { Authorization: `Bearer ${adminJwt}` } });
			const efkBody = (await efkRes.json()) as { entity?: Record<string, unknown> };
			const efkEntity = efkBody.entity ?? {};
			const efkOwners = efkEntity._owner as Array<{ reference: string; string: string }> | undefined;
			result.q2_adminSeesOwnerList = (efkOwners?.length ?? 0) > 0;
			result.q2_efkOwnerRefs = (efkOwners ?? []).map(o => `${o.string}(${o.reference})`);
			log(`Admin sees EFK _owner list: ${result.q2_adminSeesOwnerList}`);
			log(`EFK owners visible to admin: ${JSON.stringify(result.q2_efkOwnerRefs)}`);
		}
	} catch (e) {
		log(`Q2 read failed: ${e}`);
	}

	// ── Step 3: Grant admin _owner on EFK ────────────────────────
	section('Step 3: Grant admin person _owner on EFK (PO key)');
	await postProperties(poClient, EFK_ORG_ID, [
		{ type: '_owner', reference: result.adminPersonId },
	]);
	// Find the prop value _id for cleanup
	const efkEntityAfterGrant = await fetchEntity(poClient, EFK_ORG_ID);
	const efkOwners = efkEntityAfterGrant._owner as Array<{ reference: string; _id: string }> | undefined;
	const adminOwnerProp = efkOwners?.find(o => o.reference === result.adminPersonId);
	result.efkOwnerGrantPropValueId = adminOwnerProp?._id ?? null;
	log(`EFK _owner grant added; prop value _id: ${result.efkOwnerGrantPropValueId}`);

	// ── Step 4: Create probe singer person ────────────────────────
	section('Step 4: Create _probe_singer_person (private, no-inherit)');
	const singerPerson = await createEntity(poClient, [
		{ type: '_type', reference: PERSON_TYPE_ID },
		{ type: '_sharing', string: 'private' },
		{ type: '_inheritrights', boolean: false },
		{ type: 'name', string: '_probe_singer — teardown me' },
	]);
	result.probeSingerPersonId = singerPerson._id;
	log(`singer person: ${result.probeSingerPersonId}`);

	// ── Step 5: Create probe application ─────────────────────────
	section('Step 5: Create _probe_app_viewer_test application');
	const probeApp = await createEntity(poClient, [
		{ type: '_type', reference: APPLICATION_TYPE_ID },
		{ type: '_parent', reference: result.probeSingerPersonId },
		{ type: 'target_org', reference: EFK_ORG_ID },
		{ type: 'status', string: 'pending' },
		{ type: 'expires_at', string: '2026-07-01' },
		{ type: 'message', string: '_probe_app_viewer_test — teardown me' },
	]);
	result.probeAppId = probeApp._id;
	log(`probe app: ${result.probeAppId}`);

	const appEntity = await fetchEntity(poClient, result.probeAppId);
	const appSharing = appEntity._sharing as Array<{ string: string }> | undefined;
	result.appSharingAfterCreate = appSharing?.[0]?.string ?? 'ABSENT (private default)';
	const appOwners = appEntity._owner as Array<{ reference: string; string: string }> | undefined;
	log(`app _sharing: ${result.appSharingAfterCreate}`);
	log(`app _owner: ${JSON.stringify(appOwners?.map(o => `${o.string}(${o.reference})`))}`);

	// ── Step 6: NEGATIVE CONTROL ──────────────────────────────────
	section('Step 6: NEGATIVE CONTROL — admin reads before _viewer grant');

	result.nc_adminGetById.httpStatus = await tryFetchHttpStatus(adminJwt, result.probeAppId);
	log(`admin GET-by-id before grant: HTTP ${result.nc_adminGetById.httpStatus}`);

	const ncListByTargetOrg = await tryListApps(adminJwt, { 'target_org.reference': EFK_ORG_ID });
	result.nc_adminListByTargetOrg = { count: ncListByTargetOrg.count, appFound: ncListByTargetOrg.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST ?target_org=EFK before grant: count=${ncListByTargetOrg.count} appFound=${result.nc_adminListByTargetOrg.appFound}`);

	const ncListUnfiltered = await tryListApps(adminJwt);
	result.nc_adminListUnfiltered = { count: ncListUnfiltered.count, appFound: ncListUnfiltered.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST (unfiltered) before grant: count=${ncListUnfiltered.count} appFound=${result.nc_adminListUnfiltered.appFound}`);

	const ncListByViewerRef = await tryListApps(adminJwt, { '_viewer.reference': result.adminPersonId });
	result.nc_adminListByViewerRef = { count: ncListByViewerRef.count, appFound: ncListByViewerRef.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST ?_viewer.ref=admin before grant: count=${ncListByViewerRef.count} appFound=${result.nc_adminListByViewerRef.appFound}`);

	// Sanity: confirm negative control is clean (admin sees nothing)
	if (result.nc_adminGetById.httpStatus === 200 || result.nc_adminListByTargetOrg.appFound || result.nc_adminListUnfiltered.appFound) {
		log('WARNING: Admin can already see the app BEFORE the _viewer grant — negative control FAILED. Probe may be contaminated.');
	} else {
		log('Negative control PASS — admin cannot see app before grant.');
	}

	// ── Step 7: Grant _viewer to admin person ─────────────────────
	section('Step 7: Grant _viewer on probe app to admin person (PO key)');
	try {
		await postProperties(poClient, result.probeAppId, [
			{ type: '_viewer', reference: result.adminPersonId },
		]);
		result.viewerGrantSuccess = true;
		log('_viewer grant succeeded');

		// Capture the prop value _id for teardown
		const appEntityAfterGrant = await fetchEntity(poClient, result.probeAppId);
		const viewerProps = appEntityAfterGrant._viewer as Array<{ reference: string; _id: string }> | undefined;
		const adminViewerProp = viewerProps?.find(v => v.reference === result.adminPersonId);
		result.viewerGrantPropValueId = adminViewerProp?._id ?? null;
		log(`_viewer prop value _id: ${result.viewerGrantPropValueId}`);
	} catch (e) {
		log(`_viewer grant FAILED: ${e}`);
	}

	// ── Step 8: POSITIVE TEST ────────────────────────────────────
	section('Step 8: POSITIVE TEST — admin reads after _viewer grant');

	const ptStatus = await tryFetchHttpStatus(adminJwt, result.probeAppId);
	result.pt_adminGetById = { httpStatus: ptStatus, entityFound: ptStatus === 200 };
	log(`admin GET-by-id after grant: HTTP ${ptStatus} found=${result.pt_adminGetById.entityFound}`);

	const ptListByTargetOrg = await tryListApps(adminJwt, { 'target_org.reference': EFK_ORG_ID });
	result.pt_adminListByTargetOrg = { count: ptListByTargetOrg.count, appFound: ptListByTargetOrg.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST ?target_org=EFK after grant: count=${ptListByTargetOrg.count} appFound=${result.pt_adminListByTargetOrg.appFound}`);

	const ptListUnfiltered = await tryListApps(adminJwt);
	result.pt_adminListUnfiltered = { count: ptListUnfiltered.count, appFound: ptListUnfiltered.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST (unfiltered) after grant: count=${ptListUnfiltered.count} appFound=${result.pt_adminListUnfiltered.appFound}`);

	const ptListByViewerRef = await tryListApps(adminJwt, { '_viewer.reference': result.adminPersonId });
	result.pt_adminListByViewerRef = { count: ptListByViewerRef.count, appFound: ptListByViewerRef.entities.some(e => e._id === result.probeAppId) };
	log(`admin LIST ?_viewer.ref=admin after grant: count=${ptListByViewerRef.count} appFound=${result.pt_adminListByViewerRef.appFound}`);

	// ── Step 9: Verdicts ──────────────────────────────────────────
	section('Step 9: Verdicts');

	const ncClean = result.nc_adminGetById.httpStatus !== 200 && !result.nc_adminListByTargetOrg.appFound && !result.nc_adminListUnfiltered.appFound;

	if (!ncClean) {
		result.q1_verdict = 'CONTAMINATED — admin saw app before _viewer grant; negative control failed';
		result.confidenceLevel = 'INCONCLUSIVE';
	} else if (!result.viewerGrantSuccess) {
		result.q1_verdict = '_viewer grant failed — no positive test possible';
		result.confidenceLevel = 'INCONCLUSIVE';
	} else if (result.pt_adminListByTargetOrg.appFound) {
		result.q1_verdict = 'YES — LIST by target_org returns _viewer-granted private app. Approach 3 zero-schema-change viable.';
		result.confidenceLevel = 'HIGH';
	} else if (result.pt_adminListByViewerRef.appFound) {
		result.q1_verdict = 'PARTIAL — app NOT in LIST by target_org, but IS in LIST by _viewer.reference. Admin can discover own grants but not by org filter. Additive mechanism needed.';
		result.confidenceLevel = 'HIGH';
	} else if (result.pt_adminGetById.entityFound) {
		result.q1_verdict = 'NO LIST — app visible via GET-by-id only. LIST is completely blind to _viewer-granted private entities. Additive discovery mechanism required.';
		result.confidenceLevel = 'HIGH';
	} else {
		result.q1_verdict = 'NO VISIBILITY — _viewer grant did not make entity visible even via GET-by-id. Grant mechanics may require re-check.';
		result.confidenceLevel = 'MEDIUM';
	}

	result.q2_verdict = result.q2_adminSeesOwnerList
		? `YES — admin (non-member) can read EFK _owner list from domain-shared org entity. Singer can enumerate admin person IDs at application-create time. Owners seen: ${result.q2_efkOwnerRefs.join(', ')}`
		: result.q2_adminCanReadEfkOrg
			? 'PARTIAL — admin can read org entity but _owner list is absent from response (rights not returned at this level). Singer cannot enumerate admins without elevated access.'
			: 'NO — admin cannot even read the org entity. Singer cannot enumerate admins.';

	log(`Q1: ${result.q1_verdict}`);
	log(`Q2: ${result.q2_verdict}`);
	log(`Confidence: ${result.confidenceLevel}`);

	// ── Teardown ──────────────────────────────────────────────────
	section('Teardown');

	// Remove _viewer prop from app (before deleting app)
	if (result.viewerGrantPropValueId) {
		try {
			await deletePropertyValue(poClient, result.viewerGrantPropValueId);
			log(`deleted _viewer grant prop (${result.viewerGrantPropValueId})`);
		} catch (e) { log(`_viewer grant prop delete failed: ${e}`); }
	}

	// Delete probe app
	if (result.probeAppId) {
		try {
			await deleteEntity(poClient, result.probeAppId);
			const status = await tryFetchHttpStatus(poJwt, result.probeAppId);
			result.teardownConfirmed404_app = status === 404;
			log(`probe app deleted; 404 confirmed: ${result.teardownConfirmed404_app}`);
		} catch (e) { log(`probe app delete failed: ${e}`); }
	}

	// Delete probe singer person
	if (result.probeSingerPersonId) {
		try {
			await deleteEntity(poClient, result.probeSingerPersonId);
			const status = await tryFetchHttpStatus(poJwt, result.probeSingerPersonId);
			result.teardownConfirmed404_singerPerson = status === 404;
			log(`probe singer person deleted; 404 confirmed: ${result.teardownConfirmed404_singerPerson}`);
		} catch (e) { log(`probe singer person delete failed: ${e}`); }
	}

	// Remove admin's _owner grant on EFK
	if (result.efkOwnerGrantPropValueId) {
		try {
			await deletePropertyValue(poClient, result.efkOwnerGrantPropValueId);
			result.teardownEfkOwnerGrantRemoved = true;
			log(`EFK admin _owner grant removed (prop ${result.efkOwnerGrantPropValueId})`);
		} catch (e) { log(`EFK _owner grant removal failed: ${e}`); }
	}

	// Remove admin entu_api_key from their person (PO added it, PO can remove it)
	// We need to find the prop _id — fetch admin person via PO jwt
	try {
		const adminPersonEntity = await fetchEntity(poClient, result.adminPersonId!);
		const apiKeyProps = adminPersonEntity.entu_api_key as Array<{ _id: string }> | undefined;
		if (apiKeyProps && apiKeyProps.length > 0) {
			for (const kp of apiKeyProps) {
				await deletePropertyValue(poClient, kp._id);
				log(`deleted admin entu_api_key prop (${kp._id})`);
			}
			result.teardownAdminKeyPropRemoved = true;
		} else {
			log('No entu_api_key props found on admin person (already clean or not added by this script)');
			result.teardownAdminKeyPropRemoved = true; // nothing to remove
		}
	} catch (e) { log(`admin key prop removal failed: ${e}`); }

	const teardownOk = result.teardownConfirmed404_app && result.teardownConfirmed404_singerPerson && result.teardownEfkOwnerGrantRemoved;
	log(`Teardown complete: ${teardownOk}`);

	// ── Write result artifact ─────────────────────────────────────
	section('Writing result artifact');
	const { mkdirSync, writeFileSync } = await import('fs');
	const resultsDir = new URL('../seed-results/', import.meta.url).pathname;
	mkdirSync(resultsDir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const artifactPath = `${resultsDir}probe-slice3-list-visibility-definitive-${ts}.json`;
	writeFileSync(artifactPath, JSON.stringify(result, null, 2));
	log(`Result artifact: ${artifactPath}`);

	if (!teardownOk) {
		console.error('ERROR: Teardown incomplete — check polyphony db manually for lingering probe entities.');
		process.exit(1);
	}

	process.exit(0);
}

main().catch(e => {
	console.error('FATAL:', e);
	process.exit(1);
});
