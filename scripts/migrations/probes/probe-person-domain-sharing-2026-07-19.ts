/**
 * probe-person-domain-sharing-2026-07-19.ts
 *
 * Confirmatory probe for issue #93: does a genuine in-domain, non-omniscient
 * user get ANY ordinary (non-rights) properties back when GETting another
 * person entity, at each _sharing tier, absent an explicit rights grant?
 *
 * Precedent: slice3-list-visibility-definitive-2026-06-15.md line 39 showed
 * this pattern on an ORG entity (domain-shared, non-owner reads
 * ?props=_owner,_editor,name -> empty {}). This probe repeats it on PERSON
 * entities specifically, which is what #93 turns on.
 *
 * Reader identity: person 6a2fc05e4cd971291c5d5ddc — the PO's real second
 * Google OAuth account (uid people/103228544448049423783). It has an
 * entu_user binding, so an injected entu_api_key yields a properly
 * account-bound (in-domain) JWT, unlike seeded persons which yield an
 * anonymous JWT (see member-tier-rights-visibility-2026-06-12.md).
 *
 * LIVE MUTATION: POSTs one entu_api_key property to the reader person, then
 * DELETEs it in teardown (finally block, runs on failure too). Nothing else
 * is created or modified. Authorized by PO 2026-07-19.
 *
 * Requires via env (~/.config/mvox/credentials.env):
 *   ENTU_API_KEY — PO's key (db-owner; setup, teardown, precondition checks)
 *
 * (*MVOX:Finn — drafted; retargeted + mutation/teardown added by Palestrina*)
 */

import { getJwt, fetchEntity } from '../lib/entu-client.ts';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? 'polyphony';
const PO_API_KEY = process.env.ENTU_API_KEY ?? '';

if (!PO_API_KEY) {
	console.error('ERROR: ENTU_API_KEY not set. Source ~/.config/mvox/credentials.env first.');
	process.exit(1);
}

// Live IDs verified 2026-07-19 (prior probe IDs were stale — admin person
// 6a2f3f96... is 404/deleted; it re-provisioned under the id below).
const READER_PERSON_ID = '6a2fc05e4cd971291c5d5ddc'; // 2nd OAuth acct, _sharing:domain
const TARGET_DOMAIN_ID = '6a097dcc90c8df7a1cc7d6dd'; // "Test User", _sharing:domain
const TARGET_PUBLIC_ID = '6a0dd2384ff8277cd4305e9e'; // "Aino Kask", _sharing:public
const TARGET_PRIVATE_ID = '69bcfd8e9c031ab8e6ce8079'; // PO person, _sharing:private

const PROPS_TO_CHECK = 'name,email,phone,forename,surname,address,birthdate,idcode';

const log = (msg: string) => console.log(`[probe] ${msg}`);
const section = (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);

interface ReadOutcome {
	targetId: string;
	tier: string;
	httpStatus: number;
	propsReturned: string[];
	body: unknown;
}

async function readAs(jwt: string, targetId: string, tier: string): Promise<ReadOutcome> {
	const url = `${API_BASE}/${DB}/entity/${targetId}?props=${encodeURIComponent(PROPS_TO_CHECK)}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	let body: unknown = null;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	const ent = (body as { entity?: Record<string, unknown> } | null)?.entity ?? {};
	const propsReturned = Object.keys(ent).filter((k) => k !== '_id');
	return { targetId, tier, httpStatus: res.status, propsReturned, body };
}

async function main() {
	const result: Record<string, unknown> = { timestamp: new Date().toISOString() };
	let keyPropId: string | null = null;
	let poJwt = '';

	try {
		section('Setup: PO auth');
		poJwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: PO_API_KEY });
		const poClient = { apiBase: API_BASE, db: DB, jwt: poJwt };

		section('Precondition: reader holds no rights grant on any target');
		for (const [tier, id] of [
			['domain', TARGET_DOMAIN_ID],
			['public', TARGET_PUBLIC_ID],
		] as const) {
			const t = await fetchEntity(poClient, id);
			const refs = (['_viewer', '_editor', '_owner'] as const).flatMap((k) =>
				((t[k] as Array<{ reference?: string }> | undefined) ?? []).map((v) => v.reference),
			);
			const granted = refs.includes(READER_PERSON_ID);
			const sharing = (t._sharing as Array<{ string?: string }> | undefined)?.[0]?.string ?? null;
			log(`${tier} target ${id}: _sharing=${sharing}, reader-granted=${granted}`);
			if (sharing !== tier || granted) {
				throw new Error(`PRECONDITION FAILED for ${tier} target (sharing=${sharing}, granted=${granted})`);
			}
		}
		log('Preconditions OK.');

		section('Mutation: provision entu_api_key on reader person');
		const postRes = await fetch(`${API_BASE}/${DB}/entity/${READER_PERSON_ID}`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${poJwt}`, 'Content-Type': 'application/json' },
			body: JSON.stringify([{ type: 'entu_api_key', string: `_probe_s93_${Date.now()}` }]),
		});
		if (!postRes.ok) throw new Error(`key POST failed: ${postRes.status} ${await postRes.text()}`);
		const postBody = await postRes.json();
		// Entu hashes entu_api_key and returns *** on later GETs — the raw value
		// is only readable in this create response. Capture now or lose it.
		const created = (postBody?.properties ?? []) as Array<{ _id?: string; string?: string; type?: string }>;
		const keyProp = created.find((p) => p.type === 'entu_api_key') ?? created[0];
		keyPropId = keyProp?._id ?? null;
		const rawKey = keyProp?.string ?? '';
		log(`key prop created: _id=${keyPropId}`);
		if (!rawKey) throw new Error(`no raw key in create response: ${JSON.stringify(postBody).slice(0, 400)}`);

		section('Reader auth');
		const readerJwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: rawKey });
		const payload = JSON.parse(Buffer.from(readerJwt.split('.')[1], 'base64url').toString());
		const bound = Boolean(payload?.accounts?.[DB]);
		result.readerAccountsBound = bound;
		result.readerAccountId = payload?.accounts?.[DB] ?? null;
		log(`reader accounts bound: ${bound} (${payload?.accounts?.[DB] ?? 'none'})`);
		if (!bound) throw new Error('reader JWT has no accounts binding — not a genuine in-domain identity');

		section('Reads as in-domain non-omniscient reader');
		const reads: ReadOutcome[] = [];
		reads.push(await readAs(readerJwt, TARGET_DOMAIN_ID, 'domain'));
		reads.push(await readAs(readerJwt, TARGET_PUBLIC_ID, 'public'));
		reads.push(await readAs(readerJwt, TARGET_PRIVATE_ID, 'private'));
		reads.push(await readAs(readerJwt, READER_PERSON_ID, 'self(domain)'));
		result.reads = reads;
		for (const r of reads) {
			log(`${r.tier.padEnd(14)} ${r.targetId}  HTTP ${r.httpStatus}  props=${JSON.stringify(r.propsReturned)}`);
		}

		section('Verdict');
		const domainRead = reads.find((r) => r.tier === 'domain')!;
		const selfRead = reads.find((r) => r.tier === 'self(domain)')!;
		const verdict =
			domainRead.propsReturned.length === 0
				? 'CONFIRMED — _sharing:domain does NOT expose person properties to an in-domain non-granted reader'
				: `REFUTED — domain DOES expose person properties: ${domainRead.propsReturned.join(', ')}`;
		result.verdict = verdict;
		result.selfReadControl =
			selfRead.propsReturned.length > 0
				? `VALID — reader sees own properties (${selfRead.propsReturned.join(', ')}), so the empty reads above are a rights result, not a broken credential`
				: 'WARNING — reader cannot see even its OWN properties; credential may be malformed, treat other results with suspicion';
		log(verdict);
		log(String(result.selfReadControl));
	} finally {
		section('Teardown');
		if (keyPropId && poJwt) {
			const del = await fetch(`${API_BASE}/${DB}/property/${keyPropId}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${poJwt}` },
			});
			log(`delete key prop ${keyPropId}: HTTP ${del.status}`);
			result.teardown = { keyPropId, status: del.status, ok: del.ok };
		} else {
			log('nothing to tear down');
			result.teardown = { keyPropId, skipped: true };
		}

		const { mkdirSync, writeFileSync } = await import('fs');
		const resultsDir = new URL('../seed-results/', import.meta.url).pathname;
		mkdirSync(resultsDir, { recursive: true });
		const ts = new Date().toISOString().replace(/[:.]/g, '-');
		const artifactPath = `${resultsDir}probe-person-domain-sharing-${ts}.json`;
		writeFileSync(artifactPath, JSON.stringify(result, null, 2));
		log(`Result artifact: ${artifactPath}`);
	}
}

main().catch((e) => {
	console.error('FATAL:', e.message);
	process.exit(1);
});
