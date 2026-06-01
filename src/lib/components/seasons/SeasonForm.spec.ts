// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeasonForm from './SeasonForm.svelte';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_form_season_heading: () => 'Season',
	seasons_field_name: () => 'Name',
	seasons_field_start_date: () => 'Start date',
	seasons_field_end_date: () => 'End date',
	seasons_field_description: () => 'Description',
	seasons_form_season_submit: () => 'Create',
	seasons_error_blank: () => 'Required',
	seasons_error_end_before_start: () => 'End date must be on or after start date',
}));

afterEach(cleanup);

describe('SeasonForm', () => {
	it('submit with end-before-start → shows error-end-date and keeps name input value', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeasonForm, { oncreate });

		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		const startInput = container.querySelector(
			'[data-testid="season-start-date"]',
		) as HTMLInputElement;
		const endInput = container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement;
		const submit = container.querySelector('[data-testid="season-submit"]') as HTMLButtonElement;

		await fireEvent.input(nameInput, { target: { value: 'Autumn 2026' } });
		await fireEvent.input(startInput, { target: { value: '2026-09-01' } });
		await fireEvent.input(endInput, { target: { value: '2026-08-31' } }); // before start
		await fireEvent.click(submit);

		// Error shown for endDate
		expect(container.querySelector('[data-testid="error-end-date"]')).not.toBeNull();
		// name input value preserved (inputs not cleared on error)
		expect((container.querySelector('[data-testid="season-name"]') as HTMLInputElement).value).toBe(
			'Autumn 2026',
		);
		// oncreate NOT called
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('submit blank name → shows error-name', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeasonForm, { oncreate });

		const startInput = container.querySelector(
			'[data-testid="season-start-date"]',
		) as HTMLInputElement;
		const endInput = container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement;
		const submit = container.querySelector('[data-testid="season-submit"]') as HTMLButtonElement;

		await fireEvent.input(startInput, { target: { value: '2026-09-01' } });
		await fireEvent.input(endInput, { target: { value: '2027-05-31' } });
		// name left blank
		await fireEvent.click(submit);

		expect(container.querySelector('[data-testid="error-name"]')).not.toBeNull();
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('submit valid form → calls oncreate with payload, clears errors', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeasonForm, { oncreate });

		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		const startInput = container.querySelector(
			'[data-testid="season-start-date"]',
		) as HTMLInputElement;
		const endInput = container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement;
		const descInput = container.querySelector(
			'[data-testid="season-description"]',
		) as HTMLTextAreaElement;
		const submit = container.querySelector('[data-testid="season-submit"]') as HTMLButtonElement;

		await fireEvent.input(nameInput, { target: { value: 'Autumn 2026' } });
		await fireEvent.input(startInput, { target: { value: '2026-09-01' } });
		await fireEvent.input(endInput, { target: { value: '2027-05-31' } });
		await fireEvent.input(descInput, { target: { value: 'Our main season' } });
		await fireEvent.click(submit);

		expect(oncreate).toHaveBeenCalledOnce();
		expect(oncreate).toHaveBeenCalledWith({
			name: 'Autumn 2026',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			description: 'Our main season',
		});
		// no error elements visible after valid submit
		expect(container.querySelector('[data-testid="error-name"]')).toBeNull();
		expect(container.querySelector('[data-testid="error-end-date"]')).toBeNull();
	});
});
