import { describe, it, expect, vi } from 'vitest';
import {
	executeAdditions,
	executePhaseBOps,
	type ExecutionResult,
	type PhaseBExecutionResult,
} from './executor';
import type {
	DiffOp,
	AddPropertyOp,
	BackfillDataOp,
	DeletePropertyOp,
	UpdateFormulaOp,
	TouchSaveOp,
} from './diff';
import type { EntuClient } from './entu-client';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'jwt',
};

const ops: DiffOp[] = [
	{
		kind: 'CREATE_TYPE',
		typeName: 'voice',
		blurb: 'Vocal range taxonomy',
		properties: [{ name: 'name', type: 'string' }],
	},
	{
		kind: 'ADD_PROPERTY',
		parentTypeName: 'season',
		parentTypeId: 'season-db-id',
		propertyName: 'end_date',
		def: { name: 'end_date', type: 'date' },
	},
];

describe('executeAdditions', () => {
	it('happy path: creates all ops via the client', async () => {
		const createMock = vi
			.fn()
			.mockResolvedValueOnce({ _id: 'voice-new-id' })
			.mockResolvedValueOnce({ _id: 'voice-label-prop-id' })
			.mockResolvedValueOnce({ _id: 'season-end-date-prop-id' });

		const result = await executeAdditions(client, ops, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z',
		});

		expect(result.createdTypes).toHaveLength(1);
		expect(result.createdTypes[0].name).toBe('voice');
		expect(result.addedProperties).toHaveLength(2); // voice.label inline + season.end_date
		expect(result.failed).toEqual([]);
		expect(result.skipped).toEqual([]);
		expect(createMock).toHaveBeenCalledTimes(3); // 1 type + 1 inline prop + 1 prop on existing
	});

	it('dry-run: no calls; results structured under wouldCreate', async () => {
		const createMock = vi.fn();

		const result = await executeAdditions(client, ops, {
			dryRun: true,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z',
		});

		expect(createMock).not.toHaveBeenCalled();
		expect(result.dryRun).toBe(true);
		expect(result.wouldCreateTypes).toHaveLength(1);
		expect(result.wouldAddProperties).toHaveLength(2);
	});

	it('captures individual failures without aborting', async () => {
		const createMock = vi
			.fn()
			.mockRejectedValueOnce(new Error('create failed: 500 boom'))
			.mockResolvedValueOnce({ _id: 'inline-prop-id' })
			.mockResolvedValueOnce({ _id: 'season-end-date-prop-id' });

		const result = await executeAdditions(client, ops, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z',
		});

		expect(result.failed).toHaveLength(1);
		expect(result.failed[0].error).toMatch(/500 boom/);
		// Second op still attempted
		expect(result.addedProperties).toHaveLength(1);
	});

	it('flags formula properties under formulaTouchSaveDeferred', async () => {
		const formulaOps: DiffOp[] = [
			{
				kind: 'ADD_PROPERTY',
				parentTypeName: 'edition',
				parentTypeId: 'edition-db-id',
				propertyName: 'work',
				def: { name: 'work', type: 'string', formula: 'edition_work.*.name CONCAT' },
			},
		];
		const createMock = vi.fn().mockResolvedValue({ _id: 'edition-work-prop-id' });

		const result = await executeAdditions(client, formulaOps, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z',
		});

		expect(result.formulaTouchSaveDeferred).toHaveLength(1);
		expect(result.formulaTouchSaveDeferred[0]).toMatchObject({
			parentType: 'edition',
			property: 'work',
		});
	});

	it('passes Entu-shaped payloads to createEntity (not v4E-shaped)', async () => {
		const v4eOps: DiffOp[] = [
			{
				kind: 'ADD_PROPERTY',
				parentTypeName: 'season',
				parentTypeId: 'season-id',
				propertyName: 'end_date',
				def: { name: 'end_date', type: 'date', required: true, blurb: 'When the season ends' },
			},
		];
		const createMock = vi.fn().mockResolvedValue({ _id: 'p-id' });

		await executeAdditions(client, v4eOps, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z',
		});

		const [, payload] = createMock.mock.calls[0];
		expect(payload).toContainEqual({ type: 'mandatory', boolean: true }); // not 'required'
		expect(payload).toContainEqual({ type: 'label', string: 'When the season ends' }); // not 'blurb'
	});
});

// ── Phase B executor additions ─────────────────────────────────────────────

describe('executePhaseBOps', () => {
	const backfillOp: BackfillDataOp = {
		kind: 'BACKFILL_DATA',
		parentType: 'work',
		sourceProperty: 'voicing',
		targetProperty: 'original_voicing',
		backfillKind: 'string',
	};

	const deleteOp: DeletePropertyOp = {
		kind: 'DELETE_PROPERTY',
		parentType: 'organization',
		propertyName: 'contact_email',
		propertyDefId: 'ce-prop-id',
		verifyPreconditions: true,
	};

	const updateFormulaOp: UpdateFormulaOp = {
		kind: 'UPDATE_FORMULA',
		parentType: 'section',
		propertyName: 'member_count',
		propertyDefId: 'mc-prop-id',
		newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +',
	};

	const touchSaveOp: TouchSaveOp = {
		kind: 'TOUCH_SAVE',
		parentType: 'organization',
		propertyName: 'member_count_per_section',
		formulaExpression: '(_child.member COUNT) (_child.section.member_count SUM) +',
	};

	it('executes BACKFILL_DATA via migrateProperty', async () => {
		const mockMigrateProperty = vi.fn().mockResolvedValue({
			migrated: 5,
			skipped: 0,
			failed: 0,
		});

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [backfillOp], {
			dryRun: false,
			migrateProperty: mockMigrateProperty,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockMigrateProperty).toHaveBeenCalledOnce();
		expect(result.backfilled).toHaveLength(1);
		expect(result.backfilled[0].migrated).toBe(5);
		expect(result.failed).toHaveLength(0);
	});

	it('executes DELETE_PROPERTY after pre-condition verification', async () => {
		const mockDeleteProperty = vi.fn().mockResolvedValue({ deleted: true });
		const mockVerifyDelete = vi.fn().mockResolvedValue({ safe: true });

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [deleteOp], {
			dryRun: false,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDelete,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockVerifyDelete).toHaveBeenCalledOnce();
		expect(mockDeleteProperty).toHaveBeenCalledOnce();
		expect(result.deleted).toHaveLength(1);
	});

	it('blocks DELETE_PROPERTY when verifyDeleteSafe returns unsafe', async () => {
		const mockDeleteProperty = vi.fn();
		const mockVerifyDelete = vi.fn().mockResolvedValue({
			safe: false,
			reason: 'property still referenced in formula',
		});

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [deleteOp], {
			dryRun: false,
			deleteProperty: mockDeleteProperty,
			verifyDeleteSafe: mockVerifyDelete,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockDeleteProperty).not.toHaveBeenCalled();
		expect(result.blockedDeletes).toHaveLength(1);
		expect(result.blockedDeletes[0].reason).toMatch(/formula/);
	});

	it('executes UPDATE_FORMULA op', async () => {
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [updateFormulaOp], {
			dryRun: false,
			updateFormula: mockUpdateFormula,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockUpdateFormula).toHaveBeenCalledOnce();
		expect(result.formulaUpdates).toHaveLength(1);
	});

	it('skips UPDATE_FORMULA when formula is already current', async () => {
		const alreadyCurrentOp: UpdateFormulaOp = {
			...updateFormulaOp,
			alreadyCurrent: true, // diff layer set this flag
		};

		const mockUpdateFormula = vi.fn();

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [alreadyCurrentOp], {
			dryRun: false,
			updateFormula: mockUpdateFormula,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockUpdateFormula).not.toHaveBeenCalled();
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0].reason).toBe('formula_current');
	});

	it('executes TOUCH_SAVE via touchSaveFormula', async () => {
		const mockTouchSave = vi.fn().mockResolvedValue({
			touchSaveCount: 6,
			noInstances: false,
			failed: 0,
		});

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [touchSaveOp], {
			dryRun: false,
			touchSaveFormula: mockTouchSave,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockTouchSave).toHaveBeenCalledOnce();
		expect(result.touchSaves).toHaveLength(1);
		expect(result.touchSaves[0].count).toBe(6);
	});

	it('dry-run: no writes; returns would-execute plan', async () => {
		const mockMigrateProperty = vi.fn();
		const mockDeleteProperty = vi.fn();

		const result: PhaseBExecutionResult = await executePhaseBOps(client, [backfillOp, deleteOp], {
			dryRun: true,
			migrateProperty: mockMigrateProperty,
			deleteProperty: mockDeleteProperty,
			now: () => '2026-05-20T04:00:00Z',
		});

		expect(mockMigrateProperty).not.toHaveBeenCalled();
		expect(mockDeleteProperty).not.toHaveBeenCalled();
		expect(result.dryRun).toBe(true);
		expect(result.wouldExecute).toHaveLength(2);
	});

	it('continues executing remaining ops after a single op failure', async () => {
		const mockMigrateProperty = vi.fn().mockRejectedValueOnce(new Error('migrate failed: 500'));
		const mockUpdateFormula = vi.fn().mockResolvedValue({ updated: true });

		const result: PhaseBExecutionResult = await executePhaseBOps(
			client,
			[backfillOp, updateFormulaOp],
			{
				dryRun: false,
				migrateProperty: mockMigrateProperty,
				updateFormula: mockUpdateFormula,
				now: () => '2026-05-20T04:00:00Z',
			},
		);

		expect(result.failed).toHaveLength(1);
		expect(result.formulaUpdates).toHaveLength(1); // second op still ran
	});

	describe('partial-failure recovery (re-run semantics)', () => {
		it('skips BACKFILL_DATA where target already matches source (idempotency from migrateProperty)', async () => {
			// On re-run after a partial backfill:
			// - 3 of 6 sections already have voice set (target matches source)
			// - migrateProperty's own idempotency skips those 3
			// - only the remaining 3 are migrated
			const mockMigrateProperty = vi.fn().mockResolvedValue({
				migrated: 3,
				skipped: 3, // 3 already done
				failed: 0,
			});

			const result: PhaseBExecutionResult = await executePhaseBOps(client, [backfillOp], {
				dryRun: false,
				migrateProperty: mockMigrateProperty,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.backfilled[0].migrated).toBe(3);
			expect(result.backfilled[0].skipped).toBe(3);
		});
	});

	// RED-5: ADD_PROPERTY ops must be dispatched to addProperty injectable, not silently dropped.
	// For §1 renames whose targets were NOT added in Phase A (person.avatar, section.voice,
	// work.original_voicing, work.original_duration, work.original_language), the diff emits
	// ADD_PROPERTY ops that executePhaseBOps must handle. Currently the switch falls through.
	describe('ADD_PROPERTY dispatch (RED-5)', () => {
		const addAvatarOp: AddPropertyOp = {
			kind: 'ADD_PROPERTY',
			parentTypeName: 'person',
			parentTypeId: 'person-type-id',
			parentType: 'person',
			propertyName: 'avatar',
			def: { name: 'avatar', type: 'file' },
		};

		it('calls addProperty when an ADD_PROPERTY op is present', async () => {
			const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'avatar-prop-def-id' });

			const result: PhaseBExecutionResult = await executePhaseBOps(client, [addAvatarOp], {
				dryRun: false,
				addProperty: mockAddProperty,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(mockAddProperty).toHaveBeenCalledOnce();
			// Op must appear in result — not silently dropped
			expect(result.addedProperties ?? result.executed ?? result.failed).not.toHaveLength(0);
		});

		it('records ADD_PROPERTY result so the op is not silently dropped', async () => {
			const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'avatar-prop-def-id' });

			const result: PhaseBExecutionResult = await executePhaseBOps(client, [addAvatarOp], {
				dryRun: false,
				addProperty: mockAddProperty,
				now: () => '2026-05-20T04:00:00Z',
			});

			// Must appear in an "added" bucket, not in failed
			expect(result.failed).toHaveLength(0);
			// addedProperties is the expected result key (mirrors backfilled/deleted pattern)
			expect(result.addedProperties).toHaveLength(1);
			expect(result.addedProperties![0].propertyName).toBe('avatar');
		});

		it('records ADD_PROPERTY failure without crashing (continue-on-failure semantics)', async () => {
			const mockAddProperty = vi.fn().mockRejectedValueOnce(new Error('add failed: 500'));
			const mockMigrateProperty = vi.fn().mockResolvedValue({ migrated: 1, skipped: 0, failed: 0 });

			const result: PhaseBExecutionResult = await executePhaseBOps(
				client,
				[addAvatarOp, backfillOp],
				{
					dryRun: false,
					addProperty: mockAddProperty,
					migrateProperty: mockMigrateProperty,
					now: () => '2026-05-20T04:00:00Z',
				},
			);

			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].error).toMatch(/500/);
			// Second op still ran
			expect(result.backfilled).toHaveLength(1);
		});

		it('handles all 5 §1 rename target properties that Phase A did not add', async () => {
			// Confirmed from Phase A execution report: these 5 targets were NOT in Phase A scope.
			// The §1 diff must emit ADD_PROPERTY for each; executePhaseBOps must call addProperty 5×.
			const renameTargetOps: AddPropertyOp[] = [
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'person',
					parentTypeId: 'person-tid',
					parentType: 'person',
					propertyName: 'avatar',
					def: { name: 'avatar', type: 'file' },
				},
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'section',
					parentTypeId: 'section-tid',
					parentType: 'section',
					propertyName: 'voice',
					def: { name: 'voice', type: 'reference' },
				},
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'work',
					parentTypeId: 'work-tid',
					parentType: 'work',
					propertyName: 'original_voicing',
					def: { name: 'original_voicing', type: 'string' },
				},
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'work',
					parentTypeId: 'work-tid',
					parentType: 'work',
					propertyName: 'original_duration',
					def: { name: 'original_duration', type: 'number' },
				},
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'work',
					parentTypeId: 'work-tid',
					parentType: 'work',
					propertyName: 'original_language',
					def: { name: 'original_language', type: 'string' },
				},
			];

			const mockAddProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });

			const result: PhaseBExecutionResult = await executePhaseBOps(client, renameTargetOps, {
				dryRun: false,
				addProperty: mockAddProperty,
				now: () => '2026-05-20T04:00:00Z',
			});

			// All 5 must be dispatched — currently fails because ADD_PROPERTY falls through
			expect(mockAddProperty).toHaveBeenCalledTimes(5);
			expect(result.addedProperties).toHaveLength(5);
			expect(result.failed).toHaveLength(0);
		});

		it('dry-run: ADD_PROPERTY ops appear in wouldExecute plan', async () => {
			const mockAddProperty = vi.fn();

			const result: PhaseBExecutionResult = await executePhaseBOps(client, [addAvatarOp], {
				dryRun: true,
				addProperty: mockAddProperty,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(mockAddProperty).not.toHaveBeenCalled();
			expect(result.dryRun).toBe(true);
			expect(result.wouldExecute).toContainEqual(expect.objectContaining({ kind: 'ADD_PROPERTY' }));
		});
	});

	// Hardening: prevent silent bypass of pre-condition checks on live runs.
	// Added 2026-05-20 per team-lead directive (session 7).
	describe('verifyDeleteSafe hardening', () => {
		it('throws when any DELETE_PROPERTY op has verifyPreconditions=true but no verifyDeleteSafe injectable is provided', async () => {
			await expect(
				executePhaseBOps(client, [deleteOp], {
					dryRun: false,
					deleteProperty: vi.fn(),
					now: () => '2026-05-20T04:00:00Z',
				}),
			).rejects.toThrow(/verifyDeleteSafe/);
		});

		it('does not throw when verifyPreconditions=true DELETEs are present in a dry-run', async () => {
			const result = await executePhaseBOps(client, [deleteOp], {
				dryRun: true,
				now: () => '2026-05-20T04:00:00Z',
			});
			expect(result.dryRun).toBe(true);
			expect(result.wouldExecute).toHaveLength(1);
		});

		it('does not throw when DELETE_PROPERTY ops lack verifyPreconditions (e.g. §1 rename deletes)', async () => {
			const renameDeleteOp: DeletePropertyOp = {
				kind: 'DELETE_PROPERTY',
				parentType: 'section',
				propertyName: 'ordinal',
				propertyDefId: 'ordinal-id',
				// no verifyPreconditions flag
			};
			const mockDeleteProperty = vi.fn().mockResolvedValue({ deleted: true });

			const result = await executePhaseBOps(client, [renameDeleteOp], {
				dryRun: false,
				deleteProperty: mockDeleteProperty,
				now: () => '2026-05-20T04:00:00Z',
			});
			expect(result.deleted).toHaveLength(1);
		});
	});
});
