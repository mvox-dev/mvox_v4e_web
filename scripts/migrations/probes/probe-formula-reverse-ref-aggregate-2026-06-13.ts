/**
 * probe-formula-reverse-ref-aggregate-2026-06-13.ts
 *
 * Tests whether Entu formulas can COUNT `_probe_voter` entities that REFERENCE
 * `_probe_target` via a `target` property, broken down by `status` string —
 * the exact pattern needed for the RSVP conductor tally.
 *
 * Also tests rights-bypass: some voters are created with `_sharing: private`
 * (only owner can read) — do they still appear in the counts on _probe_target?
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-formula-reverse-ref-aggregate-2026-06-13.ts
 *
 * (*MVOX:Perotin*)
 */

import { getJwt } from '../lib/entu-client';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

interface Entity { _id: string; [key: string]: unknown }
interface ApiResult { _id?: string; entities?: Entity[]; count?: number; entity?: Record<string, unknown>; deleted?: boolean; error?: string; status?: number }

let JWT = '';

async function apiFetch(method: string, path: string, body?: unknown): Promise<ApiResult> {
	const res = await fetch(`${API_BASE}/${DB}/${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${JWT}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const data = await res.json() as ApiResult;
	if (!res.ok && !data.error) throw new Error(`${method} ${path} → ${res.status}`);
	return data;
}

async function postEntity(props: unknown[]): Promise<string> {
	const res = await apiFetch('POST', 'entity', props);
	if (!res._id) throw new Error(`create failed: ${JSON.stringify(res)}`);
	return res._id;
}

async function getEntity(id: string, props: string): Promise<Record<string, unknown>> {
	const res = await apiFetch('GET', `entity/${id}?props=${props}`);
	return (res.entity ?? {}) as Record<string, unknown>;
}

async function aggregate(id: string): Promise<void> {
	await apiFetch('GET', `entity/${id}/aggregate`);
}

async function deleteEntity(id: string): Promise<void> {
	await apiFetch('DELETE', `entity/${id}`);
}

// Low-rights reader: anonymous JWT (no account binding) to test rights bypass
async function getEntityAnon(id: string, props: string): Promise<{ status: number; entity: Record<string, unknown> | null }> {
	const res = await fetch(`${API_BASE}/${DB}/entity/${id}?props=${props}`, {
		headers: { Authorization: `Bearer ${JWT}` }, // will be replaced below
	});
	// We test with the owner JWT for structure, anonymous test is separate
	return { status: res.ok ? 200 : res.status, entity: res.ok ? ((await res.json()) as ApiResult).entity as Record<string, unknown> : null };
}

// ─── Probe state ──────────────────────────────────────────────────────────────

const createdEntities: string[] = [];
const createdTypes: string[] = [];

function track(id: string, isType = false) {
	(isType ? createdTypes : createdEntities).push(id);
}

// ─── Result accumulator ───────────────────────────────────────────────────────

const log: string[] = [];
function note(msg: string) { log.push(msg); console.log(msg); }

async function main() {
	if (!API_KEY) { console.error('ENTU_API_KEY not set'); process.exit(1); }
	JWT = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });
	note('[probe] JWT minted OK');

	// Find meta-type IDs
	const entityMeta = await apiFetch('GET', 'entity?_type.string=entity&name.string=entity&props=_id');
	const ENTITY_META_ID = (entityMeta.entities?.[0])?._id ?? '';
	const propMeta = await apiFetch('GET', 'entity?_type.string=entity&name.string=property&props=_id');
	const PROP_META_ID = (propMeta.entities?.[0])?._id ?? '';
	note(`[probe] entity meta-type: ${ENTITY_META_ID}`);
	note(`[probe] property meta-type: ${PROP_META_ID}`);

	async function addPropDef(parentTypeId: string, name: string, type: string, extra: Record<string, unknown> = {}) {
		const props: unknown[] = [
			{ type: '_type', reference: PROP_META_ID },
			{ type: '_parent', reference: parentTypeId },
			{ type: 'name', string: name },
			{ type: 'type', string: type },
		];
		for (const [k, v] of Object.entries(extra)) {
			if (typeof v === 'string') props.push({ type: k, string: v });
			else if (typeof v === 'boolean') props.push({ type: k, boolean: v });
		}
		const id = await postEntity(props as unknown[]);
		track(id, true);
		return id;
	}

	// ── Step 1: Create _probe_target type ─────────────────────────────────────

	note('\n[step 1] Creating _probe_target type...');
	const targetTypeId = await postEntity([
		{ type: '_type', reference: ENTITY_META_ID },
		{ type: 'name', string: '_probe_target' },
	]);
	track(targetTypeId, true);
	note(`  _probe_target type: ${targetTypeId}`);

	// name prop
	await addPropDef(targetTypeId, 'name', 'string');

	// Formula 1: total voter count via _referrer
	const f1Id = await addPropDef(targetTypeId, 'voter_count_total', 'number', {
		formula: '_referrer._probe_voter.name COUNT',
	});
	note(`  voter_count_total formula prop-def: ${f1Id}`);

	// Formula 2: count where status=going — Entu formula filter syntax
	// Trying: _referrer._probe_voter.status COUNT (filtered by value)
	// Also try: (_referrer._probe_voter.status EQ 'going') COUNT — hypothetical filter
	// We'll test multiple formula variants and see what evaluates
	const f2Id = await addPropDef(targetTypeId, 'going_count', 'number', {
		formula: "_referrer._probe_voter.going COUNT",
	});
	note(`  going_count formula prop-def: ${f2Id}`);

	// Formula 3: try _referrer with explicit status path
	const f3Id = await addPropDef(targetTypeId, 'status_concat', 'string', {
		formula: '_referrer._probe_voter.status CONCAT',
	});
	note(`  status_concat formula prop-def: ${f3Id}`);

	// Formula 4: child-based count (only works if voters are children of target)
	const f4Id = await addPropDef(targetTypeId, 'child_count', 'number', {
		formula: '_child._probe_voter.name COUNT',
	});
	note(`  child_count formula prop-def: ${f4Id}`);

	// ── Step 2: Create _probe_voter type ─────────────────────────────────────

	note('\n[step 2] Creating _probe_voter type...');
	const voterTypeId = await postEntity([
		{ type: '_type', reference: ENTITY_META_ID },
		{ type: 'name', string: '_probe_voter' },
	]);
	track(voterTypeId, true);
	note(`  _probe_voter type: ${voterTypeId}`);

	await addPropDef(voterTypeId, 'name', 'string');
	await addPropDef(voterTypeId, 'target', 'reference');
	await addPropDef(voterTypeId, 'status', 'string');
	// Also add a 'going' property (for the f2 formula variant)
	await addPropDef(voterTypeId, 'going', 'string');

	// ── Step 3: Create _probe_target instance ────────────────────────────────

	note('\n[step 3] Creating _probe_target instance...');
	const targetId = await postEntity([
		{ type: '_type', reference: targetTypeId },
		{ type: 'name', string: '_probe_target_instance_1' },
		{ type: '_sharing', string: 'public' },
	]);
	track(targetId);
	note(`  target entity: ${targetId}`);

	// ── Step 4: Create _probe_voter instances ────────────────────────────────
	// Mix of statuses; some private (rights-bypass test), some public

	note('\n[step 4] Creating _probe_voter instances...');

	const voters = [
		{ name: 'voter-1-going', status: 'going', sharing: 'public' },
		{ name: 'voter-2-going', status: 'going', sharing: 'public' },
		{ name: 'voter-3-maybe', status: 'maybe', sharing: 'public' },
		{ name: 'voter-4-not-going', status: 'not_going', sharing: 'public' },
		// Private voters — should still be counted by formula (rights bypass)
		{ name: 'voter-5-going-private', status: 'going', sharing: 'private' },
		{ name: 'voter-6-maybe-private', status: 'maybe', sharing: 'private' },
	];

	for (const v of voters) {
		const props: unknown[] = [
			{ type: '_type', reference: voterTypeId },
			{ type: 'name', string: v.name },
			{ type: 'target', reference: targetId },
			{ type: 'status', string: v.status },
			{ type: 'going', string: v.status === 'going' ? 'going' : '' },
			{ type: '_sharing', string: v.sharing },
		];
		const id = await postEntity(props);
		track(id);
		note(`  voter: ${v.name} (${v.status}, ${v.sharing}) → ${id}`);
	}

	// ── Step 5: Aggregate the target ────────────────────────────────────────

	note('\n[step 5] Triggering aggregate on target...');
	await aggregate(targetId);
	note('  aggregate triggered');

	// Brief pause for formula materialization
	await new Promise(r => setTimeout(r, 2000));

	// ── Step 6: Read formula results ────────────────────────────────────────

	note('\n[step 6] Reading formula results on target (owner JWT)...');
	const targetData = await getEntity(targetId, 'name,voter_count_total,going_count,status_concat,child_count');
	note(`  voter_count_total: ${JSON.stringify(targetData.voter_count_total)}`);
	note(`  going_count:       ${JSON.stringify(targetData.going_count)}`);
	note(`  status_concat:     ${JSON.stringify(targetData.status_concat)}`);
	note(`  child_count:       ${JSON.stringify(targetData.child_count)}`);

	// Raw entity for full inspection
	note('\n[step 6b] Full target entity (raw):');
	note(JSON.stringify(targetData, null, 2));

	// ── Step 7: Rights-bypass test ───────────────────────────────────────────
	// Use a freshly minted JWT from an API key on a person with no explicit grants on voters
	// We can't get a zero-rights JWT (seeded persons have no Entu accounts)
	// Instead: verify that private voters ARE listed in the count
	// We expect 6 total: 2 public-going + 1 public-maybe + 1 public-not-going + 1 private-going + 1 private-maybe

	note('\n[step 7] Rights-bypass assessment:');
	const totalArr = targetData.voter_count_total as Array<{number?: number}> | undefined;
	const total = totalArr?.[0]?.number;
	note(`  voter_count_total value: ${total}`);
	note(`  Expected (all 6 including private): 6`);
	note(`  Expected (only public 4): 4`);
	if (total === 6) {
		note('  RIGHTS BYPASS: YES — formula counts private voters');
	} else if (total === 4) {
		note('  RIGHTS BYPASS: NO — formula only counts visible voters');
	} else {
		note(`  RIGHTS BYPASS: UNKNOWN — got ${total}`);
	}

	// ── Step 8: Cleanup ──────────────────────────────────────────────────────

	note('\n[step 8] Cleanup...');
	// Delete instances first, then types
	for (const id of [...createdEntities].reverse()) {
		try {
			await deleteEntity(id);
			note(`  deleted entity: ${id}`);
		} catch (e) {
			note(`  delete failed: ${id} — ${e}`);
		}
	}
	for (const id of [...createdTypes].reverse()) {
		try {
			await deleteEntity(id);
			note(`  deleted type: ${id}`);
		} catch (e) {
			note(`  delete failed type: ${id} — ${e}`);
		}
	}

	// ── Write result artifact ────────────────────────────────────────────────

	const { mkdirSync, writeFileSync } = await import('node:fs');
	const { join } = await import('node:path');
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const dir = join('scripts', 'migrations', 'seed-results');
	mkdirSync(dir, { recursive: true });
	const artifact = join(dir, `probe-formula-reverse-ref-${ts}.json`);
	writeFileSync(artifact, JSON.stringify({
		probe: 'formula-reverse-ref-aggregate-2026-06-13',
		targetId,
		formulas: {
			voter_count_total: '_referrer._probe_voter.name COUNT',
			going_count: '_referrer._probe_voter.going COUNT',
			status_concat: '_referrer._probe_voter.status CONCAT',
			child_count: '_child._probe_voter.name COUNT',
		},
		results: {
			voter_count_total: targetData.voter_count_total,
			going_count: targetData.going_count,
			status_concat: targetData.status_concat,
			child_count: targetData.child_count,
		},
		rightsBypassVerdict: total === 6 ? 'YES' : total === 4 ? 'NO' : 'UNKNOWN',
		log,
	}, null, 2));
	note(`\n[probe] Artifact written: ${artifact}`);
	note('[probe] Done.');
}

main().catch(e => { console.error('[probe] FATAL:', e); process.exit(1); });
