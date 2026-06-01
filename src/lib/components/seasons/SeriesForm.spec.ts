// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeriesForm from './SeriesForm.svelte';
import type { Season } from '$lib/seasons/types';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_form_series_heading: () => 'New rehearsal series',
	seasons_field_name: () => 'Name',
	seasons_field_interval_days: () => 'Repeat every (days)',
	seasons_field_start_time: () => 'Start time',
	seasons_field_duration: () => 'Duration (minutes)',
	seasons_field_start_date: () => 'Start date',
	seasons_field_end_date: () => 'End date',
	seasons_field_location: () => 'Location',
	seasons_form_series_submit: () => 'Create series',
	seasons_error_blank: () => 'Required',
	seasons_error_interval_too_small: () => 'Must be at least 1 day',
	seasons_error_duration_too_small: () => 'Must be at least 1 minute',
	seasons_error_outside_season: () => "Must fall within the season's dates",
}));

afterEach(cleanup);

const season: Season = {
	id: 'sea1',
	name: 'Autumn 2026',
	startDate: '2026-09-01',
	endDate: '2027-05-31',
};

/** Fill all required fields with valid values, optionally overriding some. */
async function fillForm(
	container: Element,
	overrides: Partial<{
		name: string;
		intervalDays: string;
		startTime: string;
		durationMinutes: string;
		startDate: string;
		endDate: string;
	}> = {},
): Promise<void> {
	const vals = {
		name: 'Tue evening',
		intervalDays: '7',
		startTime: '19:00',
		durationMinutes: '120',
		startDate: '2026-09-02',
		endDate: '2027-05-30',
		...overrides,
	};
	await fireEvent.input(
		container.querySelector('[data-testid="series-name"]') as HTMLInputElement,
		{ target: { value: vals.name } },
	);
	await fireEvent.input(
		container.querySelector('[data-testid="series-interval-days"]') as HTMLInputElement,
		{ target: { value: vals.intervalDays } },
	);
	await fireEvent.input(
		container.querySelector('[data-testid="series-start-time"]') as HTMLInputElement,
		{ target: { value: vals.startTime } },
	);
	await fireEvent.input(
		container.querySelector('[data-testid="series-duration-minutes"]') as HTMLInputElement,
		{ target: { value: vals.durationMinutes } },
	);
	await fireEvent.input(
		container.querySelector('[data-testid="series-start-date"]') as HTMLInputElement,
		{ target: { value: vals.startDate } },
	);
	await fireEvent.input(
		container.querySelector('[data-testid="series-end-date"]') as HTMLInputElement,
		{ target: { value: vals.endDate } },
	);
}

describe('SeriesForm', () => {
	it('submit with intervalDays=0 → shows error-interval-days, oncreate not called', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { intervalDays: '0' });
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(container.querySelector('[data-testid="error-interval-days"]')).not.toBeNull();
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('submit with durationMinutes=0 → shows error-duration-minutes, oncreate not called', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { durationMinutes: '0' });
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(container.querySelector('[data-testid="error-duration-minutes"]')).not.toBeNull();
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('series startDate before season start → shows error-start-date (outside_season)', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { startDate: '2026-08-01' }); // before 2026-09-01
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(container.querySelector('[data-testid="error-start-date"]')).not.toBeNull();
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('series endDate after season end → shows error-end-date (outside_season)', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { endDate: '2027-06-30' }); // after 2027-05-31
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(container.querySelector('[data-testid="error-end-date"]')).not.toBeNull();
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('submit valid → calls oncreate with full payload including event_type: rehearsal', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container);
		await fireEvent.input(
			container.querySelector('[data-testid="series-location"]') as HTMLInputElement,
			{ target: { value: 'Church Hall' } },
		);
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(oncreate).toHaveBeenCalledOnce();
		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Tue evening',
				intervalDays: 7,
				startTime: '19:00',
				durationMinutes: 120,
				startDate: '2026-09-02',
				endDate: '2027-05-30',
				location: 'Church Hall',
			}),
		);
		// event_type must be fixed to 'rehearsal' — not a user-facing field (plan Task 13)
		expect(oncreate.mock.calls[0][0]).toHaveProperty('event_type', 'rehearsal');
	});

	it('inputs are preserved on validation error (not cleared)', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { intervalDays: '0' }); // triggers error
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		// name input must still hold its value after failed submit
		expect((container.querySelector('[data-testid="series-name"]') as HTMLInputElement).value).toBe(
			'Tue evening',
		);
	});
});
