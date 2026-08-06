/**
 * probe-t41-add-user-prep-2026-08-06.ts
 *
 * PREP ONLY for T4.1 / issue #22 — remove the `add_user` property from the
 * polyphony db entity. Team-lead has NOT yet given the per-run "execute now"
 * token (issue-standard.md §8.6); this script only READS the db entity and
 * confirms the exact property-value shape so the mutation request can be
 * drafted precisely. No write, no DELETE, no POST.
 *
 * Run: npx tsx scripts/migrations/probes/probe-t41-add-user-prep-2026-08-06.ts
 */

import { getJwt, fetchEntity, POLYPHONY_DB_ENTITY_ID, type EntuClient } from '../lib/entu-client.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const log = (msg: string) => console.log(`[prep] ${msg}`);

async function main() {
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const entity = await fetchEntity(client, POLYPHONY_DB_ENTITY_ID);
	log(`fetched db entity ${POLYPHONY_DB_ENTITY_ID}, _id confirms: ${entity._id === POLYPHONY_DB_ENTITY_ID}`);

	const addUser = (entity as any).add_user as Array<Record<string, unknown>> | undefined;
	if (!addUser || addUser.length === 0) {
		log('add_user is ABSENT on the db entity already — nothing to remove.');
		process.exit(0);
	}

	log(`add_user present: ${addUser.length} value(s)`);
	for (const v of addUser) {
		log(`  propValueId=${v._id}  reference=${v.reference}  string=${v.string ?? ''}`);
	}

	log('\nDraft mutation (NOT executed): DELETE /polyphony/property/{propValueId} for each id above.');
	log('Draft read-back plan: fetchEntity(client, POLYPHONY_DB_ENTITY_ID) again, assert entity.add_user is undefined/empty.');
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
