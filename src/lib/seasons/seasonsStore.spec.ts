// src/lib/seasons/seasonsStore.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { seasonsStore, hydrateSeasons } from './seasonsStore';

vi.mock('./entuSeasons', () => ({
	listSeasons: vi.fn(),
}));

import { listSeasons } from './entuSeasons';
const mockListSeasons = vi.mocked(listSeasons);

const args = { orgId: 'org1', personId: 'person1', token: 'jwt' };

beforeEach(() => {
	vi.restoreAllMocks();
	// reset the store to a known state before each test
	seasonsStore.set({ status: 'idle' });
});

describe('hydrateSeasons', () => {
	it('sets loading state synchronously, then ready on success', async () => {
		const seasons = [
			{ id: 's1', name: 'Autumn 26', startDate: '2026-09-01', endDate: '2027-05-31' },
		];
		mockListSeasons.mockResolvedValue(seasons);
		const promise = hydrateSeasons(args);
		// synchronous check: store must be loading before await resolves
		expect(get(seasonsStore).status).toBe('loading');
		await promise;
		const state = get(seasonsStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.seasons).toEqual(seasons);
		}
	});

	it('transitions to ready with empty seasons array when listSeasons returns []', async () => {
		// Empty result → ready with seasons:[] so the route can show the owner-empty-CTA
		// branch (canManage gate). no-rights is reserved for explicit rights denials from
		// Entu, not simply "no seasons created yet" (RED-29.1 fix).
		mockListSeasons.mockResolvedValue([]);
		await hydrateSeasons(args);
		const state = get(seasonsStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.seasons).toEqual([]);
		}
	});

	it('transitions to error when listSeasons throws', async () => {
		mockListSeasons.mockRejectedValue(new Error('fetch failed'));
		await hydrateSeasons(args);
		expect(get(seasonsStore).status).toBe('error');
	});

	it('resets to loading on org-change (second call clears previous ready state)', async () => {
		// First hydration: org1 → ready
		const seasons = [{ id: 's1', name: 'A', startDate: '2026-09-01', endDate: '2027-05-31' }];
		mockListSeasons.mockResolvedValue(seasons);
		await hydrateSeasons(args);
		expect(get(seasonsStore).status).toBe('ready');

		// Second hydration: different org — store must be set to loading BEFORE the
		// new fetch resolves (reset-on-org-change; mirrors libraryStore pattern)
		let capturedMid: string | undefined;
		mockListSeasons.mockImplementation(() => {
			capturedMid = get(seasonsStore).status;
			return Promise.resolve([]);
		});
		await hydrateSeasons({ ...args, orgId: 'org2' });
		expect(capturedMid).toBe('loading');
	});
});
