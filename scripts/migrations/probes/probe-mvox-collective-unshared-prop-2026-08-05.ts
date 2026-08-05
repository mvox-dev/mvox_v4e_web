/**
 * probe-mvox-collective-unshared-prop-2026-08-05.ts
 *
 * PO-directed experiment (relayed by Palestrina, 2026-08-05): empirically
 * confirm that a property's value is gated by its property-DEFINITION's own
 * `_sharing`, not just the entity's. `name` on `mvox_collective` (already
 * live, prop-def _sharing:domain) is the control — a member already reads
 * it. This probe adds a second property, `test_hidden`, whose prop-def is
 * deliberately left WITHOUT a `_sharing` value, and puts a throwaway value
 * on the existing singleton instance. Prediction: a member-tier read of the
 * instance with `?props=name,test_hidden` returns `name` but not
 * `test_hidden` — its value never reaches the domain bucket.
 *
 * IMPORTANT correction to the literal ask ("just omit _sharing"): omitting
 * _sharing from a NEW entity's create payload does not leave it unset if
 * the entity's `_parent` carries a sharing value — `inheritParentProperties`
 * (utils/entity.js in entu-api, called unconditionally for every new-entity
 * create) auto-injects `_sharing` from the parent when the payload doesn't
 * include one. `mvox_collective` (the parent type here) is itself
 * `_sharing:domain`, so a naive "just omit it" create would silently end up
 * with `_sharing:domain` on `test_hidden`'s prop-def too — defeating the
 * whole point of the experiment (the control and the test property would be
 * mechanically identical, and a "member CAN see it" result would prove
 * nothing about the bucket model). Verified empirically by this script, not
 * assumed: it creates without `_sharing`, checks whether one got
 * auto-injected, and if so DELETEs that specific property VALUE — leaving
 * `test_hidden`'s prop-def with genuinely no `_sharing` property at all,
 * which is what "leave it unshared" actually requires here.
 *
 * Idempotent: skips prop-def creation if `test_hidden` already exists under
 * `mvox_collective`; skips the auto-inherit correction if none was injected;
 * always re-POSTs the instance value (harmless — POST only appends; a
 * cleanup pass should DELETE the value id reported below before re-running
 * if a fresh test value is wanted).
 *
 * Reversible / throwaway per team-lead: reports the prop-def id and the
 * instance property-value id so both can be deleted once Mihkel has read
 * the result. Does not delete anything itself — cleanup is a separate,
 * explicit step.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrations/probes/probe-mvox-collective-unshared-prop-2026-08-05.ts --dry-run
 *   pnpm exec tsx scripts/migrations/probes/probe-mvox-collective-unshared-prop-2026-08-05.ts --live
 *
 * (*MVOX:Perotin*)
 */

import {
	getJwt,
	listEntities,
	createEntity,
	fetchEntity,
	postProperties,
	deletePropertyValue,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
	type EntuProperty,
} from '../lib/entu-client.ts';
import { isDryRun, writeResultArtifact } from '../perotin-toolkit.ts';

const DRY_RUN = isDryRun();
const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

const TYPE_ID = '6a73880336c951d9114ec63d'; // mvox_collective, _sharing:domain
const INSTANCE_ID = '6a73880436c951d9114ec650'; // singleton "Eesti Filharmoonia Kammerkoor"
const PROP_NAME = 'test_hidden';
const TEST_VALUE = 'MEMBER_SHOULD_NOT_SEE';

if (!API_KEY) {
	console.error('[probe-mvox-collective-unshared-prop] ERROR: ENTU_API_KEY not set');
	process.exit(1);
}

async function findPropertyDef(client: EntuClient, parentTypeId: string, name: string) {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
		'_parent.reference': parentTypeId,
		'name.string': name,
		props: '_id,_sharing',
	});
	return resp.entities[0] ?? null;
}

interface Result {
	dryRun: boolean;
	startedAt: string;
	propertyDef: { action: string; _id: string | null };
	autoInheritedSharing: { detected: boolean; value: string | null; removedPropId: string | null };
	instanceValue: { action: string; _id: string | null };
	completedAt?: string;
}

async function main() {
	console.log(`[probe-mvox-collective-unshared-prop] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${DB}`);
	const startedAt = new Date();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const result: Result = {
		dryRun: DRY_RUN,
		startedAt: startedAt.toISOString(),
		propertyDef: { action: 'pending', _id: null },
		autoInheritedSharing: { detected: false, value: null, removedPropId: null },
		instanceValue: { action: 'pending', _id: null },
	};

	// -------------------------------------------------------------------
	// Step 1: property-def `test_hidden`, deliberately no _sharing in the
	// create payload — then check/correct for parent-inherited _sharing.
	// -------------------------------------------------------------------
	console.log(`[step 1] property-def "${PROP_NAME}" on mvox_collective...`);
	const existing = await findPropertyDef(client, TYPE_ID, PROP_NAME);
	let propDefId: string | null = existing?._id ?? null;

	if (existing) {
		console.log(`  EXISTS (${propDefId}) — skip create`);
		result.propertyDef = { action: 'skip', _id: propDefId };
		const sharingArr = existing._sharing as Array<{ _id: string; string: string }> | undefined;
		if (sharingArr && sharingArr.length > 0) {
			console.log(
				`  NOTE: existing prop-def already carries _sharing=${sharingArr[0].string} (${sharingArr[0]._id}) — not touching it on a skip; re-run against a fresh prop-def if a clean unset state is needed`,
			);
			result.autoInheritedSharing = {
				detected: true,
				value: sharingArr[0].string,
				removedPropId: null,
			};
		}
	} else if (DRY_RUN) {
		console.log(`  WOULD CREATE (no _sharing in payload), WOULD CHECK for parent-inherited _sharing`);
		result.propertyDef = { action: 'would_create', _id: null };
	} else {
		const propDefProps: EntuProperty[] = [
			{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
			{ type: '_parent', reference: TYPE_ID },
			{ type: 'name', string: PROP_NAME },
			{ type: 'label', string: 'Test Hidden (unshared, throwaway probe)' },
			{ type: 'type', string: 'string' },
			// deliberately no _sharing — see file header
		];
		const created = await createEntity(client, propDefProps);
		propDefId = created._id;
		console.log(`  CREATED (${propDefId})`);
		result.propertyDef = { action: 'created', _id: propDefId };

		// Check whether inheritParentProperties auto-injected _sharing from the
		// (domain-shared) parent type, and correct it if so.
		const readBack = await fetchEntity(client, propDefId);
		const sharingArr = readBack._sharing as Array<{ _id: string; string: string }> | undefined;
		if (sharingArr && sharingArr.length > 0) {
			const { _id: sharingPropId, string: sharingValue } = sharingArr[0];
			console.log(
				`  detected parent-inherited _sharing=${sharingValue} (${sharingPropId}) — removing to leave truly unset`,
			);
			await deletePropertyValue(client, sharingPropId);
			result.autoInheritedSharing = {
				detected: true,
				value: sharingValue,
				removedPropId: sharingPropId,
			};

			const verify = await fetchEntity(client, propDefId);
			const stillThere = ((verify._sharing as unknown[] | undefined) ?? []).length > 0;
			console.log(`  verify after removal: _sharing present=${stillThere} (expect false)`);
		} else {
			console.log(`  no _sharing was inherited — prop-def is genuinely unset as created`);
			result.autoInheritedSharing = { detected: false, value: null, removedPropId: null };
		}
	}

	// -------------------------------------------------------------------
	// Step 2: throwaway value on the existing singleton instance
	// -------------------------------------------------------------------
	console.log(`[step 2] value "${PROP_NAME}" on the mvox_collective instance...`);
	if (DRY_RUN) {
		console.log(`  WOULD POST test_hidden="${TEST_VALUE}"`);
		result.instanceValue = { action: 'would_create', _id: null };
	} else {
		await postProperties(client, INSTANCE_ID, [{ type: PROP_NAME, string: TEST_VALUE }]);
		const readBack = await fetchEntity(client, INSTANCE_ID);
		const valArr = readBack[PROP_NAME] as Array<{ _id: string; string: string }> | undefined;
		const valId = valArr?.[0]?._id ?? null;
		console.log(`  POSTED (${valId})`);
		result.instanceValue = { action: 'created', _id: valId };
	}

	result.completedAt = new Date().toISOString();
	const artifactPath = await writeResultArtifact('probe-mvox-collective-unshared-prop', result, {
		at: startedAt,
	});
	console.log(`[probe-mvox-collective-unshared-prop] artifact: ${artifactPath}`);
	console.log(`[probe-mvox-collective-unshared-prop] done.`);
}

main().catch((err) => {
	console.error('[probe-mvox-collective-unshared-prop] FATAL:', err);
	process.exit(1);
});
