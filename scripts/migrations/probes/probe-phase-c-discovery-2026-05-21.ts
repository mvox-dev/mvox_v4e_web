/**
 * Phase C discovery probe — read-only
 * Maps current live state of the four Phase C entity types before any mutations.
 *
 * Questions answered:
 * 1. inventory_copy — count + typical instance shape (which props populated)
 * 2. participation — count + prop-shape (rsvp_status / attended / confirmed_at presence)
 * 3. affiliation — count + what each links (person↔org? person↔section?)
 * 4. member instances with role property set — count + value distribution
 *
 * Authorization: read-only. No writes.
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-phase-c-discovery-2026-05-21.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

async function rawGet(jwt: string, path: string): Promise<unknown> {
	const url = `${API_BASE}/${DB}/${path}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

type PropValue = {
	_id?: string;
	string?: string;
	reference?: string;
	boolean?: boolean;
	integer?: number;
};
type AnyEntity = { _id: string; [key: string]: unknown };

function topProps(entities: AnyEntity[], topN = 5): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const e of entities) {
		for (const key of Object.keys(e)) {
			if (key.startsWith('_')) continue;
			counts[key] = (counts[key] ?? 0) + 1;
		}
	}
	return Object.fromEntries(
		Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, topN),
	);
}

async function fetchAll(
	jwt: string,
	typeString: string,
	props: string,
	limit = 500,
): Promise<AnyEntity[]> {
	const resp = (await rawGet(
		jwt,
		`entity/?_type.string=${typeString}&props=${props}&limit=${limit}`,
	)) as {
		entities?: AnyEntity[];
		count?: number;
	};
	const entities = resp.entities ?? [];
	const total = resp.count ?? entities.length;
	if (total > limit) {
		console.warn(`  WARNING: ${typeString} total=${total} > limit=${limit}; results truncated`);
	}
	return entities;
}

async function main() {
	console.log('Phase C discovery probe — read-only');
	console.log(`DB: ${DB}`);
	console.log(`Time: ${new Date().toISOString()}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });

	const findings: {
		runAt: string;
		db: string;
		inventoryCopy: {
			count: number;
			sampleSize: number;
			propPresence: Record<string, number>;
			sampleInstances: AnyEntity[];
		};
		participation: {
			count: number;
			sampleSize: number;
			propPresence: Record<string, number>;
			sampleInstances: AnyEntity[];
		};
		affiliation: {
			count: number;
			sampleSize: number;
			propPresence: Record<string, number>;
			sampleInstances: AnyEntity[];
		};
		memberWithRole: {
			totalMembers: number;
			membersWithRole: number;
			roleValueDistribution: Record<string, number>;
			sampleInstances: AnyEntity[];
		};
	} = {
		runAt: new Date().toISOString(),
		db: DB,
		inventoryCopy: { count: 0, sampleSize: 0, propPresence: {}, sampleInstances: [] },
		participation: { count: 0, sampleSize: 0, propPresence: {}, sampleInstances: [] },
		affiliation: { count: 0, sampleSize: 0, propPresence: {}, sampleInstances: [] },
		memberWithRole: {
			totalMembers: 0,
			membersWithRole: 0,
			roleValueDistribution: {},
			sampleInstances: [],
		},
	};

	// ── 1. inventory_copy ──────────────────────────────────────────────────────
	console.log('=== 1. inventory_copy ===');
	const copies = await fetchAll(
		jwt,
		'inventory_copy',
		'_id,edition,copy_number,condition,lending,borrower,checked_out_at,due_date,notes',
	);
	findings.inventoryCopy.count = copies.length;
	findings.inventoryCopy.sampleSize = copies.length;
	findings.inventoryCopy.propPresence = topProps(copies, 20);
	findings.inventoryCopy.sampleInstances = copies.slice(0, 3);
	console.log(`  count: ${copies.length}`);
	console.log(
		`  prop presence (by frequency): ${JSON.stringify(findings.inventoryCopy.propPresence)}`,
	);
	if (copies.length > 0) {
		console.log(`  sample[0]: ${JSON.stringify(copies[0])}`);
	}

	// ── 2. participation ───────────────────────────────────────────────────────
	console.log('\n=== 2. participation ===');
	const participations = await fetchAll(
		jwt,
		'participation',
		'_id,member,event,rsvp_status,attended,confirmed_at,notes,role',
	);
	findings.participation.count = participations.length;
	findings.participation.sampleSize = participations.length;
	findings.participation.propPresence = topProps(participations, 20);
	findings.participation.sampleInstances = participations.slice(0, 3);
	console.log(`  count: ${participations.length}`);
	console.log(
		`  prop presence (by frequency): ${JSON.stringify(findings.participation.propPresence)}`,
	);
	if (participations.length > 0) {
		console.log(`  sample[0]: ${JSON.stringify(participations[0])}`);
	}

	// ── 3. affiliation ────────────────────────────────────────────────────────
	console.log('\n=== 3. affiliation ===');
	const affiliations = await fetchAll(
		jwt,
		'affiliation',
		'_id,person,organization,section,role,start_date,end_date,notes',
	);
	findings.affiliation.count = affiliations.length;
	findings.affiliation.sampleSize = affiliations.length;
	findings.affiliation.propPresence = topProps(affiliations, 20);
	findings.affiliation.sampleInstances = affiliations.slice(0, 3);
	console.log(`  count: ${affiliations.length}`);
	console.log(
		`  prop presence (by frequency): ${JSON.stringify(findings.affiliation.propPresence)}`,
	);
	if (affiliations.length > 0) {
		console.log(`  sample[0]: ${JSON.stringify(affiliations[0])}`);
	}

	// ── 4. member with role ───────────────────────────────────────────────────
	console.log('\n=== 4. member.role ===');
	const allMembers = await fetchAll(jwt, 'member', '_id,person,role,status,current_section', 500);
	findings.memberWithRole.totalMembers = allMembers.length;

	const membersWithRole = allMembers.filter((m) => {
		const roleVals = m.role as PropValue[] | undefined;
		return Array.isArray(roleVals) && roleVals.length > 0;
	});
	findings.memberWithRole.membersWithRole = membersWithRole.length;

	const roleDist: Record<string, number> = {};
	for (const m of membersWithRole) {
		const roleVals = m.role as PropValue[] | undefined;
		for (const v of roleVals ?? []) {
			const val = v.string ?? '(no string)';
			roleDist[val] = (roleDist[val] ?? 0) + 1;
		}
	}
	findings.memberWithRole.roleValueDistribution = roleDist;
	findings.memberWithRole.sampleInstances = membersWithRole.slice(0, 3);

	console.log(`  total members: ${allMembers.length}`);
	console.log(`  members with role: ${membersWithRole.length}`);
	console.log(`  role value distribution: ${JSON.stringify(roleDist)}`);

	// ── Write artifact ─────────────────────────────────────────────────────────
	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const resultsDir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(resultsDir, { recursive: true });
	const artifactPath = join(resultsDir, `probe-phase-c-discovery-${ts}.json`);
	writeFileSync(artifactPath, JSON.stringify(findings, null, 2));
	console.log(`\nArtifact: ${artifactPath}`);

	// ── Summary ───────────────────────────────────────────────────────────────
	console.log('\n=== SUMMARY ===');
	console.log(`inventory_copy: ${findings.inventoryCopy.count}`);
	console.log(`participation:  ${findings.participation.count}`);
	console.log(`affiliation:    ${findings.affiliation.count}`);
	console.log(
		`member total:   ${findings.memberWithRole.totalMembers}  with role: ${findings.memberWithRole.membersWithRole}`,
	);
	console.log(`role dist:      ${JSON.stringify(findings.memberWithRole.roleValueDistribution)}`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
