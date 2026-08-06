/**
 * probe-add-user-provisioned-persons-2026-08-06.ts
 *
 * Close-prep confirmation #2 for the add_user exposure (docs/migration/findings/
 * logged-in-anywhere-domain-read-2026-08-06.md). Team-lead needs the full set of
 * persons historically provisioned via createUserForAccount before scoping
 * add_user, so a "close it now" ruling executes cleanly against a known list.
 *
 * createUserForAccount assigns _parent = <add_user.reference> (entu-api
 * routes/auth/index.get.js:298-323) -- for polyphony that reference is the db
 * entity itself (69bcfd8e9c031ab8e6ce807a, confirmed in the prior add_user probe).
 * So: every person with _parent = that db entity id was created by this exact
 * auto-provision path.
 *
 * READ-ONLY. No mutations. Does NOT touch add_user or anything else.
 *
 * Run: npx tsx scripts/migrations/probes/probe-add-user-provisioned-persons-2026-08-06.ts
 */

import { getJwt, listEntities, POLYPHONY_DB_ENTITY_ID, type EntuClient } from '../lib/entu-client.ts';
import { writeResultArtifact } from '../perotin-toolkit.ts';

const API_BASE = process.env.ENTU_API_URL ?? process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString(), dbEntityId: POLYPHONY_DB_ENTITY_ID };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	section('Persons with _parent = db entity (add_user-provisioned)');
	const resp = await listEntities(client, {
		'_type.string': 'person',
		'_parent.reference': POLYPHONY_DB_ENTITY_ID,
		props: '_id,name,entu_user,_created,_sharing',
		limit: '500',
	});
	const persons = resp.entities ?? [];
	log(`count: ${persons.length} (api count=${resp.count ?? 'n/a'})`);

	const rows = persons.map((p) => {
		const eu = (p.entu_user as any[])?.[0];
		return {
			id: p._id,
			name: (p.name as any)?.[0]?.string ?? null,
			entuUserEmail: eu?.email ?? null,
			entuUserProvider: eu?.provider ?? null,
			created: (p._created as any[])?.[0]?.datetime ?? null,
			sharing: (p._sharing as any[])?.[0]?.string ?? 'ABSENT',
		};
	});
	for (const r of rows) {
		log(`  ${r.id}  email=${r.entuUserEmail}  name="${r.name}"  provider=${r.entuUserProvider}  created=${r.created}`);
	}
	result.persons = rows;
	result.count = rows.length;

	const expectedIds = ['6a2fc05e4cd971291c5d5ddc', '69bcfd8e9c031ab8e6ce8079'];
	const actualIds = rows.map((r) => r.id).sort();
	const matchesExpectation =
		actualIds.length === expectedIds.length && expectedIds.slice().sort().every((id, i) => id === actualIds[i]);
	log(`\nmatches expected set (only the 2 known OAuth persons): ${matchesExpectation}`);
	result.matchesExpectedTwoPersonSet = matchesExpectation;
	result.expectedIds = expectedIds.sort();
	result.actualIds = actualIds;

	const artifactPath = await writeResultArtifact('add-user-provisioned-persons', result);
	log(`\nresult artifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('FATAL:', err);
	process.exit(1);
});
