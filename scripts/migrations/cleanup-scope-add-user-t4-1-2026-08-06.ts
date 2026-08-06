/**
 * cleanup-scope-add-user-t4-1-2026-08-06.ts
 *
 * T4.1 — close the logged-in-anywhere -> domain-read exposure
 * (docs/migration/findings/logged-in-anywhere-domain-read-2026-08-06.md).
 * Team-lead independently verified the target read-only before authorizing:
 * db entity 69bcfd8e9c031ab8e6ce807a carries exactly ONE add_user value
 * (_id 6a2f3f564cd971291c5d5ca0, self-referencing). Since it's the sole
 * value, DELETE fully ends OAuth auto-provisioning for polyphony.
 *
 * Single op: DELETE /property/{value._id}. Nothing else touched.
 *
 * Authorization: team-lead explicit "I authorize this run" (distinct token),
 * 2026-08-06, after independently re-verifying the target.
 *
 * Post-write: re-fetch the db entity, assert add_user absent (config
 * read-back, not inferred from the DELETE response).
 *
 * Behavioural checks 2 (fresh OAuth -> no person) and 3 (existing member
 * still signs in) are OUT OF SCOPE here — they need a real browser OAuth
 * sign-in (human action), routed by team-lead to Mihkel via the PO channel.
 *
 * Run: pnpm exec tsx scripts/migrations/cleanup-scope-add-user-t4-1-2026-08-06.ts
 */

import { getJwt, fetchEntity, deletePropertyValue, POLYPHONY_DB_ENTITY_ID, type EntuClient } from './lib/entu-client.ts';
import { writeResultArtifact } from './perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const ADD_USER_VALUE_ID = '6a2f3f564cd971291c5d5ca0';

const log = (msg: string) => console.log(`[t4.1] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function main() {
	const executedAt = new Date();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	section('Pre-check: db entity add_user before delete');
	const before = await fetchEntity(client, POLYPHONY_DB_ENTITY_ID);
	const addUserBefore = (before as any).add_user ?? null;
	log(`add_user before: ${JSON.stringify(addUserBefore)}`);

	section('Execute: DELETE /property/{add_user value id}');
	log(`DELETE /property/${ADD_USER_VALUE_ID}`);
	await deletePropertyValue(client, ADD_USER_VALUE_ID);
	log('deleted');

	section('Check 1 (config read-back) — re-fetch db entity, assert add_user absent');
	const after = await fetchEntity(client, POLYPHONY_DB_ENTITY_ID);
	const addUserAfter = (after as any).add_user ?? null;
	const isAbsent = addUserAfter === null || (Array.isArray(addUserAfter) && addUserAfter.length === 0);
	log(`add_user after: ${JSON.stringify(addUserAfter)}`);
	log(`ABSENT confirmed: ${isAbsent}`);

	const result = {
		timestamp: executedAt.toISOString(),
		op: 'T4.1 scope add_user',
		dbEntityId: POLYPHONY_DB_ENTITY_ID,
		deletedValueId: ADD_USER_VALUE_ID,
		addUserBefore,
		addUserAfter,
		configReadBackConfirmedAbsent: isAbsent,
		note:
			'Mutation done + config read-back verified. Behavioural checks 2/3 (fresh OAuth -> no person; existing member still signs in) PENDING human sign-in — routed by team-lead to Mihkel via PO channel, not executed here. Auto-provisioning window CLOSED as of this timestamp (no new polyphony person can be created until T4.5/#31 lands).',
	};

	const artifactPath = await writeResultArtifact('t4-1-scope-add-user', result);
	log(`\nresult artifact: ${artifactPath}`);

	if (!isAbsent) {
		console.error('FAIL: add_user still present after delete — do not report closed.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
