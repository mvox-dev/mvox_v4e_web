/**
 * cleanup-menu-usability-2026-05-23.ts
 *
 * Usability pass on polyphony Entu menu set — 17 UPDATE ops.
 * See docs/migration/proposals/menu-usability-pre-launch-2026-05-23.md for rationale.
 *
 * Ops (all UPDATE — no creates, no deletes):
 *   U1  Voices ordinal 110 → 115 (fix collision with Organisations)
 *   U2  Lending → "Loans" (name)
 *   U3  Loans ordinal 240 → 230
 *   U4  Libraries ordinal 200 → 240
 *   U5  Works ordinal 210 → 200
 *   U6  Editions ordinal 220 → 210
 *   U7  Copies ordinal 230 → 220
 *   U8  Events ordinal 420 → 400
 *   U9  Events query sort name.string → start_date.date
 *   U10 Seasons ordinal 400 → 410
 *   U11 Seasons query sort name.string → start_date.date
 *   U12 Repertoire ordinal 430 → 420
 *   U13 Programme (was Programme Items) ordinal 440 → 430
 *   U14 Programme name "Programme Items" → "Programme"
 *   U15 Event Series ordinal 410 → 440
 *   U16 Attendance ordinal 510 → 500
 *   U17 RSVPs ordinal 500 → 510
 *
 * Idempotent: reads current value before each op; skips if already correct.
 *
 * DRY_RUN=true (default) — prints manifest, no mutations.
 * DRY_RUN=false          — executes against live polyphony db.
 *
 * Run:
 *   set -a; . ~/.config/mvox/credentials.env; set +a
 *   pnpm exec tsx scripts/migrations/cleanup-menu-usability-2026-05-23.ts
 *   DRY_RUN=false pnpm exec tsx scripts/migrations/cleanup-menu-usability-2026-05-23.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	getJwt,
	fetchEntity,
	postProperties,
	deletePropertyValue,
	type EntuClient,
} from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_URL ?? 'https://api.entu.app';
const DB = process.env.ENTU_DATABASE ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

// ── Op definitions ─────────────────────────────────────────────────────────

interface FieldOp {
	entityId: string;
	label: string; // human description for logs
	field: 'name' | 'ordinal' | 'query';
	expectedCurrent: string | number; // drift-check: halt if live value doesn't match
	newValue: string | number;
}

const OPS: FieldOp[] = [
	// U1: Voices ordinal collision fix
	{
		entityId: '6a0f6d304ff8277cd43069ab',
		label: 'U1  Voices ordinal 110 → 115',
		field: 'ordinal',
		expectedCurrent: 110,
		newValue: 115,
	},
	// U2: Lending → Loans (name)
	{
		entityId: '6a0f6d314ff8277cd43069f8',
		label: 'U2  Lending name → "Loans"',
		field: 'name',
		expectedCurrent: 'Lending',
		newValue: 'Loans',
	},
	// U3: Loans ordinal 240 → 230 (move up, high-traffic)
	{
		entityId: '6a0f6d314ff8277cd43069f8',
		label: 'U3  Loans ordinal 240 → 230',
		field: 'ordinal',
		expectedCurrent: 240,
		newValue: 230,
	},
	// U4: Libraries ordinal 200 → 240 (bury container at bottom of library group)
	{
		entityId: '6a0f6d314ff8277cd43069cc',
		label: 'U4  Libraries ordinal 200 → 240',
		field: 'ordinal',
		expectedCurrent: 200,
		newValue: 240,
	},
	// U5: Works ordinal 210 → 200 (lead the library group)
	{
		entityId: '6a0f6d314ff8277cd43069d7',
		label: 'U5  Works ordinal 210 → 200',
		field: 'ordinal',
		expectedCurrent: 210,
		newValue: 200,
	},
	// U6: Editions ordinal 220 → 210
	{
		entityId: '6a0f6d314ff8277cd43069e2',
		label: 'U6  Editions ordinal 220 → 210',
		field: 'ordinal',
		expectedCurrent: 220,
		newValue: 210,
	},
	// U7: Copies ordinal 230 → 220
	{
		entityId: '6a0f6d314ff8277cd43069ed',
		label: 'U7  Copies ordinal 230 → 220',
		field: 'ordinal',
		expectedCurrent: 230,
		newValue: 220,
	},
	// U8: Events ordinal 420 → 400 (conductor's primary entry)
	{
		entityId: '6a0f6d314ff8277cd4306a2f',
		label: 'U8  Events ordinal 420 → 400',
		field: 'ordinal',
		expectedCurrent: 420,
		newValue: 400,
	},
	// U9: Events query — sort by start_date.date instead of name.string
	{
		entityId: '6a0f6d314ff8277cd4306a2f',
		label: 'U9  Events query sort name.string → start_date.date',
		field: 'query',
		expectedCurrent: '_type.string=event&sort=name.string',
		newValue: '_type.string=event&sort=start_date.date',
	},
	// U10: Seasons ordinal 400 → 410
	{
		entityId: '6a0f6d314ff8277cd4306a19',
		label: 'U10 Seasons ordinal 400 → 410',
		field: 'ordinal',
		expectedCurrent: 400,
		newValue: 410,
	},
	// U11: Seasons query — sort by start_date.date
	{
		entityId: '6a0f6d314ff8277cd4306a19',
		label: 'U11 Seasons query sort name.string → start_date.date',
		field: 'query',
		expectedCurrent: '_type.string=season&sort=name.string',
		newValue: '_type.string=season&sort=start_date.date',
	},
	// U12: Repertoire ordinal 430 → 420
	{
		entityId: '6a0f6d324ff8277cd4306a3a',
		label: 'U12 Repertoire ordinal 430 → 420',
		field: 'ordinal',
		expectedCurrent: 430,
		newValue: 420,
	},
	// U13: Programme (was Programme Items) ordinal 440 → 430
	{
		entityId: '6a0f6d324ff8277cd4306a45',
		label: 'U13 Programme Items ordinal 440 → 430',
		field: 'ordinal',
		expectedCurrent: 440,
		newValue: 430,
	},
	// U14: Programme Items → "Programme" (name)
	{
		entityId: '6a0f6d324ff8277cd4306a45',
		label: 'U14 Programme Items name → "Programme"',
		field: 'name',
		expectedCurrent: 'Programme Items',
		newValue: 'Programme',
	},
	// U15: Event Series ordinal 410 → 440 (advanced/low-frequency, move to bottom)
	{
		entityId: '6a0f6d314ff8277cd4306a24',
		label: 'U15 Event Series ordinal 410 → 440',
		field: 'ordinal',
		expectedCurrent: 410,
		newValue: 440,
	},
	// U16: Attendance ordinal 510 → 500 (high-frequency conductor entry)
	{
		entityId: '6a0f6d324ff8277cd4306a5b',
		label: 'U16 Attendance ordinal 510 → 500',
		field: 'ordinal',
		expectedCurrent: 510,
		newValue: 500,
	},
	// U17: RSVPs ordinal 500 → 510
	{
		entityId: '6a0f6d324ff8277cd4306a50',
		label: 'U17 RSVPs ordinal 500 → 510',
		field: 'ordinal',
		expectedCurrent: 500,
		newValue: 510,
	},
];

// ── Helpers ────────────────────────────────────────────────────────────────

type PropValue = { _id?: string; string?: string; number?: number };
type AnyEntity = { _id: string; [key: string]: unknown };

function firstPropValue(entity: AnyEntity, field: string): PropValue | undefined {
	const vals = entity[field] as PropValue[] | undefined;
	return Array.isArray(vals) ? vals[0] : undefined;
}

function currentLiveValue(entity: AnyEntity, field: string): string | number | undefined {
	const val = firstPropValue(entity, field);
	if (!val) return undefined;
	if (field === 'ordinal') return val.number;
	return val.string;
}

// ── Result artifact ────────────────────────────────────────────────────────

interface OpResult {
	op: string;
	entityId: string;
	field: string;
	action: 'UPDATED' | 'SKIPPED' | 'DRIFT_HALT' | 'ERROR';
	liveValue?: string | number;
	newValue?: string | number;
	propValueId?: string;
	dryRun: boolean;
	error?: string;
}

const results: OpResult[] = [];

function logResult(r: OpResult) {
	results.push(r);
	const prefix = r.dryRun ? '[DRY-RUN]' : '[LIVE]';
	console.log(`  ${prefix} ${r.action.padEnd(11)} ${r.op}`);
	if (r.action === 'DRIFT_HALT') {
		console.log(`    DRIFT: expected "${r.newValue}" current, got "${r.liveValue}" — HALTING`);
	} else if (r.action === 'SKIPPED') {
		console.log(`    already correct (${r.liveValue})`);
	}
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
	console.log('cleanup-menu-usability-2026-05-23');
	console.log(`DB: ${DB} | DRY_RUN: ${DRY_RUN}`);
	const runAt = new Date().toISOString();
	console.log(`Time: ${runAt}\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	// Cache fetched entities to avoid re-fetching the same entity for multi-op targets
	const entityCache = new Map<string, AnyEntity>();

	async function getEntity(id: string): Promise<AnyEntity> {
		if (!entityCache.has(id)) {
			const raw = await fetchEntity(client, id);
			// fetchEntity returns { entity: {...} } or the entity directly — unwrap if needed
			const entity = (raw as { entity?: AnyEntity }).entity ?? (raw as AnyEntity);
			entityCache.set(id, entity);
		}
		return entityCache.get(id)!;
	}

	console.log('=== MANIFEST ===\n');
	for (const op of OPS) {
		const entity = await getEntity(op.entityId);
		const liveVal = currentLiveValue(entity, op.field);
		const alreadyCorrect = liveVal === op.newValue;
		const driftDetected = liveVal !== op.expectedCurrent && !alreadyCorrect;

		const status = alreadyCorrect
			? 'SKIP (already correct)'
			: driftDetected
				? `DRIFT HALT (expected "${op.expectedCurrent}", got "${liveVal}")`
				: `${op.expectedCurrent} → ${op.newValue}`;
		console.log(`  ${op.label}: ${status}`);
	}
	console.log();

	if (DRY_RUN) {
		console.log('DRY_RUN=true — no live mutations.\n');
		for (const op of OPS) {
			logResult({
				op: op.label,
				entityId: op.entityId,
				field: op.field,
				action: 'SKIPPED',
				liveValue: op.expectedCurrent,
				newValue: op.newValue,
				dryRun: true,
			});
		}
	} else {
		console.log('=== EXECUTION ===\n');
		// Invalidate cache before live execution — re-fetch fresh state for drift checks
		entityCache.clear();

		for (const op of OPS) {
			const entity = await getEntity(op.entityId);
			const liveVal = currentLiveValue(entity, op.field);
			const propVal = firstPropValue(entity, op.field);

			if (liveVal === op.newValue) {
				logResult({
					op: op.label,
					entityId: op.entityId,
					field: op.field,
					action: 'SKIPPED',
					liveValue: liveVal,
					newValue: op.newValue,
					dryRun: false,
				});
				// Invalidate cache for this entity since we may have multiple ops on it
				entityCache.delete(op.entityId);
				continue;
			}

			if (liveVal !== op.expectedCurrent) {
				logResult({
					op: op.label,
					entityId: op.entityId,
					field: op.field,
					action: 'DRIFT_HALT',
					liveValue: liveVal,
					newValue: op.newValue,
					dryRun: false,
				});
				console.error(
					`\nFATAL: drift detected on ${op.label} — halting to prevent incorrect mutations.`,
				);
				writeArtifact(runAt);
				process.exit(1);
			}

			try {
				// DELETE existing value, then POST new value (replace semantics)
				if (propVal?._id) {
					await deletePropertyValue(client, propVal._id);
				}
				const postBody =
					op.field === 'ordinal'
						? [{ type: 'ordinal', number: op.newValue as number }]
						: [{ type: op.field, string: op.newValue as string }];
				await postProperties(client, op.entityId, postBody);

				logResult({
					op: op.label,
					entityId: op.entityId,
					field: op.field,
					action: 'UPDATED',
					liveValue: liveVal,
					newValue: op.newValue,
					propValueId: propVal?._id,
					dryRun: false,
				});
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				logResult({
					op: op.label,
					entityId: op.entityId,
					field: op.field,
					action: 'ERROR',
					liveValue: liveVal,
					newValue: op.newValue,
					dryRun: false,
					error: msg,
				});
				console.error(`\nFATAL: error on ${op.label}: ${msg}`);
				writeArtifact(runAt);
				process.exit(1);
			}

			// Invalidate cache so next op on same entity re-fetches fresh state
			entityCache.delete(op.entityId);
		}
	}

	writeArtifact(runAt);
}

function writeArtifact(runAt: string) {
	const updated = results.filter((r) => r.action === 'UPDATED').length;
	const skipped = results.filter((r) => r.action === 'SKIPPED').length;
	const halted = results.filter((r) => r.action === 'DRIFT_HALT' || r.action === 'ERROR').length;

	const artifact = {
		runAt,
		db: DB,
		dryRun: DRY_RUN,
		totalOps: OPS.length,
		updated,
		skipped,
		halted,
		ops: results,
	};

	console.log(`\nSummary: ${updated} updated, ${skipped} skipped, ${halted} halted`);

	const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
	const label = DRY_RUN ? 'dry-run' : 'live';
	const resultsDir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(resultsDir, { recursive: true });
	const artifactPath = join(resultsDir, `cleanup-menu-usability-${label}-${ts}.json`);
	writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
	console.log(`Artifact: ${artifactPath}`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
