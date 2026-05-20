import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	getJwt,
	createEntity,
	listEntities,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient
} from './lib/entu-client';
import {
	computePhaseBDiff,
	type DbTypeState,
	type DiffOp,
	type AddPropertyOp,
	type BackfillDataOp,
	type DeletePropertyOp,
	type UpdateFormulaOp,
	type TouchSaveOp
} from './lib/diff';
import { takeSnapshot, type SnapshotResult } from './lib/snapshotter';
import { fetchPhaseBDbState, type PhaseBDbState } from './lib/fetch-db-state';
import { entuTouchSave } from './lib/touch-saver';
import { translatePropertyDef } from './lib/v4e-translator';
import {
	executePhaseBOps,
	type AddPropertyFn,
	type MigratePropertyFn,
	type DeletePropertyFn,
	type VerifyDeleteSafeFn,
	type UpdateFormulaFn,
	type TouchSaveFormulaFn,
	type PhaseBExecutionResult
} from './lib/executor';

export interface RunPhaseBInput {
	apiBase: string;
	db: string;
	apiKey: string;
	reportsDir: string;
	snapshotDir: string;
	dryRun: boolean;
	skipSnapshot?: boolean;
	now?: () => string;
	addProperty?: AddPropertyFn;
	migrateProperty?: MigratePropertyFn;
	deleteProperty?: DeletePropertyFn;
	verifyDeleteSafe?: VerifyDeleteSafeFn;
	updateFormula?: UpdateFormulaFn;
	touchSaveFormula?: TouchSaveFormulaFn;
}

export interface RunPhaseBOutput {
	exitCode: 0 | 1;
	report: PhaseBReport;
	reportPaths: { json: string; md: string };
}

export interface PhaseBReport {
	phase: string;
	executedAt: string | null;
	db: string;
	summary: {
		dryRun: boolean;
		wouldRenames: number;
		wouldObsoleteDeletes: number;
		wouldFormulaUpdates: number;
		wouldTouchSaves: number;
		failed: number;
	};
	snapshot?: {
		path: string | null;
		sha256: string | null;
		entityCount: number;
		skipped?: boolean;
		dryRun?: boolean;
	};
	wouldExecute?: DiffOp[];
	warnings?: string[];
	error?: string;
}

function dbStateToArray(state: PhaseBDbState): DbTypeState[] {
	return Object.values(state).map((t) => ({
		typeId: t.typeId,
		name: t.name,
		propertyNames: t.propertyNames,
		propertyIds: t.propertyIds,
		currentFormulas: t.currentFormulas
	}));
}

function buildJsonReport(
	report: PhaseBReport,
	snapshot: SnapshotResult | null,
	ops: DiffOp[]
): string {
	const payload = {
		...report,
		snapshot: snapshot
			? {
					path: snapshot.snapshotPath,
					sha256: snapshot.sha256,
					entityCount: snapshot.entityCount,
					skipped: snapshot.skipped,
					dryRun: snapshot.dryRun
				}
			: undefined,
		wouldExecute: ops
	};
	return JSON.stringify(payload, null, 2);
}

function buildMarkdownReport(report: PhaseBReport): string {
	const lines: string[] = [];
	lines.push('# Phase B migration report');
	lines.push('');
	if (report.summary.dryRun) lines.push('**DRY-RUN** — no writes performed.');
	lines.push(`- Executed at: ${report.executedAt ?? '(dry-run)'}`);
	lines.push(`- Database: ${report.db}`);
	lines.push('');
	lines.push('## Summary');
	lines.push('');
	lines.push('| Metric | Count |');
	lines.push('|---|---|');
	lines.push(`| Would attempt renames | ${report.summary.wouldRenames} |`);
	lines.push(`| Would attempt obsolete deletes | ${report.summary.wouldObsoleteDeletes} |`);
	lines.push(`| Would attempt formula updates | ${report.summary.wouldFormulaUpdates} |`);
	lines.push(`| Would attempt touch-saves | ${report.summary.wouldTouchSaves} |`);
	lines.push(`| Failed | ${report.summary.failed} |`);
	lines.push('');
	if (report.snapshot) {
		lines.push('## Pre-execution snapshot');
		lines.push('');
		if (report.snapshot.skipped) {
			lines.push('- **Status:** skipped (--skip-snapshot flag set)');
		} else {
			lines.push(`- Path: \`${report.snapshot.path ?? '(dry-run — not written)'}\``);
			lines.push(`- sha256: \`${report.snapshot.sha256 ?? '(none)'}\``);
			lines.push(`- Entities: ${report.snapshot.entityCount}`);
		}
		lines.push('');
	}
	if (report.warnings && report.warnings.length) {
		lines.push('## Warnings');
		lines.push('');
		for (const w of report.warnings) lines.push(`- ${w}`);
		lines.push('');
	}
	if (report.error) {
		lines.push('## Error');
		lines.push('');
		lines.push(report.error);
		lines.push('');
	}
	return lines.join('\n');
}

export async function runPhaseB(input: RunPhaseBInput): Promise<RunPhaseBOutput> {
	const now = input.now ?? (() => new Date().toISOString());
	const executedAt = now();

	const report: PhaseBReport = {
		phase: 'B',
		executedAt: input.dryRun ? null : executedAt,
		db: input.db,
		summary: {
			dryRun: input.dryRun,
			wouldRenames: 0,
			wouldObsoleteDeletes: 0,
			wouldFormulaUpdates: 0,
			wouldTouchSaves: 0,
			failed: 0
		}
	};
	const warnings: string[] = [];
	let snapshot: SnapshotResult | null = null;
	let ops: DiffOp[] = [];
	let executionResult: PhaseBExecutionResult | null = null;
	let exitCode: 0 | 1 = 0;

	try {
		const jwt = await getJwt({
			apiBase: input.apiBase,
			db: input.db,
			apiKey: input.apiKey
		});
		const client: EntuClient = { apiBase: input.apiBase, db: input.db, jwt };

		const dbState = await fetchPhaseBDbState(client);
		ops = computePhaseBDiff(dbStateToArray(dbState));

		report.summary.wouldRenames = ops.filter((o) => o.kind === 'RENAME').length;
		report.summary.wouldObsoleteDeletes = ops.filter(
			(o) => o.kind === 'DELETE_PROPERTY' && (o as { verifyPreconditions?: boolean }).verifyPreconditions === true
		).length;
		report.summary.wouldFormulaUpdates = ops.filter((o) => o.kind === 'UPDATE_FORMULA').length;
		report.summary.wouldTouchSaves = ops.filter((o) => o.kind === 'TOUCH_SAVE').length;

		if (input.skipSnapshot) {
			warnings.push('snapshot skipped via --skip-snapshot flag');
			snapshot = {
				entityCount: 0,
				snapshotPath: null,
				sha256: null,
				skipped: true
			};
		} else {
			snapshot = await takeSnapshot(client, {
				snapshotDir: input.snapshotDir,
				dryRun: input.dryRun,
				now
			});
		}

		if (!input.dryRun) {
			executionResult = await executePhaseBOps(client, ops, {
				dryRun: false,
				addProperty: input.addProperty,
				migrateProperty: input.migrateProperty,
				deleteProperty: input.deleteProperty,
				verifyDeleteSafe: input.verifyDeleteSafe,
				updateFormula: input.updateFormula,
				touchSaveFormula: input.touchSaveFormula,
				now
			});
			report.summary.failed = executionResult.failed.length;
		}
	} catch (err) {
		exitCode = 1;
		report.error = err instanceof Error ? err.message : String(err);
		report.summary.failed += 1;
	}

	if (executionResult && executionResult.failed.length > 0) {
		exitCode = 1;
	}

	report.snapshot = snapshot
		? {
				path: snapshot.snapshotPath,
				sha256: snapshot.sha256,
				entityCount: snapshot.entityCount,
				skipped: snapshot.skipped,
				dryRun: snapshot.dryRun
			}
		: undefined;
	report.wouldExecute = ops;
	if (warnings.length) report.warnings = warnings;

	await mkdir(input.reportsDir, { recursive: true });
	const stamp = (input.dryRun ? 'dry-run-' : '') + executedAt.replace(/[:.]/g, '-');
	const jsonPath = resolve(input.reportsDir, `2026-05-20-phase-b-${stamp}.json`);
	const mdPath = resolve(input.reportsDir, `2026-05-20-phase-b-${stamp}.md`);
	const json = buildJsonReport(report, snapshot, ops);
	const md = buildMarkdownReport(report);
	await writeFile(jsonPath, json, 'utf8');
	await writeFile(mdPath, md, 'utf8');

	return {
		exitCode,
		report,
		reportPaths: { json: jsonPath, md: mdPath }
	};
}

// Concrete live-mode callbacks for executePhaseBOps. Closes over an EntuClient (with JWT)
// and returns the 6 typed callbacks that runPhaseB forwards to executePhaseBOps.
// Wire shapes:
//   - addProperty: createEntity with translated property def (mirrors Phase A pattern)
//   - migrateProperty / deleteProperty / verifyDeleteSafe / updateFormula: stub no-ops for now
//     (the live-execution path for §1/§2/§3/§4 lands in a follow-up commit when PO approves
//     actual live execution; today the dry-run plan + tests gate is the merge target)
//   - touchSaveFormula: invokes entuTouchSave (probed wire shape) on each org instance
export interface PhaseBLiveCallbacks {
	addProperty: AddPropertyFn;
	migrateProperty: MigratePropertyFn;
	deleteProperty: DeletePropertyFn;
	verifyDeleteSafe: VerifyDeleteSafeFn;
	updateFormula: UpdateFormulaFn;
	touchSaveFormula: TouchSaveFormulaFn;
}

export function buildLiveCallbacks(client: EntuClient): PhaseBLiveCallbacks {
	const addProperty: AddPropertyFn = async (_c, op: AddPropertyOp) => {
		const payload = translatePropertyDef(op.def, op.parentTypeId, POLYPHONY_META_TYPE_PROPERTY_ID);
		const created = await createEntity(client, payload);
		return { _id: created._id };
	};

	const migrateProperty: MigratePropertyFn = async (_c, _op: BackfillDataOp) => {
		// TODO: wire to data-migrator.migrateProperty with appropriate listInstances/writeProperty.
		// Held until PO approves live execution; today's gate is dry-run + tests only.
		throw new Error('migrateProperty live callback not yet wired — held until live-execution approval');
	};

	const deleteProperty: DeletePropertyFn = async (_c, _op: DeletePropertyOp) => {
		throw new Error('deleteProperty live callback not yet wired — held until live-execution approval');
	};

	const verifyDeleteSafe: VerifyDeleteSafeFn = async (_c, _op: DeletePropertyOp) => {
		// Conservative default: report unsafe so executor blocks the delete until a real
		// preconditions probe is wired (formula reference scan + instance-set scan).
		return { safe: false, reason: 'verifyDeleteSafe live callback not yet wired' };
	};

	const updateFormula: UpdateFormulaFn = async (_c, _op: UpdateFormulaOp) => {
		throw new Error('updateFormula live callback not yet wired — held until live-execution approval');
	};

	const touchSaveFormula: TouchSaveFormulaFn = async (_c, op: TouchSaveOp) => {
		const instancesResp = await listEntities(client, {
			'_type.string': op.parentType,
			props: '_id',
			limit: '200'
		});
		let touchSaveCount = 0;
		let failed = 0;
		for (const inst of instancesResp.entities) {
			try {
				await entuTouchSave(client, inst._id);
				touchSaveCount += 1;
			} catch {
				failed += 1;
			}
		}
		return {
			touchSaveCount,
			noInstances: instancesResp.entities.length === 0,
			failed
		};
	};

	return {
		addProperty,
		migrateProperty,
		deleteProperty,
		verifyDeleteSafe,
		updateFormula,
		touchSaveFormula
	};
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const skipSnapshot = process.argv.includes('--skip-snapshot');
	const apiBase = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
	const db = process.env.ENTU_DB ?? 'polyphony';
	const apiKey = process.env.ENTU_API_KEY;
	const reportsDir = resolve(__dirname, 'reports');
	const snapshotDir = process.env.SNAPSHOT_DIR ?? resolve(__dirname, 'snapshots');

	if (!apiKey) {
		console.error('ERROR: ENTU_API_KEY env var is required');
		process.exit(1);
	}

	console.log(`Phase B migration ${dryRun ? '(dry-run) ' : ''}starting…`);
	console.log(`  API base: ${apiBase}`);
	console.log(`  DB: ${db}`);
	console.log(`  Snapshot dir: ${snapshotDir}`);

	// Pre-auth so we can build live callbacks before runPhaseB starts
	const jwt = await getJwt({ apiBase, db, apiKey });
	const client: EntuClient = { apiBase, db, jwt };
	const liveCallbacks = buildLiveCallbacks(client);

	const out = await runPhaseB({
		apiBase,
		db,
		apiKey,
		reportsDir,
		snapshotDir,
		dryRun,
		skipSnapshot,
		...(dryRun ? {} : liveCallbacks)
	});

	console.log(`\nReport: ${out.reportPaths.md}`);
	console.log(`        ${out.reportPaths.json}`);
	if (out.report.snapshot && !out.report.snapshot.skipped) {
		console.log(
			`\nSnapshot: ${out.report.snapshot.path ?? '(dry-run)'} (sha256: ${out.report.snapshot.sha256})`
		);
	}
	process.exit(out.exitCode);
}

const isMain = process.argv[1]?.endsWith('2026-05-20-phase-b.ts');
if (isMain) {
	main().catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	});
}
