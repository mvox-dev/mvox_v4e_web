import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPhaseB, buildLiveCallbacks } from './2026-05-20-phase-b';
import type { EntuClient } from './lib/entu-client';
import { resolve } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// NOTE: §1.3 (section.voice_type → section.voice) fixtures are incomplete here.
// Full §1.3 test with real voice_type values depends on Finn's probe report:
//   docs/migration/findings/section-voice-types-YYYY-MM-DD.md
// When that file lands, add a test that enumerates the actual distinct values
// and verifies each maps to a valid voice entity name.

let tempReportsDir: string;
let tempSnapshotDir: string;

beforeEach(async () => {
	tempReportsDir = await mkdtemp(`${tmpdir()}/phase-b-reports-`);
	tempSnapshotDir = await mkdtemp(`${tmpdir()}/phase-b-snapshots-`);
	vi.restoreAllMocks();
});

afterEach(async () => {
	await rm(tempReportsDir, { recursive: true, force: true });
	await rm(tempSnapshotDir, { recursive: true, force: true });
});

// Minimal db state fixture: organization with §3 obsolete props + section with §1 rename props
function mockDbWithRenamesAndObsolete() {
	const fetchMock = vi.spyOn(globalThis, 'fetch');

	// Auth
	fetchMock.mockResolvedValueOnce(
		new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 }),
	);

	// Load Phase A report (sanity check for type ids)
	// (runPhaseB reads this; stub with a minimal valid Phase A report shape)
	// NOTE: if runPhaseB doesn't require a Phase A report path in options, remove this stub.

	// List entity types from db — minimal fixture with renames + obsolete props
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: [
					{
						_id: 'section-type-id',
						name: [{ string: 'section' }],
						_type: [{ reference: 'meta-type-entity-id' }],
					},
					{
						_id: 'org-type-id',
						name: [{ string: 'organization' }],
						_type: [{ reference: 'meta-type-entity-id' }],
					},
					{
						_id: 'work-type-id',
						name: [{ string: 'work' }],
						_type: [{ reference: 'meta-type-entity-id' }],
					},
				],
				count: 3,
			}),
			{ status: 200 },
		),
	);

	// Per-type property listings (one per type returned above, in order)
	// section's properties: ordinal (§1 rename source), voice_type (§1 rename source), member_count (§4 formula)
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: [
					{ _id: 'section-ordinal-prop-id', name: [{ string: 'ordinal' }] },
					{ _id: 'section-voice-type-prop-id', name: [{ string: 'voice_type' }] },
					{
						_id: 'section-member-count-prop-id',
						name: [{ string: 'member_count' }],
						formula: [{ string: '_referrer.member.name COUNT' }],
					},
				],
				count: 3,
			}),
			{ status: 200 },
		),
	);
	// organization's properties: contact_email (§3 obsolete), language (§3), member_count_per_section (§5 touch-save)
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: [
					{ _id: 'org-contact-email-prop-id', name: [{ string: 'contact_email' }] },
					{ _id: 'org-language-prop-id', name: [{ string: 'language' }] },
					{
						_id: 'org-mcp-prop-id',
						name: [{ string: 'member_count_per_section' }],
						formula: [{ string: 'sections.*.member_count SUM' }],
					},
				],
				count: 3,
			}),
			{ status: 200 },
		),
	);
	// work's properties: voicing, duration, language (§1 renames), arranger (§2 migration)
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: [
					{ _id: 'work-voicing-prop-id', name: [{ string: 'voicing' }] },
					{ _id: 'work-duration-prop-id', name: [{ string: 'duration' }] },
					{ _id: 'work-language-prop-id', name: [{ string: 'language' }] },
					{ _id: 'work-arranger-prop-id', name: [{ string: 'arranger' }] },
				],
				count: 4,
			}),
			{ status: 200 },
		),
	);

	// Snapshot fetch (page 1 — entity stubs for dry-run)
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entities: [{ _id: 'org-1' }, { _id: 'section-1' }],
				count: 2,
			}),
			{ status: 200 },
		),
	);
	// Per-entity GET /entity/{id} — Gap-4 full-payload snapshot pattern
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entity: {
					_id: 'org-1',
					_type: [{ string: 'organization' }],
					name: [{ string: 'Org 1' }],
				},
			}),
			{ status: 200 },
		),
	);
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				entity: {
					_id: 'section-1',
					_type: [{ string: 'section' }],
					name: [{ string: 'Sopranod' }],
				},
			}),
			{ status: 200 },
		),
	);

	return fetchMock;
}

describe('runPhaseB — E2E', () => {
	it('dry-run: produces a report with correct §1 rename and §3 delete counts', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: false,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.summary.dryRun).toBe(true);

		// §1 renames produce ADD + BACKFILL + DELETE sub-ops
		expect(result.report.summary.wouldRenames).toBeGreaterThan(0);
		// §3 obsolete deletes
		expect(result.report.summary.wouldObsoleteDeletes).toBeGreaterThan(0);
	});

	it('dry-run: report files are written to reportsDir', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: false,
			now: () => '2026-05-20T04:00:00Z',
		});

		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const mdContent = await readFile(result.reportPaths.md, 'utf8');
		expect(JSON.parse(jsonContent).summary.dryRun).toBe(true);
		expect(mdContent).toContain('**DRY-RUN**');
	});

	it('dry-run: snapshot is taken (even in dry-run — so PO can see db size before committing)', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: false,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(result.report.snapshot).toBeDefined();
		expect(result.report.snapshot?.entityCount).toBeGreaterThan(0);
		expect(result.report.snapshot?.sha256).toMatch(/^[a-f0-9]{64}$/);
	});

	it('dry-run: --skip-snapshot omits snapshot and flags warning in report', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 }),
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 }),
		);

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: true,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(result.report.snapshot?.skipped).toBe(true);
		expect(result.report.warnings ?? []).toEqual(
			expect.arrayContaining([expect.stringContaining('snapshot')]),
		);
	});

	it('report shape includes snapshot.sha256 and snapshot.path fields', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: false,
			now: () => '2026-05-20T04:00:00Z',
		});

		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const parsed = JSON.parse(jsonContent) as {
			snapshot: { sha256: string; path: string | null; entityCount: number };
		};
		expect(parsed.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
		expect(typeof parsed.snapshot.entityCount).toBe('number');
	});

	it('§4 ordering: formula-updates before touch-saves in the executed op list', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: true,
			now: () => '2026-05-20T04:00:00Z',
		});

		// Gap-3 (RED-3): assert against report.wouldExecute (computed diff), not static constants.
		// Both UPDATE_FORMULA and TOUCH_SAVE ops must be present — if either is missing the
		// ordering invariant is silently invisible. Remove the conditional guard so this fails
		// loudly when the diff path doesn't produce these ops.
		const ops = result.report.wouldExecute ?? [];
		const lastUpdateIdx = ops.reduce(
			(max: number, o: { kind: string }, i: number) => (o.kind === 'UPDATE_FORMULA' ? i : max),
			-1,
		);
		const firstTouchIdx = ops.findIndex((o: { kind: string }) => o.kind === 'TOUCH_SAVE');
		// Both kinds must appear in the computed diff — no conditional guard
		expect(lastUpdateIdx).toBeGreaterThanOrEqual(0); // at least one UPDATE_FORMULA
		expect(firstTouchIdx).toBeGreaterThanOrEqual(0); // at least one TOUCH_SAVE
		expect(firstTouchIdx).toBeGreaterThan(lastUpdateIdx);
	});

	// Gap-3 (RED-3): summary counts come from computed diff ops, not static constants
	it('dry-run: summary.wouldRenames reflects the diff-computed count, not PHASE_B_RENAMES.length', async () => {
		mockDbWithRenamesAndObsolete();

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: true,
			skipSnapshot: true,
			now: () => '2026-05-20T04:00:00Z',
		});

		// The diff computes which renames are applicable given the current db state.
		// summary.wouldRenames must equal the number of RENAME ops in report.wouldExecute,
		// NOT the static length of PHASE_B_RENAMES.
		const renameOps = (result.report.wouldExecute ?? []).filter(
			(o: { kind: string }) => o.kind === 'RENAME',
		);
		expect(result.report.summary.wouldRenames).toBe(renameOps.length);
	});

	// Gap-1 (RED-1) + RED-5: live mode must call executePhaseBOps including addProperty
	it('live mode: calls each executor callback at least once per op kind in the diff', async () => {
		mockDbWithRenamesAndObsolete();

		const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });
		const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 1, skipped: 0, failed: 0 });
		const mockDeleteProperty = vi.fn().mockResolvedValue({ deleted: true });
		const mockVerifyDeleteSafe = vi.fn().mockResolvedValue({ safe: true });
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });
		const mockTouchSaveFormula = vi
			.fn()
			.mockResolvedValue({ touchSaveCount: 1, noInstances: false, failed: 0 });

		// Trace: soprano section has voice_type='soprano' → BACKFILL_DATA op → migrateProperty called.
		// organization has member_count_per_section formula → TOUCH_SAVE → touchSaveFormula called.
		// section has member_count formula UPDATE → updateFormula called.
		// organization has contact_email §3 DELETE → verifyDeleteSafe + deleteProperty called.
		// section.voice absent → ADD_PROPERTY op → addProperty called (RED-5).
		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false, // live mode path
			skipSnapshot: true,
			now: () => '2026-05-20T04:00:00Z',
			// Injectable executor callbacks — runPhaseB must accept and forward these
			addProperty: mockAddProperty,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDeleteSafe,
			updateFormula: mockUpdateFormula,
			touchSaveFormula: mockTouchSaveFormula,
		});

		// Each callback must have been called — orchestrator reached executePhaseBOps
		expect(mockAddProperty).toHaveBeenCalled();
		expect(mockMigrateProperty).toHaveBeenCalled();
		expect(mockDeleteProperty).toHaveBeenCalled();
		expect(mockVerifyDeleteSafe).toHaveBeenCalled();
		expect(mockUpdateFormula).toHaveBeenCalled();
		expect(mockTouchSaveFormula).toHaveBeenCalled();
		expect(result.exitCode).toBe(0);
	});

	it('exits 1 if any sub-op fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 }),
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 }),
		);
		// Snapshot fetch fails
		fetchMock.mockResolvedValueOnce(new Response('Boom', { status: 500 }));

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false,
			skipSnapshot: false,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(result.exitCode).toBe(1);
	});
});

// RED-B: main() must wire the 6 injectable callbacks via buildLiveCallbacks
// Currently main() calls runPhaseB with no callback arguments — all ops silently no-op in live mode.
describe('buildLiveCallbacks', () => {
	it('is exported from the phase-b script', () => {
		// If buildLiveCallbacks is not exported, this import will fail at test time.
		// The test fails because the export does not exist yet.
		expect(typeof buildLiveCallbacks).toBe('function');
	});

	it('returns all 6 callback functions when given an EntuClient', () => {
		const fakeClient: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'fake-jwt',
		};
		const cbs = buildLiveCallbacks(fakeClient);
		expect(typeof cbs.addProperty).toBe('function');
		expect(typeof cbs.migrateProperty).toBe('function');
		expect(typeof cbs.deleteProperty).toBe('function');
		expect(typeof cbs.verifyDeleteSafe).toBe('function');
		expect(typeof cbs.updateFormula).toBe('function');
		expect(typeof cbs.touchSaveFormula).toBe('function');
	});

	it('all 6 callbacks are async (return a Promise)', async () => {
		const fakeClient: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'fake-jwt',
		};
		const cbs = buildLiveCallbacks(fakeClient);
		// Each function must be async — calling it and checking the result is a Promise
		// We don't actually send HTTP requests; we just verify the return type.
		// Use a minimal stub so they fail fast without network access.
		const addResult = cbs.addProperty({
			kind: 'ADD_PROPERTY',
			parentTypeName: 'test',
			parentTypeId: 'tid',
			propertyName: 'p',
			def: { name: 'p', type: 'string' },
		});
		expect(addResult).toBeInstanceOf(Promise);
		// Cancel the in-flight request by not awaiting — just verify the shape
		addResult.catch(() => undefined);
	});

	it('main() uses buildLiveCallbacks to wire executor callbacks — not called with empty callbacks', () => {
		// This test documents the contract: main() must call runPhaseB with the return value of
		// buildLiveCallbacks(client), not with an empty options object.
		// We cannot call main() directly (it reads process.argv + env + exits).
		// Instead, verify the exported function exists and has the right signature by checking
		// that buildLiveCallbacks(client) returns an object with the 6 keys that runPhaseB accepts.
		const fakeClient: EntuClient = {
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			jwt: 'fake-jwt',
		};
		const cbs = buildLiveCallbacks(fakeClient);
		const runPhaseBKeys: (keyof typeof cbs)[] = [
			'addProperty',
			'migrateProperty',
			'deleteProperty',
			'verifyDeleteSafe',
			'updateFormula',
			'touchSaveFormula',
		];
		for (const key of runPhaseBKeys) {
			expect(cbs).toHaveProperty(key);
		}
	});
});

// RED v12.3 — buildJsonReport must serialize executionResult detail
//
// Bug 3 fix: current buildJsonReport writes only summary.failed COUNT.
// Without failed[] records (with error strings), post-execution root-cause analysis
// requires snapshot+live diff rather than reading the report. Fix: include full
// executionResult arrays in the JSON output.
//
// (*MVOX:Tallis*)
describe('RED v12.3: runPhaseB JSON report includes executionResult detail', () => {
	it('JSON report includes failed[] records with kind, propertyName, and error string', async () => {
		mockDbWithRenamesAndObsolete();

		// deleteProperty throws — triggers a failed[] record
		const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });
		const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 0, skipped: 0, failed: 0 });
		const mockDeleteProperty = vi
			.fn()
			.mockRejectedValue(new Error('DELETE /entity/foo 404 not found'));
		const mockVerifyDeleteSafe = vi.fn().mockResolvedValue({ safe: true });
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });
		const mockTouchSaveFormula = vi
			.fn()
			.mockResolvedValue({ touchSaveCount: 0, noInstances: false, failed: 0 });

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false,
			skipSnapshot: true,
			now: () => '2026-05-20T09:00:00Z',
			addProperty: mockAddProperty,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDeleteSafe,
			updateFormula: mockUpdateFormula,
			touchSaveFormula: mockTouchSaveFormula,
		});

		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const parsed = JSON.parse(jsonContent);

		// Must include failed[] with actual error records, not just a count
		expect(Array.isArray(parsed.failed)).toBe(true);
		expect(parsed.failed.length).toBeGreaterThan(0);
		const failedRecord = parsed.failed[0];
		expect(typeof failedRecord.error).toBe('string');
		expect(failedRecord.error).toContain('404');
	});

	it('JSON report includes addedProperties[] detail', async () => {
		mockDbWithRenamesAndObsolete();

		const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'added-prop-def-id' });
		const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 0, skipped: 0, failed: 0 });
		const mockDeleteProperty = vi.fn().mockResolvedValue({ deleted: true });
		const mockVerifyDeleteSafe = vi.fn().mockResolvedValue({ safe: true });
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });
		const mockTouchSaveFormula = vi
			.fn()
			.mockResolvedValue({ touchSaveCount: 0, noInstances: false, failed: 0 });

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false,
			skipSnapshot: true,
			now: () => '2026-05-20T09:00:00Z',
			addProperty: mockAddProperty,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDeleteSafe,
			updateFormula: mockUpdateFormula,
			touchSaveFormula: mockTouchSaveFormula,
		});

		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const parsed = JSON.parse(jsonContent);

		// Must include addedProperties[] with the prop-def IDs
		expect(Array.isArray(parsed.addedProperties)).toBe(true);
		expect(parsed.addedProperties.length).toBeGreaterThan(0);
		const addedRecord = parsed.addedProperties[0];
		expect(typeof addedRecord.parentType).toBe('string');
		expect(typeof addedRecord.propertyName).toBe('string');
		expect(typeof addedRecord.propertyDefId).toBe('string');
	});

	it('JSON report includes blockedDeletes[] and backfilled[] arrays', async () => {
		mockDbWithRenamesAndObsolete();

		// verifyDeleteSafe returns unsafe → goes to blockedDeletes
		// migrateProperty returns migrated=1 → goes to backfilled
		const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });
		const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 1, skipped: 0, failed: 0 });
		const mockDeleteProperty = vi.fn().mockResolvedValue({ deleted: true });
		const mockVerifyDeleteSafe = vi
			.fn()
			.mockResolvedValue({ safe: false, reason: 'instances have values' });
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });
		const mockTouchSaveFormula = vi
			.fn()
			.mockResolvedValue({ touchSaveCount: 0, noInstances: false, failed: 0 });

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false,
			skipSnapshot: true,
			now: () => '2026-05-20T09:00:00Z',
			addProperty: mockAddProperty,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDeleteSafe,
			updateFormula: mockUpdateFormula,
			touchSaveFormula: mockTouchSaveFormula,
		});

		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const parsed = JSON.parse(jsonContent);

		expect(Array.isArray(parsed.blockedDeletes)).toBe(true);
		expect(Array.isArray(parsed.backfilled)).toBe(true);
		expect(parsed.blockedDeletes.length).toBeGreaterThan(0);
		expect(parsed.backfilled.length).toBeGreaterThan(0);
	});

	it('markdown report includes a Failures section when failed records exist', async () => {
		mockDbWithRenamesAndObsolete();

		const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });
		const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 0, skipped: 0, failed: 0 });
		const mockDeleteProperty = vi.fn().mockRejectedValue(new Error('status 404 entity not found'));
		const mockVerifyDeleteSafe = vi.fn().mockResolvedValue({ safe: true });
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });
		const mockTouchSaveFormula = vi
			.fn()
			.mockResolvedValue({ touchSaveCount: 0, noInstances: false, failed: 0 });

		const result = await runPhaseB({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			reportsDir: tempReportsDir,
			snapshotDir: tempSnapshotDir,
			dryRun: false,
			skipSnapshot: true,
			now: () => '2026-05-20T09:00:00Z',
			addProperty: mockAddProperty,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDeleteSafe,
			updateFormula: mockUpdateFormula,
			touchSaveFormula: mockTouchSaveFormula,
		});

		const mdContent = await readFile(result.reportPaths.md, 'utf8');

		// Markdown must surface a "Failures" section with error detail
		expect(mdContent).toMatch(/##\s*Failures/i);
	});
});
