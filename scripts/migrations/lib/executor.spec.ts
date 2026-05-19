import { describe, it, expect, vi } from 'vitest';
import { executeAdditions, type ExecutionResult } from './executor';
import type { DiffOp } from './diff';
import type { EntuClient } from './entu-client';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'jwt'
};

const ops: DiffOp[] = [
	{
		kind: 'CREATE_TYPE',
		typeName: 'voice',
		label: 'Voice',
		properties: [{ name: 'label', type: 'string' }]
	},
	{
		kind: 'ADD_PROPERTY',
		parentTypeName: 'season',
		parentTypeId: 'season-db-id',
		propertyName: 'end_date',
		def: { name: 'end_date', type: 'date' }
	}
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
			now: () => '2026-05-19T20:00:00Z'
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
			now: () => '2026-05-19T20:00:00Z'
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
			now: () => '2026-05-19T20:00:00Z'
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
				def: { name: 'work', type: 'string', formula: 'edition_work.*.name CONCAT' }
			}
		];
		const createMock = vi.fn().mockResolvedValue({ _id: 'edition-work-prop-id' });

		const result = await executeAdditions(client, formulaOps, {
			dryRun: false,
			createEntity: createMock,
			now: () => '2026-05-19T20:00:00Z'
		});

		expect(result.formulaTouchSaveDeferred).toHaveLength(1);
		expect(result.formulaTouchSaveDeferred[0]).toMatchObject({
			parentType: 'edition',
			property: 'work'
		});
	});
});
