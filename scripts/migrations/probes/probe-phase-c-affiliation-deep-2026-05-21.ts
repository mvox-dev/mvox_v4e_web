/**
 * Phase C affiliation deep probe — read-only
 * Fetch all affiliation + role-bearing member instances with all available props.
 * Run: pnpm exec tsx scripts/migrations/probes/probe-phase-c-affiliation-deep-2026-05-21.ts
 */

import { getJwt } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
if (!API_KEY) {
	console.error('ENTU_API_KEY required');
	process.exit(1);
}

async function rawGet(jwt: string, path: string): Promise<unknown> {
	const url = `${API_BASE}/${DB}/${path}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

async function main() {
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

	// Fetch each affiliation entity individually to get all props
	const listResp = (await rawGet(jwt, 'entity/?_type.string=affiliation&props=_id&limit=50')) as {
		entities?: Array<{ _id: string }>;
	};
	const ids = (listResp.entities ?? []).map((e) => e._id);
	console.log(`\nAffiliation count: ${ids.length}`);

	for (const id of ids) {
		const e = await rawGet(jwt, `entity/${id}`);
		console.log(`\naffiliation ${id}:`, JSON.stringify(e, null, 2));
	}

	// Fetch role-bearing members
	const roleResp = (await rawGet(
		jwt,
		'entity/?_type.string=member&props=_id,person,role,status,current_section,_parent&limit=20',
	)) as { entities?: unknown[] };
	const members = (roleResp.entities ?? []) as Array<{
		_id: string;
		role?: Array<{ string?: string }>;
		[k: string]: unknown;
	}>;
	const withRole = members.filter((m) => Array.isArray(m.role) && m.role.length > 0);
	console.log(`\nMembers with role (${withRole.length}):`);
	for (const m of withRole) {
		console.log(`  member ${m._id}:`, JSON.stringify(m));
	}
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
