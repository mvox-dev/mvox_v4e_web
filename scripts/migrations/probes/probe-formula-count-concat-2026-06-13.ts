/**
 * probe-formula-count-concat-2026-06-13.ts
 *
 * Settles two Entu formula mechanics for slice-2b RSVP tally:
 *
 * Q1 — Can a formula reference other formula properties on the same entity
 *      (formula-reads-formula, dependency ordering)?
 *      Test: 4 count formulas + a 5th "tally" formula that CONCATs the counts.
 *
 * Q2 — Can ONE formula COUNT multiple reverse-refs AND concat them in a single
 *      expression? Tests several RPN arrangements to determine COUNT scope
 *      (whole-stack vs preceding-slot) and whether any single-formula
 *      count+concat works.
 *
 * Run: pnpm exec tsx scripts/migrations/probes/probe-formula-count-concat-2026-06-13.ts
 *
 * (*MVOX:Perotin*)
 */

import { getJwt } from '../lib/entu-client';
import { writeResultArtifact } from '../perotin-toolkit';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = 'polyphony';
const API_KEY = process.env.ENTU_API_KEY ?? '';

interface ApiResult {
	_id?: string;
	entities?: Array<{ _id: string }>;
	entity?: Record<string, unknown>;
	deleted?: boolean;
	error?: unknown;
}

let JWT = '';

async function api(method: string, path: string, body?: unknown): Promise<ApiResult> {
	const res = await fetch(`${API_BASE}/${DB}/${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${JWT}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	try { return JSON.parse(text) as ApiResult; } catch { return { error: text }; }
}

async function create(props: unknown[]): Promise<string> {
	const r = await api('POST', 'entity', props);
	if (!r._id) throw new Error(`create failed: ${JSON.stringify(r)}`);
	return r._id;
}

async function getEnt(id: string, props: string): Promise<Record<string, unknown>> {
	const r = await api('GET', `entity/${id}?props=${props}`);
	return (r.entity ?? {}) as Record<string, unknown>;
}

async function agg(id: string): Promise<void> {
	await api('GET', `entity/${id}/aggregate`);
}

async function del(id: string): Promise<void> {
	await api('DELETE', `entity/${id}`);
}

const log: string[] = [];
function note(msg: string) { log.push(msg); console.log(msg); }

const allEntities: string[] = [];
const allTypes: string[] = [];

function trackEnt(id: string) { allEntities.push(id); return id; }
function trackType(id: string) { allTypes.push(id); return id; }

async function main() {
	if (!API_KEY) { console.error('ENTU_API_KEY not set'); process.exit(1); }
	JWT = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY });

	const emId = (await api('GET', 'entity?_type.string=entity&name.string=entity&props=_id'))
		.entities?.[0]?._id ?? '';
	const pmId = (await api('GET', 'entity?_type.string=entity&name.string=property&props=_id'))
		.entities?.[0]?._id ?? '';
	note(`[probe] entity-meta=${emId}  prop-meta=${pmId}`);

	async function propDef(parentId: string, name: string, type: string, extra: Record<string, unknown> = {}) {
		const props: unknown[] = [
			{ type: '_type', reference: pmId },
			{ type: '_parent', reference: parentId },
			{ type: 'name', string: name },
			{ type: 'type', string: type },
		];
		for (const [k, v] of Object.entries(extra)) {
			if (typeof v === 'string') props.push({ type: k, string: v });
			else if (typeof v === 'boolean') props.push({ type: k, boolean: v });
		}
		const id = await create(props);
		trackType(id);
		return id;
	}

	// ── 1. Create _probe_event type ───────────────────────────────────────────

	note('\n=== [Q1+Q2] Creating _probe_event type ===');
	const evTypeId = trackType(await create([
		{ type: '_type', reference: emId },
		{ type: 'name', string: '_probe_event' },
	]));
	note(`  _probe_event type: ${evTypeId}`);

	await propDef(evTypeId, 'name', 'string');

	// Q1 — 4 count formulas + 1 tally formula that reads them
	const going_count_fid  = await propDef(evTypeId, 'going_count',     'number', { formula: '_referrer._probe_rsvp.going_ref COUNT' });
	const maybe_count_fid  = await propDef(evTypeId, 'maybe_count',     'number', { formula: '_referrer._probe_rsvp.maybe_ref COUNT' });
	const ng_count_fid     = await propDef(evTypeId, 'not_going_count', 'number', { formula: '_referrer._probe_rsvp.not_going_ref COUNT' });
	const late_count_fid   = await propDef(evTypeId, 'late_count',      'number', { formula: '_referrer._probe_rsvp.late_ref COUNT' });
	note(`  count prop-defs: going=${going_count_fid} maybe=${maybe_count_fid} not_going=${ng_count_fid} late=${late_count_fid}`);

	// Q1 tally: formula references the 4 count formula props on the same entity
	// RPN: push string literals + formula-prop values, then CONCAT the whole stack
	const tally_fid = await propDef(evTypeId, 'tally', 'string', {
		formula: '"{\\"going\\":" going_count ",\\"maybe\\":" maybe_count ",\\"not_going\\":" not_going_count ",\\"late\\":" late_count "}" CONCAT',
	});
	note(`  tally formula prop-def: ${tally_fid}`);

	// Q2 — single formula that tries to COUNT multiple referrers and concat inline
	// Hypothesis: COUNT reduces ALL stack values pushed so far (whole-stack).
	// If whole-stack: `going_ref COUNT` after pushing string literals would count
	//   the literal strings too → wrong. We need to test both:
	//
	// Q2a: naive interleaved (expected to fail if COUNT is whole-stack):
	//   '{"going":' _referrer._probe_rsvp.going_ref COUNT ',"maybe":' _referrer._probe_rsvp.maybe_ref COUNT ... CONCAT
	//
	// Q2b: counts-first then concat:
	//   _referrer._probe_rsvp.going_ref COUNT _referrer._probe_rsvp.maybe_ref COUNT ... CONCAT
	//   (no string literals mixed in during counting phase)
	//
	// Q2c: try the _referrer ... COUNT syntax after a string push
	//   '"going":' _referrer._probe_rsvp.going_ref COUNT CONCAT
	//   then repeat for each status

	const q2a_fid = await propDef(evTypeId, 'q2a_interleaved', 'string', {
		formula: '"{going:" _referrer._probe_rsvp.going_ref COUNT ",maybe:" _referrer._probe_rsvp.maybe_ref COUNT "}" CONCAT',
	});
	note(`  q2a_interleaved formula prop-def: ${q2a_fid}`);

	const q2b_fid = await propDef(evTypeId, 'q2b_counts_first', 'string', {
		formula: '_referrer._probe_rsvp.going_ref COUNT _referrer._probe_rsvp.maybe_ref COUNT _referrer._probe_rsvp.not_going_ref COUNT CONCAT',
	});
	note(`  q2b_counts_first formula prop-def: ${q2b_fid}`);

	// Q2c: partial — just going + literal, to isolate COUNT scope
	const q2c_fid = await propDef(evTypeId, 'q2c_one_count_concat', 'string', {
		formula: '"going=" _referrer._probe_rsvp.going_ref COUNT CONCAT',
	});
	note(`  q2c_one_count_concat formula prop-def: ${q2c_fid}`);

	// Also test: formula reading a formula that was just defined above (simpler Q1 variant)
	// going_count is already a formula; does a simple "going_count" reference in another formula work?
	const q1_simple_fid = await propDef(evTypeId, 'q1_going_times2', 'number', {
		formula: 'going_count 2 *',
	});
	note(`  q1_going_times2 formula prop-def (simple formula-reads-formula): ${q1_simple_fid}`);

	// ── 2. Create _probe_rsvp type ────────────────────────────────────────────

	note('\n=== Creating _probe_rsvp type ===');
	const rsvpTypeId = trackType(await create([
		{ type: '_type', reference: emId },
		{ type: 'name', string: '_probe_rsvp' },
	]));
	note(`  _probe_rsvp type: ${rsvpTypeId}`);

	await propDef(rsvpTypeId, 'name', 'string');
	await propDef(rsvpTypeId, 'status', 'string');
	await propDef(rsvpTypeId, 'going_ref',     'reference');
	await propDef(rsvpTypeId, 'maybe_ref',     'reference');
	await propDef(rsvpTypeId, 'not_going_ref', 'reference');
	await propDef(rsvpTypeId, 'late_ref',      'reference');

	// ── 3. Create instances ───────────────────────────────────────────────────

	note('\n=== Creating event instance ===');
	const evId = trackEnt(await create([
		{ type: '_type', reference: evTypeId },
		{ type: 'name', string: '_probe_event_1' },
		{ type: '_sharing', string: 'public' },
	]));
	note(`  event: ${evId}`);

	note('\n=== Creating rsvp instances ===');
	// 3 going, 2 maybe, 1 not_going, 1 late — mix of private + public
	const rsvpSpecs = [
		{ name: 'r-going-1',   status: 'going',     sentinel: 'going_ref',     sharing: 'public'  },
		{ name: 'r-going-2',   status: 'going',     sentinel: 'going_ref',     sharing: 'public'  },
		{ name: 'r-going-3',   status: 'going',     sentinel: 'going_ref',     sharing: 'private' },
		{ name: 'r-maybe-1',   status: 'maybe',     sentinel: 'maybe_ref',     sharing: 'public'  },
		{ name: 'r-maybe-2',   status: 'maybe',     sentinel: 'maybe_ref',     sharing: 'private' },
		{ name: 'r-ng-1',      status: 'not_going', sentinel: 'not_going_ref', sharing: 'public'  },
		{ name: 'r-late-1',    status: 'late',      sentinel: 'late_ref',      sharing: 'private' },
	];

	for (const s of rsvpSpecs) {
		const props: unknown[] = [
			{ type: '_type', reference: rsvpTypeId },
			{ type: 'name', string: s.name },
			{ type: 'status', string: s.status },
			{ type: s.sentinel, reference: evId },
			{ type: '_sharing', string: s.sharing },
		];
		const id = trackEnt(await create(props));
		note(`  ${s.name} (${s.status}, ${s.sharing}) → ${id}`);
	}

	// ── 4. Aggregate + read ───────────────────────────────────────────────────

	note('\n=== Aggregating event ===');
	await agg(evId);
	await new Promise(r => setTimeout(r, 2500));

	note('\n=== Reading all formula results ===');
	const propList = 'name,going_count,maybe_count,not_going_count,late_count,tally,q1_going_times2,q2a_interleaved,q2b_counts_first,q2c_one_count_concat';
	const evData = await getEnt(evId, propList);

	function val(data: Record<string, unknown>, prop: string): unknown {
		const arr = data[prop] as Array<{number?: number; string?: string}> | undefined;
		if (!arr || arr.length === 0) return null;
		return arr[0].number ?? arr[0].string ?? null;
	}

	const going_val     = val(evData, 'going_count');
	const maybe_val     = val(evData, 'maybe_count');
	const ng_val        = val(evData, 'not_going_count');
	const late_val      = val(evData, 'late_count');
	const tally_val     = val(evData, 'tally');
	const q1times2_val  = val(evData, 'q1_going_times2');
	const q2a_val       = val(evData, 'q2a_interleaved');
	const q2b_val       = val(evData, 'q2b_counts_first');
	const q2c_val       = val(evData, 'q2c_one_count_concat');

	note('\n--- Q1 results ---');
	note(`  going_count  = ${going_val}   (expected 3)`);
	note(`  maybe_count  = ${maybe_val}   (expected 2)`);
	note(`  not_going_count = ${ng_val}  (expected 1)`);
	note(`  late_count   = ${late_val}   (expected 1)`);
	note(`  tally (formula-reads-formula) = ${JSON.stringify(tally_val)}`);
	note(`  q1_going_times2 (going_count * 2) = ${q1times2_val}  (expected 6)`);

	const q1_counts_ok = (going_val === 3 && maybe_val === 2 && ng_val === 1 && late_val === 1);
	const q1_tally_ok  = typeof tally_val === 'string' && tally_val.includes('3') && tally_val.includes('2');
	const q1_times2_ok = (q1times2_val === 6);
	note(`  Q1 counts correct: ${q1_counts_ok}`);
	note(`  Q1 tally contains correct numbers: ${q1_tally_ok} — raw: ${JSON.stringify(tally_val)}`);
	note(`  Q1 formula-reads-formula (times2): ${q1_times2_ok}`);

	note('\n--- Q2 results ---');
	note(`  q2a_interleaved    = ${JSON.stringify(q2a_val)}`);
	note(`  q2b_counts_first   = ${JSON.stringify(q2b_val)}`);
	note(`  q2c_one_count_concat = ${JSON.stringify(q2c_val)}`);

	// Decode Q2 behavior
	// Expected if Q2a works (COUNT scopes per-referrer): "{going:3,maybe:2}"
	// Expected if COUNT is whole-stack (broken interleaving): sum of everything on stack
	let q2_verdict = 'UNKNOWN';
	if (q2a_val !== null && typeof q2a_val === 'string' && q2a_val.includes('3')) {
		q2_verdict = 'Q2a WORKS — COUNT scopes to preceding referrer traversal';
	} else if (q2b_val !== null && typeof q2b_val === 'string') {
		q2_verdict = 'Q2a fails but Q2b (counts-first then concat) may work';
	} else {
		q2_verdict = 'Both Q2a and Q2b fail — single-formula count+concat not viable';
	}
	note(`  Q2 VERDICT: ${q2_verdict}`);

	note('\n=== Full raw entity data ===');
	note(JSON.stringify(evData, null, 2));

	// ── 5. Cleanup ────────────────────────────────────────────────────────────

	note('\n=== Cleanup ===');
	for (const id of [...allEntities].reverse()) {
		await del(id); note(`  deleted entity: ${id}`);
	}
	for (const id of [...allTypes].reverse()) {
		await del(id); note(`  deleted type: ${id}`);
	}

	// ── 6. Artifact ───────────────────────────────────────────────────────────

	const artifactPath = await writeResultArtifact('probe-formula-count-concat', {
		probe: 'formula-count-concat-2026-06-13',
		rsvpCounts: { going: going_val, maybe: maybe_val, not_going: ng_val, late: late_val },
		q1: {
			countsOk: q1_counts_ok,
			tallyRaw: tally_val,
			tallyOk: q1_tally_ok,
			goingTimes2: q1times2_val,
			goingTimes2Ok: q1_times2_ok,
		},
		q2: {
			q2a_interleaved: q2a_val,
			q2b_counts_first: q2b_val,
			q2c_one_count_concat: q2c_val,
			verdict: q2_verdict,
		},
		rawEntity: evData,
		log,
	});
	note(`\n[probe] Artifact: ${artifactPath}`);
	note('[probe] Done.');
}

main().catch(e => { console.error('[probe] FATAL:', e); process.exit(1); });
