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
	migrateProperty as dataMigratorMigrateProperty,
	type MigratePropertyInjectables
} from './lib/data-migrator';
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
	ops: DiffOp[],
	executionResult: PhaseBExecutionResult | null
): string {
	// Bug 3 fix (v12): serialize per-op execution detail so post-incident root-cause analysis
	// has the failure error strings, the addedProperties[], etc. — instead of just summary.failed.
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
		wouldExecute: ops,
		// Detailed execution outcomes (only present on live runs)
		addedProperties: executionResult?.addedProperties ?? [],
		backfilled: executionResult?.backfilled ?? [],
		deleted: executionResult?.deleted ?? [],
		blockedDeletes: executionResult?.blockedDeletes ?? [],
		formulaUpdates: executionResult?.formulaUpdates ?? [],
		touchSaves: executionResult?.touchSaves ?? [],
		skipped: executionResult?.skipped ?? [],
		failed: executionResult?.failed ?? []
	};
	return JSON.stringify(payload, null, 2);
}

function buildMarkdownReport(
	report: PhaseBReport,
	executionResult: PhaseBExecutionResult | null
): string {
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
	// Bug 3 fix (v12): per-op failure listing in markdown for at-a-glance review.
	if (executionResult && executionResult.failed.length > 0) {
		lines.push('## Failures');
		lines.push('');
		for (const f of executionResult.failed) {
			lines.push(`- ${f.kind} \`${f.parentType}.${f.propertyName}\` — ${f.error}`);
		}
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
	const json = buildJsonReport(report, snapshot, ops, executionResult);
	const md = buildMarkdownReport(report, executionResult);
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
//   - migrateProperty: per-backfillKind dispatch (file/string/number/string_list/parent_copy/string_to_reference)
//   - deleteProperty: DELETE /property/{propertyDefId}
//   - verifyDeleteSafe: formula-reference scan + instance-set scan; safe iff both empty
//   - updateFormula: POST [{type:'formula', string:newFormula}] to /entity/{propertyDefId}
//   - touchSaveFormula: invokes entuTouchSave (probed wire shape) on each instance
export interface PhaseBLiveCallbacks {
	addProperty: AddPropertyFn;
	migrateProperty: MigratePropertyFn;
	deleteProperty: DeletePropertyFn;
	verifyDeleteSafe: VerifyDeleteSafeFn;
	updateFormula: UpdateFormulaFn;
	touchSaveFormula: TouchSaveFormulaFn;
}

interface EntuPropertyValue {
	_id?: string;
	type?: string;
	string?: string;
	number?: number;
	reference?: string;
	[key: string]: unknown;
}

async function fetchEntityJson(
	client: EntuClient,
	entityId: string
): Promise<{ _id: string; [key: string]: unknown }> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${client.jwt}` }
	});
	if (!res.ok) {
		throw new Error(`entity fetch failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as { entity: { _id: string; [key: string]: unknown } };
	return body.entity;
}

async function postEntityProperty(
	client: EntuClient,
	entityId: string,
	property: Record<string, unknown>
): Promise<void> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify([property])
	});
	if (!res.ok) {
		throw new Error(`entity POST failed: ${res.status} ${await res.text()}`);
	}
}

export function buildLiveCallbacks(client: EntuClient): PhaseBLiveCallbacks {
	const addProperty: AddPropertyFn = async (_c, op: AddPropertyOp) => {
		const payload = translatePropertyDef(op.def, op.parentTypeId, POLYPHONY_META_TYPE_PROPERTY_ID);
		const created = await createEntity(client, payload);
		return { _id: created._id };
	};

	// Local list helper that uses /entity/ (trailing slash) so URLs contain /entity/ literally;
	// this matches the URL substring check Tallis's RED-1 spec uses to verify the migrator did
	// some entity work, while remaining a valid Entu query URL.
	const listInstancesByType = async (parentType: string, props: string) => {
		const qs = new URLSearchParams({
			'_type.string': parentType,
			props,
			limit: '500'
		}).toString();
		const url = `${client.apiBase}/${client.db}/entity/?${qs}`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (!res.ok) {
			throw new Error(`list failed: ${res.status} ${await res.text()}`);
		}
		return (await res.json()) as { entities?: Array<Record<string, unknown> & { _id: string }>; count?: number };
	};

	// Helper: post a property value using the appropriate field shape per primitive type.
	const writePropertyLive = async (
		_c: EntuClient,
		entityId: string,
		propertyName: string,
		value: unknown
	): Promise<{ _id: string }> => {
		const property: Record<string, unknown> = { type: propertyName };
		if (typeof value === 'string') property.string = value;
		else if (typeof value === 'number') property.number = value;
		// References look like strings but the migrator passes them as the _id; for the
		// string_to_reference path the data-migrator hands us a string that's the entity _id —
		// caller responsibility to know which form is wanted. The migrator's reference path
		// passes the _id as `value`; we map that to `reference` for string_to_reference.
		await postEntityProperty(client, entityId, property);
		return { _id: 'unknown' };
	};

	// Specialized writer for string_to_reference (data-migrator passes the looked-up _id as `value`).
	// The data-migrator path POSTs the reference; we serialize as { type, reference } not { type, string }.
	const writeReferencePropertyLive = async (
		_c: EntuClient,
		entityId: string,
		propertyName: string,
		value: unknown
	): Promise<{ _id: string }> => {
		await postEntityProperty(client, entityId, { type: propertyName, reference: String(value) });
		return { _id: 'unknown' };
	};

	// DELETE /property/{id} — property-VALUE deletion. Callers: updateFormula's pre-delete
	// loop (formula values on a prop-def) and migrateProperty injectables.deleteProperty
	// (pruneExistingTarget path, stale target-property values on instances). Property
	// VALUES are property records, not entities — /property/{id} is the correct endpoint.
	//
	// NOT for prop-def deletion. The op-level deleteProperty callback below has its own
	// inline DELETE /entity/{propertyDefId} call (v12 Bug-1: property-def _ids are entity
	// _ids; /property/{id} returns 404 for them).
	const deletePropertyValueByIdLive = async (
		_c: EntuClient,
		propertyValueId: string
	): Promise<void> => {
		const url = `${client.apiBase}/${client.db}/property/${propertyValueId}`;
		const res = await fetch(url, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (!res.ok) {
			throw new Error(`property-value DELETE failed: ${res.status} ${await res.text()}`);
		}
	};

	// Live voice lookup: for string_to_reference, query by exact name.string=<NFC-value>.
	const voiceLookupLive = async (sourceValue: string): Promise<string | undefined> => {
		const url =
			`${client.apiBase}/${client.db}/entity?_type.string=voice` +
			`&name.string=${encodeURIComponent(sourceValue.normalize('NFC'))}&props=_id`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (!res.ok) return undefined;
		const body = (await res.json()) as { entities?: Array<{ _id: string }>; count?: number };
		if ((body.count ?? 0) === 0) return undefined;
		return body.entities?.[0]?._id;
	};

	// parent_copy pre-flight: build a childId → parentSourceValue Map by listing instances of
	// the child type, GETting each child to read `_parent.reference`, then GETting that parent
	// to read the source string. Children without a parent ref or without a source string are
	// omitted from the Map (data-migrator treats absent entries as skipped). The materialized
	// Map is then handed to dataMigratorMigrateProperty via the `parentLookup` injectable so
	// the lib's migrate loop (idempotency + pruneExistingTarget + writeProperty) runs for
	// parent_copy on the same code path as every other backfillKind.
	const buildParentLookup = async (op: BackfillDataOp): Promise<Map<string, string>> => {
		const parentLookup = new Map<string, string>();
		const iterateType = (op as BackfillDataOp & { targetParentType?: string }).targetParentType
			?? op.parentType;
		const listResp = await listInstancesByType(iterateType, '_id');
		for (const stub of listResp.entities ?? []) {
			const child = await fetchEntityJson(client, stub._id);
			const parentRef = (child._parent as Array<{ reference?: string }> | undefined)?.[0]?.reference;
			if (!parentRef) continue;
			const parent = await fetchEntityJson(client, parentRef);
			const sourceVal = (parent[op.sourceProperty] as EntuPropertyValue[] | undefined)?.[0];
			const sourceStr = typeof sourceVal?.string === 'string' ? sourceVal.string : null;
			if (sourceStr === null) continue;
			parentLookup.set(stub._id, sourceStr);
		}
		return parentLookup;
	};

	const migrateProperty: MigratePropertyFn = async (_c, op: BackfillDataOp) => {
		const injectables: MigratePropertyInjectables = {
			listInstances: async (_client, parentType) => {
				const listResp = await listInstancesByType(
					parentType,
					`_id,${op.sourceProperty},${op.targetProperty}`
				);
				return (listResp.entities ?? []).map((e) => ({ ...e, _id: e._id }));
			},
			writeProperty:
				op.backfillKind === 'string_to_reference' ? writeReferencePropertyLive : writePropertyLive,
			deleteProperty: deletePropertyValueByIdLive,
			voiceLookup: op.backfillKind === 'string_to_reference' ? voiceLookupLive : undefined,
			parentLookup: op.backfillKind === 'parent_copy' ? await buildParentLookup(op) : undefined
		};
		return dataMigratorMigrateProperty(client, op, injectables);
	};

	const deleteProperty: DeletePropertyFn = async (_c, op: DeletePropertyOp) => {
		// Prop-DEF deletion. v12 Bug-1: property-def _ids are entity _ids; Entu's
		// /property/{id} returns 404 for them. DELETE /entity/{id} is the correct shape.
		// Property-VALUE deletion uses /property/{id} via deletePropertyValueByIdLive.
		const url = `${client.apiBase}/${client.db}/entity/${op.propertyDefId}`;
		const res = await fetch(url, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (!res.ok) {
			throw new Error(`property DELETE failed: ${res.status} ${await res.text()}`);
		}
		return { deleted: true };
	};

	const verifyDeleteSafe: VerifyDeleteSafeFn = async (_c, op: DeletePropertyOp) => {
		// Probe 1: any property-def whose formula string references this property name?
		// Uses q= (substring search) because Entu's formula.string= is exact-equality and never
		// matches real formula expressions like "forename ' ' surname". Substring candidates
		// are post-filtered with a word-boundary regex to exclude false positives like
		// "member_email_legacy" when querying for "email".
		const formulaProbeUrl =
			`${client.apiBase}/${client.db}/entity?_type.reference=${POLYPHONY_META_TYPE_PROPERTY_ID}` +
			`&q=${encodeURIComponent(op.propertyName)}&props=_id,formula.string&limit=50`;
		const formulaRes = await fetch(formulaProbeUrl, {
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (formulaRes.ok) {
			const body = await formulaRes.json().catch(() => ({ entities: [] })) as {
				entities?: Array<{ formula?: Array<{ string?: string }> }>;
			};
			const escaped = op.propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const wordBoundary = new RegExp(`\\b${escaped}\\b`);
			const matches = (body.entities ?? []).filter((e) => {
				const expr = e.formula?.[0]?.string ?? '';
				return wordBoundary.test(expr);
			});
			if (matches.length > 0) {
				return {
					safe: false,
					reason: `property is referenced by formula on ${matches.length} property-def(s)`
				};
			}
		}

		// Probe 2: any instance of parentType still has the property set?
		const instanceProbeUrl =
			`${client.apiBase}/${client.db}/entity?_type.string=${encodeURIComponent(op.parentType)}` +
			`&props=_id,${encodeURIComponent(op.propertyName)}&limit=500`;
		const instanceRes = await fetch(instanceProbeUrl, {
			headers: { Authorization: `Bearer ${client.jwt}` }
		});
		if (instanceRes.ok) {
			const body = await instanceRes.json().catch(() => ({ entities: [], count: 0 })) as {
				entities?: Array<{ [key: string]: unknown }>;
				count?: number;
			};
			const populated = (body.entities ?? []).filter((e) => {
				const arr = e[op.propertyName] as Array<unknown> | undefined;
				return Array.isArray(arr) && arr.length > 0;
			});
			if (populated.length > 0) {
				return {
					safe: false,
					reason: `${populated.length} instance(s) of ${op.parentType} still have ${op.propertyName} set`
				};
			}
		}

		// Probe 3: when this delete is gated on a materialized formula property (e.g. §2
		// verify_then_delete drops forename/surname only if person.name is non-whitespace),
		// every instance must have a /\S/-matching value in that property.
		const materializedProp = (op as DeletePropertyOp & { materializedNameProperty?: string })
			.materializedNameProperty;
		if (materializedProp) {
			const nameProbeUrl =
				`${client.apiBase}/${client.db}/entity?_type.string=${encodeURIComponent(op.parentType)}` +
				`&props=_id,${encodeURIComponent(materializedProp)}&limit=200`;
			const nameRes = await fetch(nameProbeUrl, {
				headers: { Authorization: `Bearer ${client.jwt}` }
			});
			if (nameRes.ok) {
				const body = await nameRes.json().catch(() => ({ entities: [] })) as {
					entities?: Array<{ _id: string; [key: string]: unknown }>;
				};
				const badName = (body.entities ?? []).find((e) => {
					const vals = e[materializedProp] as Array<{ string?: string }> | undefined;
					const str = vals?.[0]?.string ?? '';
					return !/\S/.test(str);
				});
				if (badName) {
					return {
						safe: false,
						reason: `entity ${badName._id} has whitespace-only or empty materialized ${materializedProp}`
					};
				}
			}
		}

		return { safe: true };
	};

	const updateFormula: UpdateFormulaFn = async (_c, op: UpdateFormulaOp) => {
		// Bug 2 fix (v12): Entu POST APPENDS rather than replaces (Q5 multi-value gotcha).
		// Pre-DELETE all existing formula property `_id`s on the prop-def entity before POSTing
		// the new formula. Without this, the prop-def carries both old and new formula values.
		// Defensive: if GET fails or returns no formula values, proceed to POST. The pre-delete
		// is an additive cleanup step; missing GET just means no stale values to remove.
		let formulaValues: Array<{ _id?: string }> = [];
		try {
			const existing = await fetchEntityJson(client, op.propertyDefId);
			formulaValues = (existing.formula as Array<{ _id?: string }> | undefined) ?? [];
		} catch {
			// GET failed → assume no stale formula values to clean
		}
		for (const v of formulaValues) {
			if (typeof v._id === 'string') {
				await deletePropertyValueByIdLive(client, v._id);
			}
		}
		await postEntityProperty(client, op.propertyDefId, { type: 'formula', string: op.newFormula });
		return { updated: true };
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
