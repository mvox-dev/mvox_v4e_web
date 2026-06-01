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
	seasons_actions_edit: () => 'Edit',
	seasons_confirm_cancel_rehearsal_body: () => 'Cancel this rehearsal?',
	seasons_confirm_delete_series_body: () => 'Delete this series and its rehearsals?',
	seasons_empty_no_rehearsals: () => 'No rehearsals scheduled yet.',
	seasons_empty_no_rehearsals_cta: () => 'Create a rehearsal series',
	seasons_notice_partial_generate: () => 'Some rehearsals could not be created.',
	seasons_notice_partial_delete: () => 'Some rehearsals could not be deleted.',
	seasons_notice_assign_not_member: () => 'That person is not an org member.',
	seasons_notice_delete_forbidden: () => 'You do not have permission to delete this.',
	seasons_notice_create_failed: () => 'Could not create season. Please try again.',
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
		listSeries: vi.fn(),
		listConductors: vi.fn(),
		listOrgMembers: vi.fn(),
		assignConductor: vi.fn(),
		revokeConductor: vi.fn(),
		deleteRehearsal: vi.fn(),
		deleteSeriesCascade: vi.fn(),
	};
});

import { seasonsStore, hydrateSeasons } from '$lib/seasons/seasonsStore';
import { selectedOrgStore } from '$lib/auth/userStore';
import {
	createSeriesWithEvents,
	createSeason,
	listSeasons,
	listRehearsals,
	listSeries,
	listConductors,
	listOrgMembers,
	assignConductor,
	revokeConductor,
	deleteRehearsal,
	deleteSeriesCascade,
	DeleteForbiddenError,
	PartialGenerationError,
} from '$lib/seasons/entuSeasons';

const mockHydrate = vi.mocked(hydrateSeasons);
const mockCreateSeries = vi.mocked(createSeriesWithEvents);
const mockCreateSeason = vi.mocked(createSeason);
const mockListSeasons = vi.mocked(listSeasons);
const mockListRehearsals = vi.mocked(listRehearsals);
const mockListSeries = vi.mocked(listSeries);
const mockListConductors = vi.mocked(listConductors);
const mockListOrgMembers = vi.mocked(listOrgMembers);
const mockAssignConductor = vi.mocked(assignConductor);
const mockRevokeConductor = vi.mocked(revokeConductor);
const mockDeleteRehearsal = vi.mocked(deleteRehearsal);
const mockDeleteSeriesCascade = vi.mocked(deleteSeriesCascade);

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

// ── T2: conductor route wiring (#86) ─────────────────────────────────────────
// The route is expected to: on season-select (owner), load conductors via
// listConductors + org members via listOrgMembers; wire onassign → assignConductor
// + re-fetch; onremove → revokeConductor + re-fetch; surface membership-pairing
// error as a notice.

describe('/seasons page — conductor wiring (T2, #86)', () => {
	const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };

	beforeEach(() => {
		// Default: conductor list + org members return empty unless overridden
		mockListConductors.mockResolvedValue([]);
		mockListOrgMembers.mockResolvedValue([]);
		mockAssignConductor.mockResolvedValue(undefined);
		mockRevokeConductor.mockResolvedValue(undefined);
		mockHydrate.mockResolvedValue(undefined);
	});

	it('ConductorPanel receives conductor list from listConductors when season is selected', async () => {
		mockListConductors.mockResolvedValue([
			{ personId: 'p1', name: 'Jane C.', propertyValueId: 'pv-1' },
		]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// ConductorPanel should show Jane C. in the conductors list
		const panelWrap = container.querySelector('[data-testid="conductor-panel-wrap"]');
		expect(panelWrap).not.toBeNull();
		expect(panelWrap?.textContent).toContain('Jane C.');
	});

	it('ConductorPanel picker receives org members from listOrgMembers', async () => {
		mockListOrgMembers.mockResolvedValue([
			{ personId: 'p2', name: 'Bob D.' },
			{ personId: 'p3', name: 'Carol E.' },
		]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// Picker options should include the org member names
		const select = container.querySelector(
			'[data-testid="conductor-picker-select"]',
		) as HTMLSelectElement;
		expect(select).not.toBeNull();
		const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
		expect(options).toContain('Bob D.');
		expect(options).toContain('Carol E.');
	});

	it('onassign → calls assignConductor with seasonId + orgId + personId, then re-fetches conductors', async () => {
		mockListOrgMembers.mockResolvedValue([{ personId: 'p2', name: 'Bob D.' }]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// Select a member and click assign
		const select = container.querySelector(
			'[data-testid="conductor-picker-select"]',
		) as HTMLSelectElement;
		const assignBtn = container.querySelector(
			'[data-testid="conductor-assign"]',
		) as HTMLButtonElement;
		expect(select).not.toBeNull();
		await fireEvent.change(select, { target: { value: 'p2' } });
		await fireEvent.click(assignBtn);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockAssignConductor).toHaveBeenCalledOnce();
		expect(mockAssignConductor.mock.calls[0][1]).toMatchObject({
			seasonId: 'sea1',
			orgId: 'org1',
			personId: 'p2',
		});
		// After assign, listConductors must be re-fetched
		expect(mockListConductors).toHaveBeenCalled();
	});

	it('onremove → calls revokeConductor with propertyValueId, then re-fetches conductors', async () => {
		mockListConductors.mockResolvedValue([
			{ personId: 'p1', name: 'Jane C.', propertyValueId: 'pv-1' },
		]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const removeBtn = container.querySelector(
			'[data-testid="conductor-remove"]',
		) as HTMLButtonElement;
		expect(removeBtn).not.toBeNull();
		await fireEvent.click(removeBtn);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockRevokeConductor).toHaveBeenCalledOnce();
		expect(mockRevokeConductor.mock.calls[0][1]).toMatchObject({ propertyValueId: 'pv-1' });
		// After revoke, listConductors must be re-fetched
		expect(mockListConductors).toHaveBeenCalled();
	});

	it('assignConductor membership-pairing failure → seasons-notice shown (no crash)', async () => {
		mockAssignConductor.mockRejectedValue(new Error('must be an org member first'));
		mockListOrgMembers.mockResolvedValue([{ personId: 'p9', name: 'NonMember' }]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const select = container.querySelector(
			'[data-testid="conductor-picker-select"]',
		) as HTMLSelectElement;
		const assignBtn = container.querySelector(
			'[data-testid="conductor-assign"]',
		) as HTMLButtonElement;
		await fireEvent.change(select, { target: { value: 'p9' } });
		await fireEvent.click(assignBtn);
		await new Promise((r) => setTimeout(r, 50));

		// Must show a notice rather than crashing
		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
	});
});

// ── T3: read-path — route loads rehearsals + series (#86, fixes #82) ─────────
// The route currently never calls listRehearsals or listSeries, so RehearsalList
// is always empty and seriesNames never built. These tests drive the route's
// reactive effect and assert the rendered list reflects mocked returns.

describe('/seasons page — read-path (T3, #86)', () => {
	const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };

	beforeEach(() => {
		mockListRehearsals.mockResolvedValue([]);
		mockListSeries.mockResolvedValue([]);
		mockListConductors.mockResolvedValue([]);
		mockListOrgMembers.mockResolvedValue([]);
		mockHydrate.mockResolvedValue(undefined);
	});

	it('route calls listRehearsals when season is selected and renders rehearsal rows', async () => {
		mockListRehearsals.mockResolvedValue([
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			},
		]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// listRehearsals must have been called (route effect wires this in GREEN)
		expect(mockListRehearsals).toHaveBeenCalled();
		// A rehearsal row must appear in the list
		expect(container.querySelector('[data-testid="rehearsal-row"]')).not.toBeNull();
	});

	it('route calls listSeries and builds seriesNames Map for group headers', async () => {
		mockListSeries.mockResolvedValue([
			{
				id: 'ser1',
				name: 'Tuesday Evening',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 90,
				startDate: '2026-09-02',
				endDate: '2027-05-30',
			},
		]);
		mockListRehearsals.mockResolvedValue([
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			},
		]);
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockListSeries).toHaveBeenCalled();
		// Group header must appear with the series name
		expect(container.querySelector('[data-testid="rehearsal-group-header"]')).not.toBeNull();
		expect(container.textContent).toContain('Tuesday Evening');
	});

	it('listRehearsals is called with orgId + seasonId from the selected season', async () => {
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		render(Page);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockListRehearsals).toHaveBeenCalled();
		// The call args must include orgId and the selected seasonId
		const callArg = mockListRehearsals.mock.calls[0][1];
		expect(callArg).toMatchObject({ orgId: 'org1', seasonId: 'sea1' });
	});

	it('after SeriesForm create, route polls listRehearsals until rehearsal count increases', async () => {
		// First call to listRehearsals returns empty (before events propagate).
		// Second call returns the new rehearsal (P0.6 retry window).
		let callCount = 0;
		mockListRehearsals.mockImplementation(async () => {
			callCount++;
			if (callCount === 1) return [];
			return [
				{
					id: 'r1',
					seriesId: 'ser1',
					startDatetime: '2026-09-01T16:00:00.000Z',
					durationMinutes: 90,
				},
			];
		});
		mockCreateSeries.mockResolvedValue({ seriesId: 'ser1', eventIds: ['r1'] });
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// Submit the SeriesForm
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
		await fireEvent.input(durationInput, { target: { value: '90' } });
		await fireEvent.input(startDateInput, { target: { value: '2026-09-02' } });
		await fireEvent.input(endDateInput, { target: { value: '2027-05-30' } });
		await fireEvent.click(submitBtn);

		// Allow the create + retry poll to settle (up to 3s retry window in impl)
		await new Promise((r) => setTimeout(r, 200));

		// listRehearsals must have been called more than once (initial load + retry after create)
		expect(mockListRehearsals.mock.calls.length).toBeGreaterThan(1);
		// The rehearsal row must eventually appear
		expect(container.querySelector('[data-testid="rehearsal-row"]')).not.toBeNull();
	});
});

// ── T4: cancel-rehearsal wiring (#86) ─────────────────────────────────────────

describe('/seasons page — cancel-rehearsal wiring (T4, #86)', () => {
	const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };
	const rehearsal = {
		id: 'r1',
		seriesId: 'ser1',
		startDatetime: '2026-09-01T16:00:00.000Z',
		durationMinutes: 90,
	};

	beforeEach(() => {
		// RehearsalList now gates cancel with window.confirm — stub to return true
		// so these integration tests exercise the full delete path (not the guard).
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		// First listRehearsals call returns one row; after delete, returns empty.
		let callCount = 0;
		mockListRehearsals.mockImplementation(async () => {
			callCount++;
			return callCount === 1 ? [rehearsal] : [];
		});
		mockListSeries.mockResolvedValue([]);
		mockListConductors.mockResolvedValue([]);
		mockListOrgMembers.mockResolvedValue([]);
		mockDeleteRehearsal.mockResolvedValue(undefined);
		mockHydrate.mockResolvedValue(undefined);
	});

	it('oncancel → calls deleteRehearsal with rehearsalId, then re-loads listRehearsals', async () => {
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// Rehearsal row must be present after initial load
		const cancelBtn = container.querySelector(
			'[data-testid="rehearsal-cancel"]',
		) as HTMLButtonElement;
		expect(cancelBtn).not.toBeNull();

		await fireEvent.click(cancelBtn);
		await new Promise((r) => setTimeout(r, 50));

		// deleteRehearsal must have been called with the correct rehearsal id
		expect(mockDeleteRehearsal).toHaveBeenCalledOnce();
		expect(mockDeleteRehearsal.mock.calls[0][1]).toBe('r1');
		// listRehearsals must be re-called after delete (reload)
		expect(mockListRehearsals.mock.calls.length).toBeGreaterThan(1);
	});

	it('DeleteForbiddenError from deleteRehearsal → seasons-notice shown, row stays', async () => {
		mockDeleteRehearsal.mockRejectedValue(new DeleteForbiddenError('r1'));
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const cancelBtn = container.querySelector(
			'[data-testid="rehearsal-cancel"]',
		) as HTMLButtonElement;
		expect(cancelBtn).not.toBeNull();

		await fireEvent.click(cancelBtn);
		await new Promise((r) => setTimeout(r, 50));

		// Notice must appear — the route catches DeleteForbiddenError and sets notice
		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
		// The row must still be present (delete failed, row not removed)
		expect(container.querySelector('[data-testid="rehearsal-row"]')).not.toBeNull();
	});
});

// ── T5: delete-series route wiring (#86) ─────────────────────────────────────

describe('/seasons page — delete-series wiring (T5, #86)', () => {
	const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };
	const rehearsal = {
		id: 'r1',
		seriesId: 'ser1',
		startDatetime: '2026-09-01T16:00:00.000Z',
		durationMinutes: 90,
	};
	const series = {
		id: 'ser1',
		name: 'Tuesday Evening',
		intervalDays: 7,
		startTime: '19:00',
		durationMinutes: 90,
		startDate: '2026-09-02',
		endDate: '2027-05-30',
	};

	beforeEach(() => {
		// series-delete now gates with window.confirm — stub to return true so
		// integration tests exercise the full cascade path.
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		mockListRehearsals.mockResolvedValue([rehearsal]);
		mockListSeries.mockResolvedValue([series]);
		mockListConductors.mockResolvedValue([]);
		mockListOrgMembers.mockResolvedValue([]);
		mockDeleteSeriesCascade.mockResolvedValue({ deleted: 1, seriesDeleted: true });
		mockHydrate.mockResolvedValue(undefined);
	});

	it('ondeleteseries → deleteSeriesCascade called with seriesId, then re-loads', async () => {
		// After cascade delete: return empty lists
		mockDeleteSeriesCascade.mockResolvedValue({ deleted: 1, seriesDeleted: true });
		mockListRehearsals
			.mockResolvedValueOnce([rehearsal]) // initial load
			.mockResolvedValue([]); // post-delete reload
		mockListSeries
			.mockResolvedValueOnce([series]) // initial load
			.mockResolvedValue([]); // post-delete reload

		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		// series-delete button must be present (canManage=true for owner)
		const deleteSeriesBtn = container.querySelector(
			'[data-testid="series-delete"]',
		) as HTMLButtonElement;
		expect(deleteSeriesBtn).not.toBeNull();

		await fireEvent.click(deleteSeriesBtn);
		await new Promise((r) => setTimeout(r, 50));

		// deleteSeriesCascade must be called with the series id
		expect(mockDeleteSeriesCascade).toHaveBeenCalledOnce();
		expect(mockDeleteSeriesCascade.mock.calls[0][1]).toBe('ser1');
		// listRehearsals + listSeries must be re-fetched after cascade
		expect(mockListRehearsals.mock.calls.length).toBeGreaterThan(1);
	});

	it('partial result {seriesDeleted:false} → seasons-notice shows partial-delete message', async () => {
		mockDeleteSeriesCascade.mockResolvedValue({ deleted: 1, seriesDeleted: false });
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const deleteSeriesBtn = container.querySelector(
			'[data-testid="series-delete"]',
		) as HTMLButtonElement;
		expect(deleteSeriesBtn).not.toBeNull();
		await fireEvent.click(deleteSeriesBtn);
		await new Promise((r) => setTimeout(r, 50));

		// Partial result must surface as a notice
		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
	});

	it('DeleteForbiddenError from deleteSeriesCascade → seasons-notice shown', async () => {
		mockDeleteSeriesCascade.mockRejectedValue(new DeleteForbiddenError('ser1'));
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set(readySeasonsState);

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const deleteSeriesBtn = container.querySelector(
			'[data-testid="series-delete"]',
		) as HTMLButtonElement;
		expect(deleteSeriesBtn).not.toBeNull();
		await fireEvent.click(deleteSeriesBtn);
		await new Promise((r) => setTimeout(r, 50));

		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
	});
});

// ── Season-create error/feedback (fix/seasons-create-wire) ───────────────────

describe('/seasons page — season-create error handling (fix)', () => {
	const ownerOrg = { id: 'org1', label: 'EFK', initials: 'EFK', role: 'owner' };

	beforeEach(() => {
		mockListRehearsals.mockResolvedValue([]);
		mockListSeries.mockResolvedValue([]);
		mockListConductors.mockResolvedValue([]);
		mockListOrgMembers.mockResolvedValue([]);
		mockHydrate.mockResolvedValue(undefined);
	});

	it('createSeason reject → seasons-notice shown, no unhandled rejection', async () => {
		mockCreateSeason.mockRejectedValue(new Error('400 entity create failed'));
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'ready',
			seasons: [],
		});

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
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

		expect(container.querySelector('[data-testid="seasons-notice"]')).not.toBeNull();
	});

	it('createSeason success → goto called with the new season id (auto-selection)', async () => {
		const { goto } = await import('$app/navigation');
		const mockGoto = vi.mocked(goto);

		mockCreateSeason.mockResolvedValue('new-sea-id');
		(selectedOrgStore as ReturnType<typeof import('svelte/store').writable>).set(ownerOrg);
		(seasonsStore as ReturnType<typeof import('svelte/store').writable>).set({
			status: 'ready',
			seasons: [],
		});

		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 50));

		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
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

		// goto must be called with a URL containing the new season id (auto-selection)
		expect(mockGoto).toHaveBeenCalled();
		const lastCall = mockGoto.mock.calls[mockGoto.mock.calls.length - 1][0] as string;
		expect(lastCall).toContain('new-sea-id');
	});
});
