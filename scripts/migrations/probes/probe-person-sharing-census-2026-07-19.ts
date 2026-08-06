/**
 * probe-person-sharing-census-2026-07-19.ts
 *
 * Companion to probe-person-domain-sharing-2026-07-19.ts (issue #93).
 *
 * That probe measured what an in-domain reader can SEE. This one records the
 * surrounding population facts those conclusions lean on, so they are
 * reproducible instead of asserted:
 *
 *   A. _sharing census across every live person entity
 *   B. PII-field census across public persons (which fields actually exist)
 *   C. sharing value on every person property DEFINITION
 *   D. anonymous (no-JWT) reads at each sharing tier
 *
 * Originally run as throwaway scratchpad scripts on 2026-07-19; Perotin
 * correctly refused to record the results as LIVE-MEASURED without an
 * artifact. This script exists so the numbers have provenance.
 *
 * READ-ONLY. Creates nothing, mutates nothing. No teardown.
 *
 * [FIXED 2026-08-06] Section C queried `props=name,sharing` and read `.sharing` off the
 * response. Entu's real field is `_sharing` (underscore) — `sharing` is only an internal
 * `aggregate.js` pipeline alias, never exposed over the HTTP API. `props=sharing` matched
 * nothing and silently returned null for every prop-def, producing a false "0/21 have
 * sharing" reading. Caught by finn-2 against source, confirmed live by team-lead: real state
 * is 21/21 person prop-defs `_sharing:domain`. Fixed to `props=name,_sharing` / `._sharing`.
 *

 * Requires via env (~/.config/mvox/credentials.env):
 *   ENTU_API_KEY — PO's key (db-owner; needed to enumerate the private bucket)
 *
 * (*MVOX:Palestrina*)
 */

import { getJwt } from '../lib/entu-client.ts';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? 'polyphony';
const PO_API_KEY = process.env.ENTU_API_KEY ?? '';

if (!PO_API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

const PERSON_TYPE_ID = '69bcfd8e9c031ab8e6ce805f';

// Tier exemplars, verified 2026-07-19.
const TIER_SAMPLES: Array<[string, string]> = [
	['public', '6a0dd2384ff8277cd4305e9e'], // "Aino Kask"
	['domain', '6a097dcc90c8df7a1cc7d6dd'], // "Test User"
	['private', '69bcfd8e9c031ab8e6ce8079'], // PO person
];

const PII_FIELDS = ['name', 'forename', 'surname', 'email', 'phone', 'idcode', 'birthdate', 'address'];

const log = (msg: string) => console.log(`[census] ${msg}`);
const section = (t: string) => console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`);

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString() };

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: PO_API_KEY });
	const h = { Authorization: `Bearer ${jwt}` };

	section('A. _sharing census across all person entities');
	const listUrl =
		`${API_BASE}/${DB}/entity?_type.string=person` +
		`&props=_id,${PII_FIELDS.join(',')},_sharing,entu_user&limit=1000`;
	const listBody = (await (await fetch(listUrl, { headers: h })).json()) as {
		entities?: Array<Record<string, any>>;
		count?: number;
	};
	const persons = listBody.entities ?? [];
	const sharingCensus: Record<string, number> = {};
	for (const p of persons) {
		const s = p._sharing?.[0]?.string ?? 'ABSENT';
		sharingCensus[s] = (sharingCensus[s] ?? 0) + 1;
	}
	result.personTotal = persons.length;
	result.apiReportedCount = listBody.count ?? null;
	result.sharingCensus = sharingCensus;
	log(`total persons returned: ${persons.length} (api count field: ${listBody.count ?? 'n/a'})`);
	log(`census: ${JSON.stringify(sharingCensus)}`);
	if (listBody.count && listBody.count > persons.length) {
		log(`WARNING: api count ${listBody.count} exceeds returned ${persons.length} — census may be truncated`);
		result.censusTruncated = true;
	}

	section('B. PII-field census by tier (PO view = private bucket, i.e. everything)');
	const fieldCensus: Record<string, Record<string, number>> = {};
	for (const p of persons) {
		const tier = p._sharing?.[0]?.string ?? 'ABSENT';
		fieldCensus[tier] ??= {};
		for (const f of PII_FIELDS) {
			if (p[f]) fieldCensus[tier][f] = (fieldCensus[tier][f] ?? 0) + 1;
		}
	}
	result.fieldCensusByTier = fieldCensus;
	console.log(JSON.stringify(fieldCensus, null, 2));

	const oauthBound = persons.filter((p) => p.entu_user);
	result.oauthBoundPersons = oauthBound.map((p) => ({
		_id: p._id,
		sharing: p._sharing?.[0]?.string ?? null,
		name: p.name?.[0]?.string ?? null,
	}));
	log(`OAuth-bound persons: ${oauthBound.length}`);

	section('C. sharing value on each person property DEFINITION');
	// GUARD: Entu's stored field is `_sharing` (underscore); `sharing` is ONLY an internal
	// aggregate.js pipeline alias (aggregate.js:86). Query `_sharing`. If a query for `sharing`
	// returns nothing across an entire type, that is the SIGNATURE of this bug, not a finding.
	// Canonical schema.ts's `sharing?: Sharing` describes the projected shape, not stored data.
	// See docs/architecture/entu-rights-and-visibility-model.md §3 (+ its supersession list,
	// which already names this error from 2026-07-19).
	const defUrl =
		`${API_BASE}/${DB}/entity?_type.string=property` +
		`&_parent.reference=${PERSON_TYPE_ID}&props=name,_sharing&limit=200`;
	const defBody = (await (await fetch(defUrl, { headers: h })).json()) as {
		entities?: Array<Record<string, any>>;
	};
	const defs = (defBody.entities ?? []).map((d) => ({
		name: d.name?.[0]?.string ?? '(unnamed)',
		sharing: d._sharing?.[0]?.string ?? null,
	}));
	defs.sort((a, b) => a.name.localeCompare(b.name));
	result.propertyDefs = defs;
	result.propertyDefsWithSharing = defs.filter((d) => d.sharing !== null);
	log(`person property definitions: ${defs.length}`);
	log(`definitions WITH a sharing value: ${defs.filter((d) => d.sharing !== null).length}`);
	for (const d of defs) console.log(`  ${d.name.padEnd(26)} ${d.sharing ?? '(none)'}`);

	section('D. anonymous (no Authorization header) reads by tier');
	const anon: Array<Record<string, unknown>> = [];
	for (const [tier, id] of TIER_SAMPLES) {
		const url = `${API_BASE}/${DB}/entity/${id}?props=${PII_FIELDS.join(',')}`;
		const res = await fetch(url); // deliberately unauthenticated
		let body: any = null;
		try {
			body = await res.json();
		} catch {
			/* non-JSON body */
		}
		const props = Object.keys(body?.entity ?? {}).filter((k) => k !== '_id');
		anon.push({ tier, entityId: id, httpStatus: res.status, propsReturned: props });
		log(`${tier.padEnd(8)} ${id}  HTTP ${res.status}  props=${JSON.stringify(props)}`);
	}
	result.anonymousReads = anon;

	const { mkdirSync, writeFileSync } = await import('fs');
	const dir = new URL('../seed-results/', import.meta.url).pathname;
	mkdirSync(dir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const path = `${dir}probe-person-sharing-census-${ts}.json`;
	writeFileSync(path, JSON.stringify(result, null, 2));
	section('Artifact');
	log(path);
}

main().catch((e) => {
	console.error('FATAL:', e.message);
	process.exit(1);
});
