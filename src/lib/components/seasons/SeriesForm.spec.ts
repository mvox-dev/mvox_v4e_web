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
	seasons_warning_outside_season: () => 'Dates are outside the season range.',
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

	it('outside-season dates → series-season-warning shown AND oncreate still fires (soft warn, not hard block)', async () => {
		// PO decision: outside-season dates are a non-blocking warning. Submit must succeed.
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container, { startDate: '2026-08-01', endDate: '2027-06-30' }); // both outside
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		// Warning shown (not an error — no hard block)
		expect(container.querySelector('[data-testid="series-season-warning"]')).not.toBeNull();
		// Submit still fires — outside-season is NOT a hard validation error
		expect(oncreate).toHaveBeenCalledOnce();
		// Hard error elements must NOT be shown
		expect(container.querySelector('[data-testid="error-start-date"]')).toBeNull();
		expect(container.querySelector('[data-testid="error-end-date"]')).toBeNull();
	});

	it('in-range dates → no series-season-warning', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, { season, oncreate });

		await fillForm(container); // default dates are within season
		await fireEvent.click(
			container.querySelector('[data-testid="series-submit"]') as HTMLButtonElement,
		);

		expect(container.querySelector('[data-testid="series-season-warning"]')).toBeNull();
		expect(oncreate).toHaveBeenCalledOnce();
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

// S33 sub-chain 3 — §2 readability conformance
// SeriesForm heading + field labels must sit on a colored-background ancestor.
// RED until Byrd wraps <form data-testid="series-form"> in a panel container.
describe('SeriesForm — readability conformance (S33 §2)', () => {
	it('form heading has a colored-background ancestor (not bare on desk)', () => {
		const oncreate = vi.fn();
		const { container } = render(SeriesForm, {
			season,
			oncreate,
		});
		const heading = container.querySelector('h2.form-heading');
		expect(heading).not.toBeNull();
		let el = heading?.parentElement;
		let hasColoredBg = false;
		while (el && el !== container) {
			const cls = el.className ?? '';
			const style = el.getAttribute('style') ?? '';
			if (cls.includes('bg-') || style.includes('background') || cls.includes('panel')) {
				hasColoredBg = true;
				break;
			}
			el = el.parentElement;
		}
		expect(hasColoredBg).toBe(true);
	});

	it('form root has a panel container (data-testid or class)', () => {
		const { container } = render(SeriesForm, { season, oncreate: vi.fn() });
		const panel = container.querySelector('.panel, [data-testid="series-form-panel"]');
		expect(panel).not.toBeNull();
	});
});

// (*MVOX:Tallis*)
