// @vitest-environment happy-dom
/**
 * True store→route integration tests for the empty-owner seam (RED-29.1).
 *
 * KEY DIFFERENCE from page.spec.ts: this file does NOT mock $lib/seasons/seasonsStore.
 * It uses the REAL seasonsStore + REAL hydrateSeasons. Only entuSeasons (listSeasons)
 * and the auth/navigation modules are mocked. This ensures a future store/route
 * contract drift (e.g. emitting wrong state on empty) is caught end-to-end.
 */
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/seasons') },
}));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));

// Token that decodeJwt can parse to yield personId 'person1'
// Base64url encode {"accounts":{"testdb":"person1"}}
const FAKE_TOKEN = `header.${btoa(JSON.stringify({ accounts: { testdb: 'person1' } }))}.sig`;

vi.mock('$lib/auth/storage', () => ({ getToken: () => FAKE_TOKEN }));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const selectedOrgStore = writable<unknown>(null);
	return {
		selectedOrgStore,
		userStore: {
			// Provide a ready user so the $effect proceeds past the user-status guard
			subscribe: (cb: (v: unknown) => void) => {
				cb({ status: 'ready', name: 'Alice', initial: 'A', orgs: [] });
				return () => {};
			},
		},
		decodeJwt: (token: string) => {
			try {
				return JSON.parse(atob(token.split('.')[1]));
			} catch {
				return null;
			}
		},
		urlOrgIdStore: {
			subscribe: (cb: (v: unknown) => void) => { cb(null); return () => {}; },
		},
	};
});

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_eyebrow: () => 'Rehearsals',
	seasons_page_title: () => 'Schedule',
	seasons_empty_no_seasons: () => 'No seasons yet.',
	seasons_empty_no_seasons_viewer: () => 'Season not yet set up.',
	seasons_form_season_heading: () => 'Season',
	seasons_form_season_submit: () => 'Create',
	seasons_field_name: () => 'Name',
	seasons_field_start_date: () => 'Start date',
	seasons_field_end_date: () => 'End date',
	seasons_field_description: () => 'Description',
	seasons_conductors_heading: () => 'Conductors',
	seasons_conductors_empty: () => 'No conductors assigned yet',
	seasons_conductors_remove: () => 'Remove',
	seasons_conductors_add: () => 'Add conductor',
	seasons_form_series_heading: () => 'New rehearsal series',
	seasons_form_series_submit: () => 'Create series',
	seasons_field_interval_days: () => 'Repeat every (days)',
	seasons_field_start_time: () => 'Start time',
	seasons_field_duration: () => 'Duration (minutes)',
	seasons_field_location: () => 'Location',
	seasons_actions_delete: () => 'Delete',
	seasons_actions_confirm: () => 'Confirm',
	seasons_actions_edit: () => 'Edit',
	seasons_empty_no_rehearsals: () => 'No rehearsals scheduled yet.',
	seasons_empty_no_rehearsals_cta: () => 'Create a rehearsal series',
	seasons_notice_partial_generate: () => 'Some rehearsals could not be created.',
	seasons_notice_partial_delete: () => 'Some rehearsals could not be deleted.',
	common_loading: () => 'Loading…',
	common_error: () => 'Something went wrong.',
}));

// Mock entuSeasons — override listSeasons + other async fns; keep real error classes.
vi.mock('$lib/seasons/entuSeasons', async () => {
	const real = await vi.importActual<typeof import('$lib/seasons/entuSeasons')>(
		'$lib/seasons/entuSeasons',
	);
	return {
		...real,
		listSeasons: vi.fn(),
		listRehearsals: vi.fn().mockResolvedValue([]),
		listConductors: vi.fn().mockResolvedValue([]),
		createSeason: vi.fn(),
		createSeriesWithEvents: vi.fn(),
	};
});

// NOTE: $lib/seasons/seasonsStore is NOT mocked — this file uses the REAL store.

import { seasonsStore } from '$lib/seasons/seasonsStore';
import { selectedOrgStore } from '$lib/auth/userStore';
import { listSeasons } from '$lib/seasons/entuSeasons';
import { get } from 'svelte/store';

const mockListSeasons = vi.mocked(listSeasons);

const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };
const memberOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: undefined };

beforeEach(() => {
	vi.restoreAllMocks();
	// Reset real store to idle before each test
	seasonsStore.set({ status: 'idle' });
	(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(null);
});

afterEach(cleanup);

describe('/seasons page — empty-owner seam integration (RED-29.1)', () => {
	it('listSeasons → [] + owner → seasons-empty-owner + season-form-wrap rendered', async () => {
		// Arrange: owner org + empty seasons list
		mockListSeasons.mockResolvedValue([]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);

		// Act: render (the route's $effect fires, calls real hydrateSeasons → real store)
		const { container } = render(Page);

		// Allow the $effect + hydrateSeasons async chain to settle
		await new Promise((r) => setTimeout(r, 50));

		// Assert: real store should be ready/seasons:[] after the real hydrateSeasons runs
		const state = get(seasonsStore);
		expect(state.status).toBe('ready');

		// Route should show the owner-empty branch with SeasonForm, not the viewer branch
		expect(container.querySelector('[data-testid="seasons-empty-owner"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="season-form-wrap"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="seasons-viewer"]')).toBeNull();
		expect(container.querySelector('[data-testid="seasons-empty-viewer"]')).toBeNull();
	});

	it('listSeasons → [] + non-owner → seasons-empty-viewer, no SeasonForm', async () => {
		// Arrange: member (non-owner) + empty seasons list
		mockListSeasons.mockResolvedValue([]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(memberOrg);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const state = get(seasonsStore);
		expect(state.status).toBe('ready');

		// Route must show viewer-empty, never the owner CTA
		expect(container.querySelector('[data-testid="seasons-empty-viewer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="seasons-empty-owner"]')).toBeNull();
		expect(container.querySelector('[data-testid="season-form-wrap"]')).toBeNull();
	});
});
