import { describe, it, expect, vi, afterEach } from 'vitest';
import { migrateProperty, type MigratePropertyOptions, type MigrationResult } from './data-migrator';
import type { EntuClient } from './entu-client';

// Design assumption (Checkpoint 1 Q3): the migrator receives a pre-built
// voiceLookup: Map<string, string> (string value → voice entity _id) for
// string→reference backfills. This matches Phase A's createEntity injection
// pattern — the migrator itself does not query Entu for the voice map.
// If Josquin chooses to build the map inside the migrator, update these tests.

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

afterEach(() => {
	vi.restoreAllMocks();
});

// Helper: build a mock Entu entity with a single typed property value
function makeInstance(id: string, propValues: Record<string, { type: string; value: unknown }[]>) {
	return {
		_id: id,
		...Object.fromEntries(
			Object.entries(propValues).map(([k, vals]) => [k, vals])
		)
	};
}

describe('migrateProperty — file→file (person.photo → person.avatar)', () => {
	it('copies file reference from source to target for each instance', async () => {
		const instances = [
			// Instance with photo.reference set, avatar absent
			{ _id: 'person-1', photo: [{ _id: 'file-ref-1', type: 'file', reference: 'file-entity-id-1' }] },
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'new-prop-id' });

		const result: MigrationResult = await migrateProperty(client, {
			parentType: 'person',
			sourceProperty: 'photo',
			targetProperty: 'avatar',
			backfillKind: 'file',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(1);
		expect(result.skipped).toBe(0);
		expect(result.failed).toBe(0);
		expect(mockWriteProperty).toHaveBeenCalledOnce();
		const [, entityId, propName, value] = mockWriteProperty.mock.calls[0] as [EntuClient, string, string, unknown];
		expect(entityId).toBe('person-1');
		expect(propName).toBe('avatar');
		expect(value).toBe('file-entity-id-1');
	});

	it('skips instance where target is already populated with same value (idempotency)', async () => {
		const instances = [
			{
				_id: 'person-1',
				photo: [{ type: 'file', reference: 'file-entity-id-1' }],
				avatar: [{ type: 'file', reference: 'file-entity-id-1' }] // already matches
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'person',
			sourceProperty: 'photo',
			targetProperty: 'avatar',
			backfillKind: 'file',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(result.migrated).toBe(0);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});

	it('skips instances where source property is absent', async () => {
		const instances = [
			{ _id: 'person-2' } // no photo property at all
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'person',
			sourceProperty: 'photo',
			targetProperty: 'avatar',
			backfillKind: 'file',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});
});

describe('migrateProperty — string→string (work.voicing → work.original_voicing)', () => {
	it('copies string value from source to target', async () => {
		const instances = [
			{ _id: 'work-1', voicing: [{ type: 'string', string: 'SATB' }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'voicing',
			targetProperty: 'original_voicing',
			backfillKind: 'string',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(1);
		const [, , , value] = mockWriteProperty.mock.calls[0] as [EntuClient, string, string, unknown];
		expect(value).toBe('SATB');
	});

	it('skips when target already has the same value', async () => {
		const instances = [
			{
				_id: 'work-1',
				voicing: [{ type: 'string', string: 'SATB' }],
				original_voicing: [{ type: 'string', string: 'SATB' }]
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'voicing',
			targetProperty: 'original_voicing',
			backfillKind: 'string',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});
});

describe('migrateProperty — number→number (work.duration → work.original_duration)', () => {
	it('copies number value from source to target', async () => {
		const instances = [
			{ _id: 'work-1', duration: [{ type: 'number', number: 240 }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'duration',
			targetProperty: 'original_duration',
			backfillKind: 'number',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(1);
		const [, , , value] = mockWriteProperty.mock.calls[0] as [EntuClient, string, string, unknown];
		expect(value).toBe(240);
	});
});

describe('migrateProperty — string_list (work.language → work.original_language)', () => {
	it('copies all string values from source to target', async () => {
		const instances = [
			{
				_id: 'work-1',
				language: [
					{ type: 'string', string: 'et' },
					{ type: 'string', string: 'la' }
				]
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'language',
			targetProperty: 'original_language',
			backfillKind: 'string_list',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		// One call per string value in the list
		expect(mockWriteProperty).toHaveBeenCalledTimes(2);
		expect(result.migrated).toBe(1); // 1 instance migrated
	});

	it('skips instance where all target values already match source', async () => {
		const instances = [
			{
				_id: 'work-1',
				language: [{ type: 'string', string: 'et' }],
				original_language: [{ type: 'string', string: 'et' }]
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'language',
			targetProperty: 'original_language',
			backfillKind: 'string_list',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});
});

describe('migrateProperty — string→reference (section.voice_type → section.voice)', () => {
	// Fixtures based on Finn's probe: docs/migration/findings/section-voice-types-2026-05-20.md
	// 5 distinct values across 16 sections: alto(3), baritone(2), bass(3), soprano(3), tenor(5).
	// Zero anomalies. All values are lowercase and match v4E voice entity names exactly.
	// Phase B must create 5 voice INSTANCES before backfilling (voice TYPE exists from Phase A).

	// The full live-data lookup map (5 entries, one per distinct voice_type value)
	const LIVE_VOICE_LOOKUP = new Map([
		['alto',     'voice-alto-id'],
		['baritone', 'voice-baritone-id'],
		['bass',     'voice-bass-id'],
		['soprano',  'voice-soprano-id'],
		['tenor',    'voice-tenor-id']
	]);

	it('migrates all 5 distinct voice_type values to reference ids', async () => {
		// One section per distinct value — covers the full live set
		const instances = [
			{ _id: 'sec-alto',     voice_type: [{ type: 'string', string: 'alto' }] },
			{ _id: 'sec-baritone', voice_type: [{ type: 'string', string: 'baritone' }] },
			{ _id: 'sec-bass',     voice_type: [{ type: 'string', string: 'bass' }] },
			{ _id: 'sec-soprano',  voice_type: [{ type: 'string', string: 'soprano' }] },
			{ _id: 'sec-tenor',    voice_type: [{ type: 'string', string: 'tenor' }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup: LIVE_VOICE_LOOKUP,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(5);
		expect(result.failed).toBe(0);
		expect(result.unmatchedVoiceTypes ?? []).toHaveLength(0);
	});

	it('writes the correct voice entity id for each section', async () => {
		const instances = [
			{ _id: 'sec-soprano', voice_type: [{ type: 'string', string: 'soprano' }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup: LIVE_VOICE_LOOKUP,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		const [, , , value] = mockWriteProperty.mock.calls[0] as [EntuClient, string, string, unknown];
		expect(value).toBe('voice-soprano-id');
	});

	it('mirrors the 16-section live distribution: zero unmatched_voice_type failures', async () => {
		// Full fixture mirroring the live db — 16 sections, 5 distinct values
		const liveInstances = [
			{ _id: 's-1',  voice_type: [{ type: 'string', string: 'soprano' }] },
			{ _id: 's-2',  voice_type: [{ type: 'string', string: 'alto' }] },
			{ _id: 's-3',  voice_type: [{ type: 'string', string: 'tenor' }] },
			{ _id: 's-4',  voice_type: [{ type: 'string', string: 'bass' }] },
			{ _id: 's-5',  voice_type: [{ type: 'string', string: 'soprano' }] },
			{ _id: 's-6',  voice_type: [{ type: 'string', string: 'soprano' }] },
			{ _id: 's-7',  voice_type: [{ type: 'string', string: 'alto' }] },
			{ _id: 's-8',  voice_type: [{ type: 'string', string: 'alto' }] },
			{ _id: 's-9',  voice_type: [{ type: 'string', string: 'tenor' }] },
			{ _id: 's-10', voice_type: [{ type: 'string', string: 'tenor' }] },
			{ _id: 's-11', voice_type: [{ type: 'string', string: 'baritone' }] },
			{ _id: 's-12', voice_type: [{ type: 'string', string: 'bass' }] },
			{ _id: 's-13', voice_type: [{ type: 'string', string: 'tenor' }] },
			{ _id: 's-14', voice_type: [{ type: 'string', string: 'tenor' }] },
			{ _id: 's-15', voice_type: [{ type: 'string', string: 'baritone' }] },
			{ _id: 's-16', voice_type: [{ type: 'string', string: 'bass' }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(liveInstances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup: LIVE_VOICE_LOOKUP,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(16);
		expect(result.failed).toBe(0);
		expect(result.unmatchedVoiceTypes ?? []).toHaveLength(0);
		expect(mockWriteProperty).toHaveBeenCalledTimes(16);
	});

	it('skips sections where voice reference already set to the correct id (idempotency)', async () => {
		const instances = [
			{
				_id: 'sec-tenor',
				voice_type: [{ type: 'string', string: 'tenor' }],
				voice: [{ type: 'reference', reference: 'voice-tenor-id' }] // already correct
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup: LIVE_VOICE_LOOKUP,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(result.migrated).toBe(0);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});

	it('records unmatched_voice_type failure when no lookup match found', async () => {
		const instances = [
			{ _id: 'section-2', voice_type: [{ type: 'string', string: 'unknown_voice' }] }
		];
		const voiceLookup = new Map<string, string>(); // empty — no matches

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.failed).toBe(1);
		expect(result.unmatchedVoiceTypes).toBeDefined();
		expect(result.unmatchedVoiceTypes).toContain('unknown_voice');
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});

	it('does NOT silently drop unmatched voice_type values', async () => {
		// Safety test: spec requires unmatched values are reported, not silently dropped.
		// This scenario is not expected in the real db (all values match) but must be handled.
		const instances = [
			{ _id: 'section-3', voice_type: [{ type: 'string', string: 'T1' }] }
		];
		const voiceLookup = new Map([['tenor', 'voice-tenor-id']]); // 'T1' not mapped

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const result = await migrateProperty(client, {
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
			voiceLookup,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.failed).toBeGreaterThan(0);
		expect(result.unmatchedVoiceTypes?.includes('T1')).toBe(true);
	});
});

// YELLOW-1: parent_copy backfill kind (§2 op #7: work.arranger → edition.arranger)
// The 'parent_copy' path must use an injected parentLookup Map<sourceInstanceId, parentPropertyValue>
// rather than reading from the same instance. Without parentLookup, it must fail loudly.
describe('migrateProperty — parent_copy (work.arranger → edition.arranger)', () => {
	it('requires parentLookup injection and uses it to look up the parent value', async () => {
		const instances = [
			{ _id: 'edition-1' } // no arranger on the edition itself
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn().mockResolvedValue({ _id: 'p-id' });

		const parentLookup = new Map([
			['edition-1', 'Arvo Pärt'] // parent work.arranger value for this edition
		]);

		const result = await migrateProperty(client, {
			parentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
			parentLookup,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.migrated).toBe(1);
		const [, , , value] = mockWriteProperty.mock.calls[0] as [unknown, string, string, unknown];
		expect(value).toBe('Arvo Pärt');
	});

	it('throws a clear error when parent_copy is used without parentLookup injection', async () => {
		const instances = [{ _id: 'edition-1' }];
		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		await expect(
			migrateProperty(client, {
				parentType: 'edition',
				sourceProperty: 'arranger',
				targetProperty: 'arranger',
				backfillKind: 'parent_copy',
				// parentLookup deliberately omitted
				listInstances: mockListInstances,
				writeProperty: mockWriteProperty
			})
		).rejects.toThrow(/parentLookup/);
	});

	it('skips instances where the target already matches the parent value (idempotency)', async () => {
		const instances = [
			{
				_id: 'edition-1',
				arranger: [{ type: 'string', string: 'Arvo Pärt' }] // already set
			}
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const parentLookup = new Map([['edition-1', 'Arvo Pärt']]);

		const result = await migrateProperty(client, {
			parentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
			parentLookup,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(result.migrated).toBe(0);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});

	it('skips instances not present in parentLookup (edition has no parent work record)', async () => {
		const instances = [
			{ _id: 'edition-orphan' } // not in parentLookup
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn();

		const parentLookup = new Map<string, string>(); // empty

		const result = await migrateProperty(client, {
			parentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
			parentLookup,
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.skipped).toBe(1);
		expect(mockWriteProperty).not.toHaveBeenCalled();
	});
});

describe('migrateProperty — error handling', () => {
	it('records failed writes without aborting other instances', async () => {
		const instances = [
			{ _id: 'work-1', voicing: [{ type: 'string', string: 'SATB' }] },
			{ _id: 'work-2', voicing: [{ type: 'string', string: 'SSA' }] }
		];

		const mockListInstances = vi.fn().mockResolvedValue(instances);
		const mockWriteProperty = vi.fn()
			.mockRejectedValueOnce(new Error('write failed: 500'))
			.mockResolvedValueOnce({ _id: 'p-id' });

		const result = await migrateProperty(client, {
			parentType: 'work',
			sourceProperty: 'voicing',
			targetProperty: 'original_voicing',
			backfillKind: 'string',
			listInstances: mockListInstances,
			writeProperty: mockWriteProperty
		});

		expect(result.failed).toBe(1);
		expect(result.migrated).toBe(1);
	});
});
