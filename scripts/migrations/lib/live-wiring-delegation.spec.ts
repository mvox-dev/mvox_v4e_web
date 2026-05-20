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
		migrateProperty: vi.fn().mockResolvedValue({ migrated: 1, skipped: 0, failed: 0 })
	};
});

// Import AFTER the mock is set up.
import { migrateProperty as migratePropertySpy } from './data-migrator';
import { buildLiveCallbacks } from '../2026-05-20-phase-b';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

beforeEach(() => {
	// Stub fetch so the hand-rolled migrateProperty path doesn't make real HTTP calls.
	// When delegation is implemented, data-migrator.migrateProperty (the spy) runs instead
	// and fetch is never invoked. Either way the test can run to assertion without network I/O.
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
	);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe('RED v10: buildLiveCallbacks.migrateProperty delegates to data-migrator', () => {
	it('calls data-migrator.migrateProperty once when invoked', async () => {
		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'work',
			sourceProperty: 'voicing',
			targetProperty: 'original_voicing',
			backfillKind: 'string'
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
			backfillKind: 'string_to_reference'
		};

		await cbs.migrateProperty(client, op);

		const [, , options] = (migratePropertySpy as ReturnType<typeof vi.fn>).mock.calls[0] as [
			EntuClient,
			BackfillDataOp,
			Record<string, unknown>
		];
		expect(typeof options.listInstances).toBe('function');
		expect(typeof options.writeProperty).toBe('function');
		expect(typeof options.deleteProperty).toBe('function');
	});
});
