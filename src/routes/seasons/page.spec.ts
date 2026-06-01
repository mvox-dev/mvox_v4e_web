// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/seasons') },
}));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));

vi.mock('$lib/auth/storage', () => ({ getToken: () => null }));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	// Writable so tests can call selectedOrgStore.set({ role: 'owner' }) before render
	const selectedOrgStore = writable<unknown>(null);
	return {
		selectedOrgStore,
		userStore: {
			subscribe: (cb: (v: unknown) => void) => {
				cb({ status: 'loading' });
				return () => {};
			},
		},
		decodeJwt: () => null,
		urlOrgIdStore: {
			subscribe: (cb: (v: unknown) => void) => {
				cb(null);
				return () => {};
			},
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
	seasons_empty_no_rehearsals: () => 'No rehearsals scheduled yet.',
	seasons_empty_no_rehearsals_cta: () => 'Create a rehearsal series',
	seasons_notice_partial_generate: () => 'Some rehearsals could not be created.',
	seasons_notice_partial_delete: () => 'Some rehearsals could not be deleted.',
	common_loading: () => 'Loading…',
	common_error: () => 'Something went wrong.',
}));

// Seasons store mock — writable so tests can both set state directly AND run
// the real hydrateSeasons (imported separately for integration tests).
vi.mock('$lib/seasons/seasonsStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable<unknown>({ status: 'loading' });
	return {
		seasonsStore: store,
		hydrateSeasons: vi.fn(),
	};
});

vi.mock('$lib/seasons/entuSeasons', async () => {
	// Import real module so PartialGenerationError class is genuine (needed for instanceof
	// checks in the route catch block); override all async fns with vi.fn().
	const real = await vi.importActual<typeof import('$lib/seasons/entuSeasons')>(
		'$lib/seasons/entuSeasons',
	);
	return {
		...real,
		createSeriesWithEvents: vi.fn(),
		createSeason: vi.fn(),
		listSeasons: vi.fn(),
		listRehearsals: vi.fn(),
		listConductors: vi.fn(),
	};
});

import { seasonsStore, hydrateSeasons } from '$lib/seasons/seasonsStore';
import { selectedOrgStore } from '$lib/auth/userStore';
import {
	createSeriesWithEvents,
	createSeason,
	listSeasons,
	PartialGenerationError,
} from '$lib/seasons/entuSeasons';

const mockHydrate = vi.mocked(hydrateSeasons);
const mockCreateSeries = vi.mocked(createSeriesWithEvents);
const mockCreateSeason = vi.mocked(createSeason);
const mockListSeasons = vi.mocked(listSeasons);

const readySeasonsState = {
	status: 'ready' as const,
	seasons: [{ id: 'sea1', name: 'Autumn 2026', startDate: '2026-09-01', endDate: '2027-05-31' }],
};

beforeEach(() => {
	vi.restoreAllMocks();
	(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({ status: 'loading' });
	// Reset selectedOrgStore to null (non-owner) before each test
	(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(null);
});

afterEach(cleanup);

// ── Forward guards (stub already wires these) ─────────────────────────────────

describe('/seasons page — forward guards', () => {
	it('seasons-loading shown while store is loading', () => {
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({ status: 'loading' });
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="seasons-loading"]')).not.toBeNull();
	});

	it('seasons-error shown on store error', () => {
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'error',
			reason: 'oops',
		});
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="seasons-error"]')).not.toBeNull();
	});

	it('seasons-viewer shown when no-rights', () => {
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'no-rights',
		});
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="seasons-viewer"]')).not.toBeNull();
	});

	it('season-selector rendered when ready with seasons', () => {
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="season-selector"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="season-selector-item"]')?.textContent).toContain(
			'Autumn 2026',
		);
	});
});

// ── RED: owner-gating ─────────────────────────────────────────────────────────

describe('/seasons page — owner-gating', () => {
	it('owner-controls (SeasonForm + ConductorPanel) rendered when selectedOrg has role=owner', () => {
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set({
			id: 'org1',
			label: 'EFK',
			initials: 'EFK',
			role: 'owner',
		});
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="owner-controls"]')).not.toBeNull();
	});

	it('owner-controls absent when selectedOrg has role=undefined (non-owner)', () => {
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="owner-controls"]')).toBeNull();
	});

	it('seasons-empty-owner shown for owner when no seasons exist', () => {
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set({
			id: 'org1',
			label: 'EFK',
			initials: 'EFK',
			role: 'owner',
		});
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'ready',
			seasons: [],
		});
		const { container } = render(Page);
		// owner → seasons-empty-owner; non-owner would see seasons-empty-viewer
		expect(container.querySelector('[data-testid="seasons-empty-owner"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="seasons-empty-viewer"]')).toBeNull();
	});
});

// ── RED: series-create → re-hydrate ──────────────────────────────────────────

describe('/seasons page — series-create flow', () => {
	it('after SeriesForm oncreate, createSeriesWithEvents is called and hydrateSeasons is called for re-hydrate', async () => {
		mockCreateSeries.mockResolvedValue({ seriesId: 'ser1', eventIds: ['e1', 'e2'] });
		mockHydrate.mockResolvedValue(undefined);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);
		const { container } = render(Page);

		// Directly invoke the SeriesForm's oncreate via the wired prop (find SeriesForm by its testid)
		const seriesFormWrap = container.querySelector('[data-testid="series-form-wrap"]');
		expect(seriesFormWrap).not.toBeNull();

		// Trigger series form submission with a valid payload
		const nameInput = container.querySelector('[data-testid="series-name"]') as HTMLInputElement;
		const intervalInput = container.querySelector(
			'[data-testid="series-interval-days"]',
		) as HTMLInputElement;
		const startTimeInput = container.querySelector(
			'[data-testid="series-start-time"]',
		) as HTMLInputElement;
		const durationInput = container.querySelector(
			'[data-testid="series-duration-minutes"]',
		) as HTMLInputElement;
		const startDateInput = container.querySelector(
			'[data-testid="series-start-date"]',
		) as HTMLInputElement;
		const endDateInput = container.querySelector(
			'[data-testid="series-end-date"]',
		) as HTMLInputElement;
		const submitBtn = container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement;

		await fireEvent.input(nameInput, { target: { value: 'Tue' } });
		await fireEvent.input(intervalInput, { target: { value: '7' } });
		await fireEvent.input(startTimeInput, { target: { value: '19:00' } });
		await fireEvent.input(durationInput, { target: { value: '120' } });
		await fireEvent.input(startDateInput, { target: { value: '2026-09-02' } });
		await fireEvent.input(endDateInput, { target: { value: '2027-05-30' } });
		await fireEvent.click(submitBtn);

		// Allow async effects to settle
		await new Promise((r) => setTimeout(r, 50));

		// createSeriesWithEvents must have been called (route handler wires this in GREEN)
		expect(mockCreateSeries).toHaveBeenCalled();
		// After creation, hydrateSeasons (or a re-fetch) must be called to reload rehearsals
		expect(mockHydrate).toHaveBeenCalled();
	});

	it('PartialGenerationError from createSeriesWithEvents shows seasons-notice', async () => {
		mockCreateSeries.mockRejectedValue(new PartialGenerationError('ser1', 1));
		mockHydrate.mockResolvedValue(undefined);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);
		const { container } = render(Page);

		const nameInput = container.querySelector('[data-testid="series-name"]') as HTMLInputElement;
		const intervalInput = container.querySelector(
			'[data-testid="series-interval-days"]',
		) as HTMLInputElement;
		const startTimeInput = container.querySelector(
			'[data-testid="series-start-time"]',
		) as HTMLInputElement;
		const durationInput = container.querySelector(
			'[data-testid="series-duration-minutes"]',
		) as HTMLInputElement;
		const startDateInput = container.querySelector(
			'[data-testid="series-start-date"]',
		) as HTMLInputElement;
		const endDateInput = container.querySelector(
			'[data-testid="series-end-date"]',
		) as HTMLInputElement;
		const submitBtn = container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement;

		await fireEvent.input(nameInput, { target: { value: 'Mon' } });
		await fireEvent.input(intervalInput, { target: { value: '7' } });
		await fireEvent.input(startTimeInput, { target: { value: '18:00' } });
		await fireEvent.input(durationInput, { target: { value: '90' } });
		await fireEvent.input(startDateInput, { target: { value: '2026-09-07' } });
		await fireEvent.input(endDateInput, { target: { value: '2027-05-28' } });
		await fireEvent.click(submitBtn);

		await new Promise((r) => setTimeout(r, 50));

		// seasons-notice must show partial-generation message
		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
	});
});

// (RED-29.1 empty-owner seam tests moved to page.integration.spec.ts — that file
// uses the REAL seasonsStore + REAL hydrateSeasons, mocking only entuSeasons,
// so a future store/route contract drift can't hide behind hand-set state.)

// ── RED: season-create wiring ─────────────────────────────────────────────────

describe('/seasons page — season-create wiring', () => {
	it('SeasonForm oncreate → route calls createSeason with payload + re-hydrates', async () => {
		mockCreateSeason.mockResolvedValue('new-season-id');
		mockHydrate.mockResolvedValue(undefined);
		// Owner with no seasons so SeasonForm is visible (seasons-empty-owner branch)
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set({
			id: 'org1',
			label: 'EFK',
			initials: 'EFK',
			role: 'owner',
		});
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'ready',
			seasons: [],
		});
		const { container } = render(Page);

		// SeasonForm must be visible in the empty-owner branch
		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		expect(nameInput).not.toBeNull();

		const startInput = container.querySelector(
			'[data-testid="season-start-date"]',
		) as HTMLInputElement;
		const endInput = container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement;
		const submitBtn = container.querySelector('[data-testid="season-submit"]') as HTMLButtonElement;

		await fireEvent.input(nameInput, { target: { value: 'Autumn 2026' } });
		await fireEvent.input(startInput, { target: { value: '2026-09-01' } });
		await fireEvent.input(endInput, { target: { value: '2027-05-31' } });
		await fireEvent.click(submitBtn);

		await new Promise((r) => setTimeout(r, 50));

		// createSeason must be called with the payload
		expect(mockCreateSeason).toHaveBeenCalled();
		const callArg = mockCreateSeason.mock.calls[0][1];
		expect(callArg).toMatchObject({ name: 'Autumn 2026' });
		// After create, hydrateSeasons must be called to reload the season list
		expect(mockHydrate).toHaveBeenCalled();
	});
});
