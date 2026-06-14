/**
 * probe-slice3-list-visibility-proxy-2026-06-14.ts
 *
 * Proxy probe for the LIST-visibility question in Slice 3 approach 3:
 *   Does a _viewer-granted private `application` appear in the org admin's LIST query?
 *
 * PROXY LIMITATIONS (read before interpreting results):
 *   Only the PO API key is available. PO is omniscient (db root _viewer cascade +
 *   explicit _owner on all created entities). No uncontaminated non-omniscient admin
 *   identity exists without a second OAuth account. The definitive test is deferred
 *   to a GitHub issue. See findings doc for confidence assessment per sub-result.
 *
 * What this probe CAN answer trustworthily:
 *   A) LIST filter mechanics: does ?target_org.reference=X return private applications
 *      under PO's omniscient view? (Tests whether Entu indexes non-system props for
 *      private entities in LIST responses — a necessary condition for admin discovery.)
 *   B) _viewer grant mechanics: does POST _viewer succeed? Does GET-by-id work post-grant?
 *   C) Anonymous baseline: is the app absent from anonymous LIST before and after grant?
 *      (Confirms "no rights → no visibility", a useful negative bound.)
 *   D) _owner strip: can we delete PO's explicit _owner prop, leaving only the db-system
 *      polyphony _owner? Does the entity survive and remain accessible to PO via cascade?
 *
 * What this probe CANNOT answer:
 *   Whether a real non-omniscient org admin's LIST returns a _viewer-granted private app.
 *   (Requires second OAuth account — GitHub issue filed.)
 *
 * Authorization: team-lead "I authorize this run" 2026-06-14 14:20
 * Cleanup: all _probe_* entities deleted + confirmed 404 before findings doc written.
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
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source credentials.env first.');
	process.exit(1);
}

// Known entity IDs (confirmed live from prior probes)
const APPLICATION_TYPE_ID = '6a0d2e8390c8df7a1cc7de81';
const PERSON_TYPE_ID = '69bcfd8e9c031ab8e6ce805f';
const EFK_ORG_ID = '69c7f8718489bfcb0e81b065';
const PO_PERSON_ID = '69bcfd8e9c031ab8e6ce8079';
const TEST_USER_PERSON_ID = '6a097dcc90c8df7a1cc7d6dd';

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);

interface ProbeResult {
	timestamp: string;

	// Identity verification
	poAccountsBound: boolean;
	poOnDbRootViewer: boolean;

	// Proxy setup
	probeSingerPersonId: string | null;
	probeAppId: string | null;

	// A) LIST filter mechanics (PO omniscient view)
	a_listByTargetOrg_beforeGrant: { count: number; appFound: boolean };
	a_listUnfiltered_beforeGrant: { count: number; appFound: boolean };

	// B) Anonymous baseline
	b_anonGetById_beforeGrant: { httpStatus: number | 'error' };
	b_anonListByTargetOrg_beforeGrant: { count: number; appFound: boolean };
	b_anonListUnfiltered_beforeGrant: { count: number; appFound: boolean };

	// C) _owner strip
	c_poOwnerPropValueId: string | null;
	c_stripSuccess: boolean;
	c_entitySurvived: boolean;
	c_remainingOwners: string[];

	// D) _viewer grant
	d_grantSuccess: boolean;
	d_poGetById_afterGrant: { httpStatus: number | 'error'; entityFound: boolean };
	d_anonGetById_afterGrant: { httpStatus: number | 'error' };
	d_anonListByTargetOrg_afterGrant: { count: number; appFound: boolean };

	// PO LIST after grant (contaminated — recorded for completeness)
	d_poListByTargetOrg_afterGrant: { count: number; appFound: boolean };
	d_poListByViewerRef_afterGrant: { count: number; appFound: boolean };
	d_poListUnfiltered_afterGrant: { count: number; appFound: boolean };

	// Teardown
	teardownComplete: boolean;
	teardownConfirmed404_app: boolean;
	teardownConfirmed404_singerPerson: boolean;
	teardownTestUserApiKeyPropId: string | null;

	// Confidence verdict
	confidenceVerdict: string;
}

async function tryFetchHttpStatus(
	jwt: string,
	entityId: string,
): Promise<number | 'error'> {
	try {
		const url = `${API_BASE}/${DB}/entity/${entityId}`;
		const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
		return res.status;
	} catch {
		return 'error';
	}
}

async function tryListApps(
	jwt: string,
	extraQuery: Record<string, string> = {},
): Promise<{ count: number; entities: Array<{ _id: string }> }> {
	try {
		const params = new URLSearchParams({
			'_type.string': 'application',
			limit: '100',
			...extraQuery,
		});
		const url = `${API_BASE}/${DB}/entity?${params}`;
		const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
		if (!res.ok) return { count: 0, entities: [] };
		const body = (await res.json()) as { entities?: Array<{ _id: string }>; count?: number };
		return { count: body.count ?? 0, entities: body.entities ?? [] };
	} catch {
		return { count: 0, entities: [] };
	}
}

/**
 * Mints a "floor credential" JWT using an entu_api_key attached to the Test User person.
 * Test User has no Entu OAuth account → exchange returns accounts:[] (anonymous-floor JWT).
 * This JWT has no user identity and cannot hold _viewer grants (no person binding).
 * It CAN observe what's visible to a completely unprivileged caller.
 * Returns { jwt, propValueId } so the key prop can be cleaned up after the probe.
 */
async function getFloorJwt(poClient: { apiBase: string; db: string; jwt: string }): Promise<{ jwt: string; propValueId: string }> {
	const { randomBytes } = await import('crypto');
	const tempKey = randomBytes(32).toString('hex');

	// Add entu_api_key to Test User person via postProperties
	const addUrl = `${poClient.apiBase}/${poClient.db}/entity/${TEST_USER_PERSON_ID}`;
	const addRes = await fetch(addUrl, {
		method: 'POST',
		headers: { Authorization: `Bearer ${poClient.jwt}`, 'Content-Type': 'application/json' },
		body: JSON.stringify([{ type: 'entu_api_key', string: tempKey }]),
	});
	if (!addRes.ok) {
		throw new Error(`entu_api_key add failed: ${addRes.status} ${await addRes.text()}`);
	}
	await addRes.json(); // consume body — we fetch the entity to get the prop _id
	// The POST to entity returns the entity _id, not the property — fetch entity to get prop _id
	const testUserEntity = await fetchEntity(poClient, TEST_USER_PERSON_ID);
	const apiKeyProps = testUserEntity.entu_api_key as Array<{ _id: string }> | undefined;
	const propValueId = apiKeyProps?.[apiKeyProps.length - 1]?._id ?? '';
	if (!propValueId) throw new Error('entu_api_key prop _id not found after add');
	log(`Test User entu_api_key prop added: _id=${propValueId}`);

	// Exchange for JWT
	const authUrl = `${poClient.apiBase}/auth?db=${poClient.db}`;
	const authRes = await fetch(authUrl, { headers: { Authorization: `Bearer ${tempKey}` } });
	const authBody = (await authRes.json()) as { token?: string; accounts?: unknown[] };
	log(`floor JWT accounts: ${JSON.stringify(authBody.accounts ?? [])}`);
	const jwt = authBody.token ?? '';
	if (!jwt) throw new Error('floor JWT exchange returned no token');

	return { jwt, propValueId };
}

async function main(): Promise<void> {
	const result: ProbeResult = {
		timestamp: new Date().toISOString(),
		poAccountsBound: false,
		poOnDbRootViewer: false,
		probeSingerPersonId: null,
		probeAppId: null,
		a_listByTargetOrg_beforeGrant: { count: 0, appFound: false },
		a_listUnfiltered_beforeGrant: { count: 0, appFound: false },
		b_anonGetById_beforeGrant: { httpStatus: 'error' },
		b_anonListByTargetOrg_beforeGrant: { count: 0, appFound: false },
		b_anonListUnfiltered_beforeGrant: { count: 0, appFound: false },
		c_poOwnerPropValueId: null,
		c_stripSuccess: false,
		c_entitySurvived: false,
		c_remainingOwners: [],
		d_grantSuccess: false,
		d_poGetById_afterGrant: { httpStatus: 'error', entityFound: false },
		d_anonGetById_afterGrant: { httpStatus: 'error' },
		d_anonListByTargetOrg_afterGrant: { count: 0, appFound: false },
		d_poListByTargetOrg_afterGrant: { count: 0, appFound: false },
		d_poListByViewerRef_afterGrant: { count: 0, appFound: false },
		d_poListUnfiltered_afterGrant: { count: 0, appFound: false },
		teardownComplete: false,
		teardownConfirmed404_app: false,
		teardownConfirmed404_singerPerson: false,
		teardownTestUserApiKeyPropId: null,
		confidenceVerdict: 'INCOMPLETE',
	};

	// ── Step 0: PO JWT + identity verification ───────────────────
	section('Step 0: PO identity verification');

	const authUrl = `${API_BASE}/auth?db=${DB}`;
	const authRes = await fetch(authUrl, { headers: { Authorization: `Bearer ${API_KEY}` } });
	const authBody = (await authRes.json()) as { token: string; accounts: Array<{ _id: string; user?: { _id: string } }> };
	const poJwt = authBody.token;
	const accounts = authBody.accounts ?? [];
	result.poAccountsBound = accounts.length > 0 && accounts.some(a => a._id === DB);
	log(`PO accounts: ${JSON.stringify(accounts)}`);
	log(`poAccountsBound: ${result.poAccountsBound}`);

	// Verify PO on DB root viewer list
	const poClient = { apiBase: API_BASE, db: DB, jwt: poJwt };
	const dbEntity = await fetchEntity(poClient, POLYPHONY_DB_ENTITY_ID);
	const dbViewers = (dbEntity._viewer as Array<{ reference: string }> | undefined) ?? [];
	result.poOnDbRootViewer = dbViewers.some(v => v.reference === PO_PERSON_ID);
	log(`PO on DB root _viewer: ${result.poOnDbRootViewer}`);
	if (!result.poOnDbRootViewer) {
		log('WARNING: PO not on DB root viewer — omniscience assumption may not hold');
	}

	// ── Step 1: Floor JWT (Test User entu_api_key — accounts:[]) ──
	section('Step 1: Floor JWT via Test User entu_api_key');
	const { jwt: anonJwt, propValueId: floorKeyPropId } = await getFloorJwt(poClient);
	result.teardownTestUserApiKeyPropId = floorKeyPropId;
	log(`floor JWT obtained (length ${anonJwt.length}); key prop _id=${floorKeyPropId}`);

	// ── Step 2: Create probe singer person ────────────────────────
	section('Step 2: Create _probe_singer_person');
	const singerPerson = await createEntity(poClient, [
		{ type: '_type', reference: PERSON_TYPE_ID },
		{ type: '_sharing', string: 'private' },
		{ type: '_inheritrights', boolean: false },
		{ type: 'name', string: '_probe_singer — teardown me' },
	]);
	result.probeSingerPersonId = singerPerson._id;
	log(`singer person created: ${result.probeSingerPersonId}`);

	// Verify _sharing is private (parent is db root domain-shared, so check materialization)
	const singerPersonEntity = await fetchEntity(poClient, result.probeSingerPersonId);
	const singerSharing = singerPersonEntity._sharing as Array<{ string: string }> | undefined;
	const singerSharingVal = singerSharing?.[0]?.string ?? 'ABSENT';
	log(`singer person _sharing: ${singerSharingVal}`);
	const singerInherit = singerPersonEntity._inheritrights as Array<{ boolean: boolean }> | undefined;
	log(`singer person _inheritrights: ${singerInherit?.[0]?.boolean ?? 'ABSENT'}`);

	// ── Step 3: Create probe application ─────────────────────────
	section('Step 3: Create _probe_app_viewer_test application');
	const probeApp = await createEntity(poClient, [
		{ type: '_type', reference: APPLICATION_TYPE_ID },
		{ type: '_parent', reference: result.probeSingerPersonId },
		{ type: 'target_org', reference: EFK_ORG_ID },
		{ type: 'status', string: 'pending' },
		{ type: 'expires_at', string: '2026-07-01' },
		{ type: 'message', string: '_probe_app_viewer_test — teardown me' },
	]);
	result.probeAppId = probeApp._id;
	log(`probe application created: ${result.probeAppId}`);

	// Verify _sharing on created app (check if parent private+no-inherit prevented cascade)
	const appEntityRaw = await fetchEntity(poClient, result.probeAppId);
	const appSharing = appEntityRaw._sharing as Array<{ string: string }> | undefined;
	log(`app _sharing after create: ${appSharing?.[0]?.string ?? 'ABSENT (private default)'}`);
	const appOwners = appEntityRaw._owner as Array<{ reference: string; string: string; _id: string }> | undefined;
	log(`app _owner entries: ${JSON.stringify(appOwners?.map(o => ({ ref: o.reference, str: o.string })))}`);

	// ── Step 4: A) LIST filter mechanics BEFORE _viewer grant ─────
	section('Step 4A: LIST mechanics before _viewer grant (PO omniscient view)');

	const listByTargetOrg = await tryListApps(poJwt, { 'target_org.reference': EFK_ORG_ID });
	result.a_listByTargetOrg_beforeGrant = {
		count: listByTargetOrg.count,
		appFound: listByTargetOrg.entities.some(e => e._id === result.probeAppId),
	};
	log(`LIST ?target_org.reference=EFK: count=${listByTargetOrg.count} appFound=${result.a_listByTargetOrg_beforeGrant.appFound}`);

	const listUnfiltered = await tryListApps(poJwt);
	result.a_listUnfiltered_beforeGrant = {
		count: listUnfiltered.count,
		appFound: listUnfiltered.entities.some(e => e._id === result.probeAppId),
	};
	log(`LIST (unfiltered): count=${listUnfiltered.count} appFound=${result.a_listUnfiltered_beforeGrant.appFound}`);

	// ── Step 5: B) Anonymous baseline BEFORE grant ───────────────
	section('Step 5B: Anonymous baseline before _viewer grant');

	result.b_anonGetById_beforeGrant.httpStatus = await tryFetchHttpStatus(anonJwt, result.probeAppId);
	log(`anon GET-by-id before grant: HTTP ${result.b_anonGetById_beforeGrant.httpStatus}`);

	const anonListByTargetOrg = await tryListApps(anonJwt, { 'target_org.reference': EFK_ORG_ID });
	result.b_anonListByTargetOrg_beforeGrant = {
		count: anonListByTargetOrg.count,
		appFound: anonListByTargetOrg.entities.some(e => e._id === result.probeAppId),
	};
	log(`anon LIST ?target_org=EFK before grant: count=${anonListByTargetOrg.count} appFound=${result.b_anonListByTargetOrg_beforeGrant.appFound}`);

	const anonListUnfiltered = await tryListApps(anonJwt);
	result.b_anonListUnfiltered_beforeGrant = {
		count: anonListUnfiltered.count,
		appFound: anonListUnfiltered.entities.some(e => e._id === result.probeAppId),
	};
	log(`anon LIST (unfiltered) before grant: count=${anonListUnfiltered.count} appFound=${result.b_anonListUnfiltered_beforeGrant.appFound}`);

	// ── Step 6: C) Strip PO's explicit _owner ────────────────────
	section('Step 6C: Strip PO explicit _owner from probe application');

	// Find the _owner prop value _id for PO
	const appEntityForStrip = await fetchEntity(poClient, result.probeAppId);
	const ownerProps = appEntityForStrip._owner as Array<{ reference: string; _id: string }> | undefined;
	const poOwnerProp = ownerProps?.find(o => o.reference === PO_PERSON_ID);
	result.c_poOwnerPropValueId = poOwnerProp?._id ?? null;
	log(`PO _owner prop value _id: ${result.c_poOwnerPropValueId}`);

	if (result.c_poOwnerPropValueId) {
		try {
			await deletePropertyValue(poClient, result.c_poOwnerPropValueId);
			result.c_stripSuccess = true;
			log('PO _owner prop value deleted');
		} catch (e) {
			log(`_owner strip FAILED: ${e}`);
			result.c_stripSuccess = false;
		}
	} else {
		log('No PO _owner prop value found to strip');
	}

	// Verify entity survived + remaining owners
	try {
		const appEntityAfterStrip = await fetchEntity(poClient, result.probeAppId);
		result.c_entitySurvived = true;
		const remainingOwners = appEntityAfterStrip._owner as Array<{ reference: string; string: string }> | undefined;
		result.c_remainingOwners = (remainingOwners ?? []).map(o => `${o.string}(${o.reference})`);
		log(`entity survived strip: true; remaining owners: ${result.c_remainingOwners.join(', ')}`);
	} catch {
		result.c_entitySurvived = false;
		log('entity did NOT survive strip (deleted or inaccessible)');
	}

	// ── Step 7: D) Grant _viewer to PO person ────────────────────
	section('Step 7D: Grant _viewer on probe app to PO person');
	// Note: we grant to PO person — the only real identity we have.
	// PO could already see it via db-root cascade, so this tests grant mechanics,
	// not visibility change. The anon baseline is the only clean "before/after" here.

	try {
		await postProperties(poClient, result.probeAppId, [
			{ type: '_viewer', reference: PO_PERSON_ID },
		]);
		result.d_grantSuccess = true;
		log('_viewer grant POSTed successfully');
	} catch (e) {
		result.d_grantSuccess = false;
		log(`_viewer grant FAILED: ${e}`);
	}

	// PO GET-by-id after grant (control — contaminated but recorded)
	try {
		const appAfterGrant = await fetchEntity(poClient, result.probeAppId);
		const httpOk = appAfterGrant._id === result.probeAppId;
		result.d_poGetById_afterGrant = { httpStatus: 200, entityFound: httpOk };
		log(`PO GET-by-id after grant: found=${httpOk}`);
	} catch {
		result.d_poGetById_afterGrant = { httpStatus: 'error', entityFound: false };
	}

	// Anon GET-by-id after grant
	result.d_anonGetById_afterGrant.httpStatus = await tryFetchHttpStatus(anonJwt, result.probeAppId);
	log(`anon GET-by-id after grant: HTTP ${result.d_anonGetById_afterGrant.httpStatus}`);

	// Anon LIST after grant
	const anonListAfterGrant = await tryListApps(anonJwt, { 'target_org.reference': EFK_ORG_ID });
	result.d_anonListByTargetOrg_afterGrant = {
		count: anonListAfterGrant.count,
		appFound: anonListAfterGrant.entities.some(e => e._id === result.probeAppId),
	};
	log(`anon LIST after grant: count=${anonListAfterGrant.count} appFound=${result.d_anonListByTargetOrg_afterGrant.appFound}`);

	// PO LIST after grant (contaminated — for completeness)
	const poListByTargetOrg = await tryListApps(poJwt, { 'target_org.reference': EFK_ORG_ID });
	result.d_poListByTargetOrg_afterGrant = {
		count: poListByTargetOrg.count,
		appFound: poListByTargetOrg.entities.some(e => e._id === result.probeAppId),
	};
	log(`PO LIST ?target_org=EFK after grant: count=${poListByTargetOrg.count} appFound=${result.d_poListByTargetOrg_afterGrant.appFound}`);

	const poListByViewerRef = await tryListApps(poJwt, { '_viewer.reference': PO_PERSON_ID });
	result.d_poListByViewerRef_afterGrant = {
		count: poListByViewerRef.count,
		appFound: poListByViewerRef.entities.some(e => e._id === result.probeAppId),
	};
	log(`PO LIST ?_viewer.reference=PO after grant: count=${poListByViewerRef.count} appFound=${result.d_poListByViewerRef_afterGrant.appFound}`);

	const poListUnfilteredAfter = await tryListApps(poJwt);
	result.d_poListUnfiltered_afterGrant = {
		count: poListUnfilteredAfter.count,
		appFound: poListUnfilteredAfter.entities.some(e => e._id === result.probeAppId),
	};
	log(`PO LIST (unfiltered) after grant: count=${poListUnfilteredAfter.count} appFound=${result.d_poListUnfiltered_afterGrant.appFound}`);

	// ── Step 8: Confidence verdict ────────────────────────────────
	section('Step 8: Confidence verdict');

	const listFilterWorks = result.a_listByTargetOrg_beforeGrant.appFound;
	const anonBlindBefore =
		result.b_anonGetById_beforeGrant.httpStatus !== 200 &&
		!result.b_anonListByTargetOrg_beforeGrant.appFound;
	const anonBlindAfter =
		result.d_anonGetById_afterGrant.httpStatus !== 200 &&
		!result.d_anonListByTargetOrg_afterGrant.appFound;
	const grantMechanicsWork = result.d_grantSuccess && result.d_poGetById_afterGrant.entityFound;

	const parts: string[] = [];

	parts.push(`LIST-filter-indexing: ${listFilterWorks ? 'CONFIRMED (PO omniscient, contaminated)' : 'FAILED — Entu does not index target_org for private apps in LIST'}`);
	parts.push(`anonymous-baseline: ${anonBlindBefore ? 'CONFIRMED — anon cannot see private app before grant' : 'UNEXPECTED — anon saw private app before grant'}`);
	parts.push(`_viewer-grant-mechanics: ${grantMechanicsWork ? 'CONFIRMED — grant POST works, GET-by-id works after grant' : 'FAILED'}`);
	parts.push(`anon-after-grant: ${anonBlindAfter ? 'CONFIRMED — anon cannot see app even after _viewer grant (expected: grant to PO person, not anon)' : 'UNEXPECTED — anon saw app after grant'}`);
	parts.push(`_owner-strip: ${result.c_stripSuccess ? 'SUCCEEDED' : 'FAILED'} — entity survived: ${result.c_entitySurvived}`);
	parts.push('DEFINITIVE LIST-visibility test: INCONCLUSIVE — no non-omniscient admin JWT available; second OAuth account required');

	result.confidenceVerdict = parts.join('\n');
	log('\n' + result.confidenceVerdict);

	// ── Teardown ──────────────────────────────────────────────────
	section('Teardown');

	// Delete Test User API key property first (before deleting entities)
	if (result.teardownTestUserApiKeyPropId) {
		try {
			await deletePropertyValue(poClient, result.teardownTestUserApiKeyPropId);
			log(`deleted Test User entu_api_key prop (${result.teardownTestUserApiKeyPropId})`);
		} catch (e) {
			log(`DELETE Test User API key prop FAILED: ${e}`);
		}
	}

	const toDelete: Array<{ label: string; id: string; key: keyof ProbeResult }> = [];
	if (result.probeAppId) toDelete.push({ label: 'probe application', id: result.probeAppId, key: 'teardownConfirmed404_app' });
	if (result.probeSingerPersonId) toDelete.push({ label: 'probe singer person', id: result.probeSingerPersonId, key: 'teardownConfirmed404_singerPerson' });

	for (const item of toDelete) {
		try {
			await deleteEntity(poClient, item.id);
			log(`deleted ${item.label} (${item.id})`);
		} catch (e) {
			log(`DELETE ${item.label} failed: ${e}`);
		}
		// Verify 404
		const status = await tryFetchHttpStatus(poJwt, item.id);
		const is404 = status === 404;
		(result as Record<string, unknown>)[item.key] = is404;
		log(`${item.label} 404 confirmed: ${is404}`);
	}

	result.teardownComplete = result.teardownConfirmed404_app && result.teardownConfirmed404_singerPerson;
	log(`Teardown complete: ${result.teardownComplete}`);

	// ── Write result artifact ─────────────────────────────────────
	section('Writing result artifact');
	const { mkdirSync, writeFileSync } = await import('fs');
	const resultsDir = new URL('../seed-results/', import.meta.url).pathname;
	mkdirSync(resultsDir, { recursive: true });

	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const artifactPath = `${resultsDir}probe-slice3-list-visibility-proxy-${ts}.json`;
	writeFileSync(artifactPath, JSON.stringify(result, null, 2));
	log(`Result artifact: ${artifactPath}`);

	if (!result.teardownComplete) {
		console.error('ERROR: Teardown incomplete — some probe entities may remain. Check manually.');
		process.exit(1);
	}

	process.exit(0);
}

main().catch(e => {
	console.error('FATAL:', e);
	process.exit(1);
});
