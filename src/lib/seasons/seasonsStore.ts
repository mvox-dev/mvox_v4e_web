// src/lib/seasons/seasonsStore.ts
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { writable, type Writable } from 'svelte/store';
import { listSeasons } from './entuSeasons';
import type { Season } from './types';

export type SeasonsStoreState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ready'; seasons: Season[] }
	| { status: 'no-rights' }
	| { status: 'error'; reason: string };

export const seasonsStore: Writable<SeasonsStoreState> = writable({ status: 'idle' });

/**
 * Hydrate the seasons store for an org. Mirrors `libraryStore.hydrateLibrarySection`:
 * sets `loading` synchronously (so an org-change resets any prior `ready` state
 * before the new fetch resolves), then maps `listSeasons` →
 * `ready` (seasons, including the empty list — RED-29.1) | `error`. The `no-rights`
 * variant is reserved for a genuine rights denial and is not emitted here yet.
 */
export async function hydrateSeasons(args: {
	orgId: string;
	personId: string;
	token: string;
}): Promise<void> {
	seasonsStore.set({ status: 'loading' });
	try {
		const seasons = await listSeasons({ db: PUBLIC_ENTU_DB, token: args.token }, args.orgId);
		// Empty → ready with seasons:[] (RED-29.1). An empty result is ambiguous between
		// owner-with-no-seasons and viewer-with-no-access; the route's canManage gate
		// disambiguates. `no-rights` is reserved for a genuine rights denial (a future
		// 403 path), not "no seasons created yet".
		seasonsStore.set({ status: 'ready', seasons });
	} catch (err) {
		seasonsStore.set({
			status: 'error',
			reason: err instanceof Error ? err.message : 'hydration failed',
		});
	}
}
