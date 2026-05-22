/**
 * Phase C AC verification probe — read-only
 *
 * Independent oracle confirming all 6 AC bullets from the Phase C spec are
 * satisfied in live Entu after the C.1-C.5 bundle execution.
 *
 * Bullets checked:
 *   1. inventory_copy instances: 0
 *   2. participation instances: 0
 *   3. affiliation instances: 0
 *   4. role instances: 0
 *   5. PO member entities: role property has 0 values (or absent)
 *   6. Retiring type-def entities return 404
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-phase-c-ac-verification-2026-05-21.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt, listInstancesByType, fetchEntity, type EntuClient } from '../lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

// From preflight probe-phase-c-preflight-2026-05-21T15-28-23-732.json
const PO_MEMBER_IDS = [
	'69c7f8728489bfcb0e81b085',
	'69c7f8788489bfcb0e81b1c9',
	'69c7f87e8489bfcb0e81b304',
	'69c7f8878489bfcb0e81b510',
];
const RETIRING_TYPE_DEF_IDS: Record<string, string> = {
	inventory_copy: '69c7ea508489bfcb0e819fed',
	participation: '69c7ea588489bfcb0e81a137',
	affiliation: '69c7ea598489bfcb0e81a178',
	role: '69c7ea468489bfcb0e819df9',
};

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

type BulletResult = { bullet: string; pass: boolean; detail: string };

async function check404(
	client: EntuClient,
	typeLabel: string,
	entityId: string,
): Promise<BulletResult> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${client.jwt}` } });
	if (res.status === 404) {
		return { bullet: `type-def 404: ${typeLabel}`, pass: true, detail: `${entityId} → 404` };
	}
	return {
		bullet: `type-def 404: ${typeLabel}`,
		pass: false,
		detail: `${entityId} → HTTP ${res.status} (expected 404)`,
	};
}

async function main() {
	console.log('Phase C AC verification probe');
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	const runAt = new Date().toISOString();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const results: BulletResult[] = [];

	// Bullet 1-4: instance counts for retiring types
	for (const typeName of ['inventory_copy', 'participation', 'affiliation', 'role'] as const) {
		console.log(`=== AC bullet: ${typeName} instances === `);
		const resp = await listInstancesByType(client, typeName, '_id');
		const count = ((resp as { entities?: unknown[] }).entities ?? []).length;
		const pass = count === 0;
		console.log(`  ${typeName} instances: ${count} (expected 0) → ${pass ? 'PASS' : 'FAIL'}`);
		results.push({ bullet: `${typeName} instances = 0`, pass, detail: `found ${count}` });
	}

	// Bullet 5: PO member entities have 0 role values
	console.log('\n=== AC bullet: member.role values === ');
	let memberRoleFail = false;
	const memberDetails: string[] = [];
	for (const memberId of PO_MEMBER_IDS) {
		const entity = (await fetchEntity(client, memberId)) as { role?: Array<{ _id?: string }> };
		const count = (entity.role ?? []).filter((v) => v._id).length;
		const ok = count === 0;
		if (!ok) memberRoleFail = true;
		const line = `member ${memberId}: ${count} role values`;
		console.log(`  ${line} → ${ok ? 'PASS' : 'FAIL'}`);
		memberDetails.push(line);
	}
	results.push({
		bullet: 'all PO members: role values = 0',
		pass: !memberRoleFail,
		detail: memberDetails.join('; '),
	});

	// Bullet 6: retiring type-defs return 404
	console.log('\n=== AC bullet: retiring type-defs return 404 ===');
	for (const [label, id] of Object.entries(RETIRING_TYPE_DEF_IDS)) {
		const result = await check404(client, label, id);
		console.log(`  ${result.detail} → ${result.pass ? 'PASS' : 'FAIL'}`);
		results.push(result);
	}

	const overallPass = results.every((r) => r.pass);
	const failingBullets = results.filter((r) => !r.pass);

	const artifact = {
		probe: 'probe-phase-c-ac-verification',
		runAt,
		db: DB,
		results,
		overallVerdict: overallPass ? 'PASS' : 'FAIL',
		failingBullets: failingBullets.map((r) => ({ bullet: r.bullet, detail: r.detail })),
	};

	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const dir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `probe-phase-c-ac-verification-${ts}.json`);
	writeFileSync(path, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${path}`);

	console.log('\n=== VERDICT ===');
	console.log(`Overall: ${artifact.overallVerdict}`);
	if (!overallPass) {
		console.log('Failing bullets:');
		for (const f of failingBullets) console.log(`  FAIL: ${f.bullet} — ${f.detail}`);
		process.exit(1);
	}
	console.log('All 9 checks PASS — Phase C AC satisfied.');
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
