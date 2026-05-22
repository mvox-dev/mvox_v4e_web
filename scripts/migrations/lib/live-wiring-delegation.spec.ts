/**
 * RED v10: buildLiveCallbacks.migrateProperty must delegate to data-migrator.migrateProperty.
 * Encodes the SoT refactor contract: the hand-rolled per-backfillKind impl in buildLiveCallbacks
 * must be replaced by delegation so that pruneExistingTarget (v9.2) is reachable from live runs.
 *
 * (*MVOX:Tallis*)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { EntuClient } from './entu-client';
import type { BackfillDataOp } from './diff';

// vi.mock must be at the top level before any imports that use the module.
vi.mock('./data-migrator', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./data-migrator')>();
	return {
		...actual,
		migrateProperty: vi.fn().mockResolvedValue({ migrated: 1, skipped: 0, failed: 0 }),
	};
});

// Import AFTER the mock is set up.
import { migrateProperty as migratePropertySpy } from './data-migrator';
import { buildLiveCallbacks } from '../2026-05-20-phase-b';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt',
};

beforeEach(() => {
	// Stub fetch so the hand-rolled migrateProperty path doesn't make real HTTP calls.
	// When delegation is implemented, data-migrator.migrateProperty (the spy) runs instead
	// and fetch is never invoked. Either way the test can run to assertion without network I/O.
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 }),
	);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

/**
 * RED v11: buildLiveCallbacks.migrateProperty parent_copy branch must delegate to
 * data-migrator.migrateProperty with a pre-built parentLookup Map.
 *
 * Pre-flight (list → GET child → GET parent → read source) stays in buildLiveCallbacks;
 * the iterate/idempotency/pruneExistingTarget/writeProperty loop moves to the library.
 *
 * (*MVOX:Tallis*)
 */

describe('RED v11: buildLiveCallbacks.migrateProperty parent_copy delegates to data-migrator', () => {
	it('RED v11.1: calls data-migrator with backfillKind=parent_copy and a non-empty parentLookup Map', async () => {
		// Pre-flight fetch sequence: list editions → GET edition-1 (has parent work-1) → GET work-1 (has arranger)
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				// listInstancesByType — edition instances
				new Response(
					JSON.stringify({
						entities: [{ _id: 'edition-1' }],
						count: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET edition-1 — child entity with _parent reference
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-1', _parent: [{ reference: 'work-1' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET work-1 — parent entity with source property
				new Response(
					JSON.stringify({
						entity: { _id: 'work-1', arranger: [{ type: 'string', string: 'Arvo Pärt' }] },
					}),
					{ status: 200 },
				),
			);

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp & { targetParentType?: string } = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			targetParentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
		};

		await cbs.migrateProperty(client, op);

		expect(migratePropertySpy).toHaveBeenCalledOnce();
		const [, calledOp, calledInjectables] = (migratePropertySpy as ReturnType<typeof vi.fn>).mock
			.calls[0] as [EntuClient, BackfillDataOp, Record<string, unknown>];
		expect(calledOp.backfillKind).toBe('parent_copy');
		expect(calledInjectables.parentLookup).toBeInstanceOf(Map);
		expect((calledInjectables.parentLookup as Map<string, string>).size).toBeGreaterThan(0);
	});

	it('RED v11.2: parentLookup Map entries correctly map childId to parent source value', async () => {
		// Two children, each with a different parent source value
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				// listInstancesByType — 2 edition instances
				new Response(
					JSON.stringify({
						entities: [{ _id: 'edition-1' }, { _id: 'edition-2' }],
						count: 2,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET edition-1
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-1', _parent: [{ reference: 'work-1' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET work-1
				new Response(
					JSON.stringify({
						entity: { _id: 'work-1', arranger: [{ type: 'string', string: 'Arvo Pärt' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET edition-2
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-2', _parent: [{ reference: 'work-2' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET work-2
				new Response(
					JSON.stringify({
						entity: { _id: 'work-2', arranger: [{ type: 'string', string: 'Cyrillus Kreek' }] },
					}),
					{ status: 200 },
				),
			);

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp & { targetParentType?: string } = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			targetParentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
		};

		await cbs.migrateProperty(client, op);

		const [, , calledInjectables] = (migratePropertySpy as ReturnType<typeof vi.fn>).mock
			.calls[0] as [EntuClient, BackfillDataOp, Record<string, unknown>];
		const parentLookup = calledInjectables.parentLookup as Map<string, string>;
		expect(parentLookup.get('edition-1')).toBe('Arvo Pärt');
		expect(parentLookup.get('edition-2')).toBe('Cyrillus Kreek');
	});

	it('RED v11.3: child with no parent reference is omitted from parentLookup', async () => {
		// edition-1 has no _parent; edition-2 has a parent with a source value
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				// listInstancesByType — 2 editions
				new Response(
					JSON.stringify({
						entities: [{ _id: 'edition-1' }, { _id: 'edition-2' }],
						count: 2,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET edition-1 — no _parent reference
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-1' },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET edition-2
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-2', _parent: [{ reference: 'work-2' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET work-2
				new Response(
					JSON.stringify({
						entity: { _id: 'work-2', arranger: [{ type: 'string', string: 'Cyrillus Kreek' }] },
					}),
					{ status: 200 },
				),
			);

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp & { targetParentType?: string } = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			targetParentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
		};

		await cbs.migrateProperty(client, op);

		const [, , calledInjectables] = (migratePropertySpy as ReturnType<typeof vi.fn>).mock
			.calls[0] as [EntuClient, BackfillDataOp, Record<string, unknown>];
		const parentLookup = calledInjectables.parentLookup as Map<string, string>;
		// edition-1 (no parent) must not appear in the Map
		expect(parentLookup.has('edition-1')).toBe(false);
		// edition-2 must appear
		expect(parentLookup.has('edition-2')).toBe(true);
	});

	it('RED v11.4: counters returned are exactly those from data-migrator (pass-through)', async () => {
		// Spy already returns { migrated: 1, skipped: 0, failed: 0 } by default mock.
		// Override for this test to a distinct shape so pass-through is non-trivially testable.
		(migratePropertySpy as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			migrated: 3,
			skipped: 7,
			failed: 2,
		});

		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				// listInstancesByType — 1 edition
				new Response(JSON.stringify({ entities: [{ _id: 'edition-1' }], count: 1 }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				// GET edition-1
				new Response(
					JSON.stringify({
						entity: { _id: 'edition-1', _parent: [{ reference: 'work-1' }] },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				// GET work-1
				new Response(
					JSON.stringify({
						entity: { _id: 'work-1', arranger: [{ type: 'string', string: 'Arvo Pärt' }] },
					}),
					{ status: 200 },
				),
			);

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp & { targetParentType?: string } = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			targetParentType: 'edition',
			sourceProperty: 'arranger',
			targetProperty: 'arranger',
			backfillKind: 'parent_copy',
		};

		const result = await cbs.migrateProperty(client, op);

		// Must pass through the library's return value exactly
		expect(result).toEqual({ migrated: 3, skipped: 7, failed: 2 });
	});
});

describe('RED v10: buildLiveCallbacks.migrateProperty delegates to data-migrator', () => {
	it('calls data-migrator.migrateProperty once when invoked', async () => {
		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			sourceProperty: 'voicing',
			targetProperty: 'original_voicing',
			backfillKind: 'string',
		};

		await cbs.migrateProperty(client, op);

		// Must have delegated — if buildLiveCallbacks re-implements inline, the spy is never called
		expect(migratePropertySpy).toHaveBeenCalledOnce();
		expect(migratePropertySpy).toHaveBeenCalledWith(client, op, expect.any(Object));
	});

	it('passes an options object with listInstances, writeProperty, and deleteProperty to data-migrator', async () => {
		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference',
		};

		await cbs.migrateProperty(client, op);

		const [, , options] = (migratePropertySpy as ReturnType<typeof vi.fn>).mock.calls[0] as [
			EntuClient,
			BackfillDataOp,
			Record<string, unknown>,
		];
		expect(typeof options.listInstances).toBe('function');
		expect(typeof options.writeProperty).toBe('function');
		expect(typeof options.deleteProperty).toBe('function');
	});
});
