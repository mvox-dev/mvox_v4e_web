/**
 * seed-mvox-collective-marker-2026-08-05.ts
 *
 * Issue: slice-1 T4 (db-selection-from-token). mvox-app needs a way to tell
 * which of a user's Entu dbs are actual choral collectives, since a token
 * spans every db the user has a person in (e.g. esmuuseum, piletilevi,
 * polyphony, template, ww — only polyphony is choral). The app filters to
 * dbs that carry a dedicated marker.
 *
 * PO-approved 2026-08-05 (relayed by Palestrina): `mvox_collective` is an
 * mvox-app marker type, NOT canonical v4E — no entu/research PR required.
 * This is an app-level convention seeded directly into polyphony.
 *
 * Creates, idempotently:
 *   1. entity TYPE `mvox_collective` — _sharing: domain (readable by any
 *      in-domain member; type-defs must be domain-shared for a member's
 *      `?_type.string=` LIST query to resolve at all — see
 *      docs/migration/findings/slice3-type-def-sharing-fix-2026-06-15.md).
 *   2. property definition `name` on that type — _sharing: domain (a member
 *      only sees a property's VALUE at domain tier if the property
 *      DEFINITION itself carries _sharing:domain — see
 *      docs/migration/findings/entu-property-bucket-visibility-2026-07-19.md
 *      §"SOURCE-VERIFIED: the three-bucket model"). Note: lib/v4e-translator.ts
 *      `translatePropertyDef` does NOT set `_sharing` on property-def
 *      entities at all (checked directly — no such field in its payload).
 *      That's a real gap in the standard schema-driven creation path
 *      (flagged to Josquin/team-lead separately, not fixed here — out of
 *      scope, lib/*.ts is Josquin's). This script hand-rolls the payload
 *      instead of calling that helper, specifically because it's missing.
 *   3. ONE singleton instance: name = "Eesti Filharmoonia Kammerkoor",
 *      _sharing: domain.
 *
 * Idempotent: each of the three creates is check-then-skip. Re-running is
 * safe. Singleton check for step 3 is by TYPE (any existing instance at
 * all), not by name — this is meant to be a true singleton.
 *
 * Verification (live mode only): after creating/confirming, re-derives a
 * member-tier JWT (inject entu_api_key on the OAuth-bound reader person,
 * exchange, teardown) and runs the app's actual query —
 * `?_type.string=mvox_collective&props=name&limit=1` — expecting count=1,
 * name="Eesti Filharmoonia Kammerkoor". Also spot-checks the `template` db
 * for the same query, expecting count=0 (confirms no cross-db leakage — it
 * has no such type at all).
 *
 * Guard: DB is hardcoded to 'polyphony' for all WRITES. The template
 * spot-check is READ-ONLY against a different db, explicitly requested by
 * team-lead for verification purposes — never seeds/writes there.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrations/seed-mvox-collective-marker-2026-08-05.ts --dry-run
 *   pnpm exec tsx scripts/migrations/seed-mvox-collective-marker-2026-08-05.ts --live
 *
 * (*MVOX:Perotin*)
 */

import {
	getJwt,
	listEntities,
	createEntity,
	fetchEntity,
	deleteEntity,
	deletePropertyValue,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	POLYPHONY_DB_ENTITY_ID,
	type EntuClient,
	type EntuProperty,
} from './lib/entu-client.ts';
import { isDryRun, writeResultArtifact, findOrCreateByName } from './perotin-toolkit.ts';

const DRY_RUN = isDryRun();
const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = 'polyphony'; // hardcoded — this script must never target another db
const API_KEY = process.env.ENTU_API_KEY ?? '';

const TYPE_NAME = 'mvox_collective';
const INSTANCE_NAME = 'Eesti Filharmoonia Kammerkoor';
const READER_PERSON_ID = '6a2fc05e4cd971291c5d5ddc'; // OAuth-bound reader used in the 2026-07-19 bucket probe

if (!API_KEY) {
	console.error('[seed-mvox-collective-marker] ERROR: ENTU_API_KEY not set');
	process.exit(1);
}

async function findTypeDef(client: EntuClient, name: string): Promise<string | null> {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': name,
		props: '_id',
	});
	return resp.count > 0 ? resp.entities[0]._id : null;
}

async function findPropertyDef(
	client: EntuClient,
	parentTypeId: string,
	name: string,
): Promise<string | null> {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': parentTypeId,
		'name.string': name,
		props: '_id',
	});
	return resp.count > 0 ? resp.entities[0]._id : null;
}

async function countInstances(client: EntuClient, typeName: string): Promise<number> {
	const resp = await listEntities(client, {
		'_type.string': typeName,
		props: '_id',
		limit: '2', // we only need to know 0 / 1 / >1, never the full set
	});
	return resp.count;
}

interface Result {
	dryRun: boolean;
	startedAt: string;
	typeDef: { action: string; _id: string | null };
	propertyDef: { action: string; _id: string | null };
	instance: { action: string; _id: string | null; existingInstanceCount?: number };
	memberTierVerification: unknown;
	templateSpotCheck: unknown;
	reversibilityTokens: { typeId: string | null; propDefId: string | null; instanceId: string | null };
	completedAt?: string;
	error?: string;
}

async function main() {
	console.log(`[seed-mvox-collective-marker] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${DB}`);

	const startedAt = new Date();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const result: Result = {
		dryRun: DRY_RUN,
		startedAt: startedAt.toISOString(),
		typeDef: { action: 'pending', _id: null },
		propertyDef: { action: 'pending', _id: null },
		instance: { action: 'pending', _id: null },
		memberTierVerification: null,
		templateSpotCheck: null,
		reversibilityTokens: { typeId: null, propDefId: null, instanceId: null },
	};

	// -------------------------------------------------------------------
	// Step 1: entity TYPE `mvox_collective`, _sharing: domain
	// -------------------------------------------------------------------
	console.log(`[step 1] type-def "${TYPE_NAME}"...`);
	let typeId = await findTypeDef(client, TYPE_NAME);

	if (typeId) {
		console.log(`  EXISTS (${typeId}) — skip`);
		result.typeDef = { action: 'skip', _id: typeId };
	} else if (DRY_RUN) {
		console.log(`  WOULD CREATE`);
		result.typeDef = { action: 'would_create', _id: null };
	} else {
		const typeProps: EntuProperty[] = [
			{ type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID },
			{ type: '_parent', reference: POLYPHONY_DB_ENTITY_ID },
			{ type: 'name', string: TYPE_NAME },
			{ type: 'label', string: 'Mvox Collective (marker)' },
			{ type: '_sharing', string: 'domain' },
		];
		const created = await createEntity(client, typeProps);
		typeId = created._id;
		console.log(`  CREATED (${typeId})`);
		result.typeDef = { action: 'created', _id: typeId };
	}
	result.reversibilityTokens.typeId = typeId;

	// -------------------------------------------------------------------
	// Step 2: property definition `name`, _sharing: domain
	// -------------------------------------------------------------------
	console.log(`[step 2] property-def "name" on "${TYPE_NAME}"...`);
	let propDefId: string | null = null;

	if (DRY_RUN && !typeId) {
		console.log(`  WOULD CREATE (type not yet created in dry-run)`);
		result.propertyDef = { action: 'would_create', _id: null };
	} else if (typeId) {
		propDefId = await findPropertyDef(client, typeId, 'name');
		if (propDefId) {
			console.log(`  EXISTS (${propDefId}) — skip`);
			result.propertyDef = { action: 'skip', _id: propDefId };
		} else if (DRY_RUN) {
			console.log(`  WOULD CREATE`);
			result.propertyDef = { action: 'would_create', _id: null };
		} else {
			// Hand-rolled: translatePropertyDef (lib/v4e-translator.ts) does not
			// set _sharing on property-def entities — see file header note.
			const propDefProps: EntuProperty[] = [
				{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
				{ type: '_parent', reference: typeId },
				{ type: 'name', string: 'name' },
				{ type: 'label', string: 'Name' },
				{ type: 'type', string: 'string' },
				{ type: '_sharing', string: 'domain' },
			];
			const created = await createEntity(client, propDefProps);
			propDefId = created._id;
			console.log(`  CREATED (${propDefId})`);
			result.propertyDef = { action: 'created', _id: propDefId };
		}
	}
	result.reversibilityTokens.propDefId = propDefId;

	// -------------------------------------------------------------------
	// Step 3: ONE singleton instance
	// -------------------------------------------------------------------
	console.log(`[step 3] singleton instance...`);
	let instanceId: string | null = null;

	if (DRY_RUN) {
		console.log(`  WOULD CHECK for existing instance, WOULD CREATE if none (dry-run, no live read)`);
		result.instance = { action: 'would_create', _id: null };
	} else {
		const existingCount = await countInstances(client, TYPE_NAME);
		if (existingCount > 0) {
			const r = await findOrCreateByName(client, TYPE_NAME, INSTANCE_NAME, undefined, []);
			instanceId = r._id;
			console.log(`  EXISTS (${existingCount} instance(s), using ${instanceId}) — skip create`);
			result.instance = { action: 'skip', _id: instanceId, existingInstanceCount: existingCount };
		} else if (!typeId) {
			throw new Error('type not available — cannot create instance');
		} else {
			const instanceProps: EntuProperty[] = [
				{ type: '_type', reference: typeId },
				{ type: 'name', string: INSTANCE_NAME },
				{ type: '_sharing', string: 'domain' },
			];
			const created = await createEntity(client, instanceProps);
			instanceId = created._id;
			console.log(`  CREATED (${instanceId})`);
			result.instance = { action: 'created', _id: instanceId };
		}
	}
	result.reversibilityTokens.instanceId = instanceId;

	// -------------------------------------------------------------------
	// Verification (live only): member-tier read + template spot-check
	// -------------------------------------------------------------------
	if (!DRY_RUN) {
		console.log(`[verify] member-tier read as ${READER_PERSON_ID}...`);
		let keyPropId: string | null = null;
		try {
			// Live api.entu.app rejects an entu_api_key POST from an _editor-only
			// caller with 403 "User not in _owner property". This rightTypes gate
			// on entu_api_key is NOT present in the local ~/projects/entu-api
			// clone (utils/entity.js checkEntityAccess's rightTypes list has no
			// entu_api_key entry) — confirmed by direct reproduction, not assumed.
			// Live/local source drift, flagged for follow-up.
			//
			// Attempted workaround (removed): grant PO a temporary _owner property
			// on the reader first. That ALSO 403s — `_owner` is itself in
			// rightTypes, so adding it requires already being _owner. PO holds
			// only inherited _editor on this entity (confirmed via a direct read,
			// see the report). This is a genuine chicken-and-egg PO's personal API
			// key cannot escape; no systemUser-equivalent credential is available
			// to us (systemUser is only ever set server-side for bootstrap/stripe/
			// aggregation/invite routes, never derived from a user API key — see
			// entu-api grep). Left failing (not silently worked around) so this
			// surfaces clearly rather than being masked.
			const postRes = await fetch(`${API_BASE}/${DB}/entity/${READER_PERSON_ID}`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
				body: JSON.stringify([
					{ type: 'entu_api_key', string: `_verify_mvox_collective_${Date.now()}` },
				]),
			});
			if (!postRes.ok) throw new Error(`key POST failed: ${postRes.status} ${await postRes.text()}`);
			const postBody = (await postRes.json()) as { properties?: Array<{ _id?: string; string?: string; type?: string }> };
			const keyProp = (postBody.properties ?? []).find((p) => p.type === 'entu_api_key');
			keyPropId = keyProp?._id ?? null;
			const rawKey = keyProp?.string ?? '';
			if (!rawKey) throw new Error('no raw key in create response');

			const readerJwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: rawKey });
			const url = `${API_BASE}/${DB}/entity?_type.string=${TYPE_NAME}&props=name&limit=1`;
			const res = await fetch(url, { headers: { Authorization: `Bearer ${readerJwt}` } });
			const body = (await res.json()) as {
				entities?: Array<{ _id: string; name?: Array<{ string?: string }> }>;
				count?: number;
			};
			const name = body.entities?.[0]?.name?.[0]?.string ?? null;
			const pass = res.status === 200 && body.count === 1 && name === INSTANCE_NAME;
			result.memberTierVerification = {
				httpStatus: res.status,
				count: body.count,
				name,
				expected: { count: 1, name: INSTANCE_NAME },
				pass,
			};
			console.log(
				`  HTTP ${res.status} count=${body.count} name=${JSON.stringify(name)} — ${pass ? 'PASS' : 'FAIL'}`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  BLOCKED: ${msg}`);
			result.memberTierVerification = { blocked: true, error: msg, pass: false };
		} finally {
			if (keyPropId) {
				const del = await fetch(`${API_BASE}/${DB}/property/${keyPropId}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${jwt}` },
				});
				console.log(`  teardown: delete key prop ${keyPropId} — HTTP ${del.status}`);
			}
		}

		console.log(`[verify] template db spot-check...`);
		try {
			const templateJwt = await getJwt({ apiBase: API_BASE, db: 'template', apiKey: API_KEY });
			const url = `${API_BASE}/template/entity?_type.string=${TYPE_NAME}&props=name&limit=1`;
			const res = await fetch(url, { headers: { Authorization: `Bearer ${templateJwt}` } });
			const body = (await res.json()) as { count?: number };
			result.templateSpotCheck = {
				httpStatus: res.status,
				count: body.count ?? null,
				pass: body.count === 0,
			};
			console.log(`  HTTP ${res.status} count=${body.count} — ${body.count === 0 ? 'PASS' : 'UNEXPECTED'}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			result.templateSpotCheck = { error: msg };
			console.warn(`  template spot-check failed to run: ${msg}`);
		}
	}

	result.completedAt = new Date().toISOString();
	const artifactPath = await writeResultArtifact('seed-mvox-collective-marker', result, {
		at: startedAt,
	});
	console.log(`[seed-mvox-collective-marker] artifact: ${artifactPath}`);
	console.log(`[seed-mvox-collective-marker] done.`);
}

main().catch((err) => {
	console.error('[seed-mvox-collective-marker] FATAL:', err);
	process.exit(1);
});
