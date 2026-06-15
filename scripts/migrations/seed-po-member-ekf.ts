/**
 * seed-po-member-ekf.ts
 *
 * Seeds ONE member entity for the PO (Mihkel Putrinš) in EFK org.
 * Required so the PO can live-test the RSVP happy path in slice-2 UI.
 *
 * Idempotent: skips creation if a member row already exists for
 * person=PO_PERSON_ID with _parent=EFK_ID.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrations/seed-po-member-ekf.ts --dry-run
 *   pnpm exec tsx scripts/migrations/seed-po-member-ekf.ts --live
 *
 * (*MVOX:Perotin*)
 */

import { getJwt, listInstancesByType } from './lib/entu-client';
import { isDryRun, writeResultArtifact } from './perotin-toolkit';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

const EFK_ID = '69c7f8718489bfcb0e81b065';
const PO_PERSON_ID = '69bcfd8e9c031ab8e6ce8079'; // Mihkel Putrinš — accounts.polyphony
const MEMBER_TYPE_ID = '69c7ea4a8489bfcb0e819edd'; // member type entity

async function main() {
	const dryRun = isDryRun();
	const startedAt = new Date();

	console.log(`[seed-po-member-ekf] mode=${dryRun ? 'dry-run' : 'live'}`);
	console.log(`[seed-po-member-ekf] PO person: ${PO_PERSON_ID}`);
	console.log(`[seed-po-member-ekf] EFK org:   ${EFK_ID}`);

	if (!API_KEY) {
		console.error('[seed-po-member-ekf] ERROR: ENTU_API_KEY not set');
		process.exit(1);
	}

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	console.log(`[seed-po-member-ekf] JWT minted OK`);

	const client = { apiBase: API_BASE, db: DB, jwt };

	// Idempotency check: look for existing member with this person ref in EFK
	const existing = await listInstancesByType(client, 'member', ['_id', 'person', '_parent'], {
		'person.reference': PO_PERSON_ID,
	});

	const existingInEfk = existing.entities.filter((e: Record<string, unknown>) => {
		const parents = (e._parent as Array<{ reference: string }> | undefined) ?? [];
		return parents.some((p) => p.reference === EFK_ID);
	});

	const result: Record<string, unknown> = {
		dryRun,
		startedAt: startedAt.toISOString(),
		po_person_id: PO_PERSON_ID,
		efk_org_id: EFK_ID,
		existingMemberCount: existingInEfk.length,
		action: null as string | null,
		createdMemberId: null as string | null,
		error: null as string | null,
	};

	if (existingInEfk.length > 0) {
		const existingId = (existingInEfk[0] as { _id: string })._id;
		console.log(`[seed-po-member-ekf] SKIP — member already exists: ${existingId}`);
		result.action = 'skip';
		result.createdMemberId = existingId;
	} else if (dryRun) {
		console.log(`[seed-po-member-ekf] WOULD CREATE member for PO in EFK`);
		result.action = 'would_create';
	} else {
		// Live: create the member entity
		console.log(`[seed-po-member-ekf] Creating member entity...`);

		const url = `${API_BASE}/${DB}/entity`;
		const properties = [
			{ type: '_type', reference: MEMBER_TYPE_ID },
			{ type: '_parent', reference: EFK_ID },
			{ type: 'person', reference: PO_PERSON_ID },
			{ type: 'status', string: 'active' },
			{ type: '_inheritrights', boolean: true },
		];

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${jwt}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(properties),
		});

		if (!res.ok) {
			const text = await res.text();
			result.error = `create failed: ${res.status} ${text}`;
			console.error(`[seed-po-member-ekf] ERROR: ${result.error}`);
			await writeResultArtifact('seed-po-member-ekf', result, { at: startedAt });
			process.exit(1);
		}

		const created = (await res.json()) as { _id: string };
		result.createdMemberId = created._id;
		result.action = 'created';
		console.log(`[seed-po-member-ekf] Created member: ${created._id}`);

		// Verify: read back the entity
		const verifyRes = await fetch(
			`${API_BASE}/${DB}/entity/${created._id}?props=_id,person,_parent,status`,
			{ headers: { Authorization: `Bearer ${jwt}` } },
		);
		if (verifyRes.ok) {
			const v = (await verifyRes.json()) as { entity: Record<string, unknown> };
			result.verifiedEntity = v.entity;
			console.log(`[seed-po-member-ekf] Verified OK:`, JSON.stringify(v.entity, null, 2));
		} else {
			result.verifyStatus = verifyRes.status;
			console.warn(`[seed-po-member-ekf] Verify returned ${verifyRes.status}`);
		}
	}

	result.completedAt = new Date().toISOString();
	const artifactPath = await writeResultArtifact('seed-po-member-ekf', result, {
		at: startedAt,
	});
	console.log(`[seed-po-member-ekf] Artifact: ${artifactPath}`);
	console.log(`[seed-po-member-ekf] Done — action=${result.action}`);
}

main().catch((err) => {
	console.error('[seed-po-member-ekf] FATAL:', err);
	process.exit(1);
});
