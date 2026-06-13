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
	seasons_form_season_edit_heading: () => 'Edit season',
	seasons_field_name: () => 'Name',
	seasons_field_start_date: () => 'Start date',
	seasons_field_end_date: () => 'End date',
	seasons_field_description: () => 'Description',
	seasons_form_season_submit: () => 'Create',
	seasons_form_season_save: () => 'Save changes',
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

// ── SeasonForm edit mode ──────────────────────────────────────────────────────

describe('SeasonForm — edit mode', () => {
	const existingSeason = {
		id: 'sea1',
		name: 'Autumn 2026',
		startDate: '2026-09-01',
		endDate: '2027-05-31',
		description: 'Our autumn season notes',
	};

	it('renders edit heading when season prop is provided', () => {
		const { container } = render(SeasonForm, { season: existingSeason, onupdate: vi.fn() });
		// Edit heading uses seasons_form_season_edit_heading
		expect(container.textContent).toContain('Edit season');
		// Create heading must NOT appear
		expect(container.textContent).not.toContain('Season'); // not the create heading
	});

	it('fields are pre-filled from the season prop', async () => {
		const { container } = render(SeasonForm, { season: existingSeason, onupdate: vi.fn() });
		// Allow $effect to run
		await new Promise((r) => setTimeout(r, 10));
		expect((container.querySelector('[data-testid="season-name"]') as HTMLInputElement).value).toBe(
			'Autumn 2026',
		);
		expect(
			(container.querySelector('[data-testid="season-start-date"]') as HTMLInputElement).value,
		).toBe('2026-09-01');
		expect(
			(container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement).value,
		).toBe('2027-05-31');
	});

	it('submit button has testid season-form-save (not season-submit)', () => {
		const { container } = render(SeasonForm, { season: existingSeason, onupdate: vi.fn() });
		expect(container.querySelector('[data-testid="season-form-save"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="season-submit"]')).toBeNull();
	});

	it('valid edit submit → calls onupdate with patch, NOT oncreate', async () => {
		const oncreate = vi.fn();
		const onupdate = vi.fn();
		const { container } = render(SeasonForm, { season: existingSeason, oncreate, onupdate });
		await new Promise((r) => setTimeout(r, 10));

		// Change the name
		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: 'Autumn 2026 Updated' } });

		const saveBtn = container.querySelector(
			'[data-testid="season-form-save"]',
		) as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		expect(onupdate).toHaveBeenCalledOnce();
		// Use toEqual (not objectContaining) to catch description being silently wiped
		expect(onupdate).toHaveBeenCalledWith({
			name: 'Autumn 2026 Updated',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			description: 'Our autumn season notes', // must NOT be '' after name-only edit
		});
		expect(oncreate).not.toHaveBeenCalled();
	});

	it('validation still applies in edit mode — blank name → error-name, onupdate not called', async () => {
		const onupdate = vi.fn();
		const { container } = render(SeasonForm, { season: existingSeason, onupdate });
		await new Promise((r) => setTimeout(r, 10));

		// Clear the name
		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '' } });

		const saveBtn = container.querySelector(
			'[data-testid="season-form-save"]',
		) as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		expect(container.querySelector('[data-testid="error-name"]')).not.toBeNull();
		expect(onupdate).not.toHaveBeenCalled();
	});

	it('validation in edit mode — end-before-start → error-end-date, onupdate not called', async () => {
		const onupdate = vi.fn();
		const { container } = render(SeasonForm, { season: existingSeason, onupdate });
		await new Promise((r) => setTimeout(r, 10));

		const endInput = container.querySelector('[data-testid="season-end-date"]') as HTMLInputElement;
		await fireEvent.input(endInput, { target: { value: '2026-08-01' } }); // before start
		const saveBtn = container.querySelector(
			'[data-testid="season-form-save"]',
		) as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		expect(container.querySelector('[data-testid="error-end-date"]')).not.toBeNull();
		expect(onupdate).not.toHaveBeenCalled();
	});

	it('description field pre-filled from season prop (RED-MOB.1)', async () => {
		// Without this: $effect only sets name/start/end; description stays ''
		// and the patch wipes the real description on save.
		const { container } = render(SeasonForm, { season: existingSeason, onupdate: vi.fn() });
		await new Promise((r) => setTimeout(r, 10));
		const descEl = container.querySelector(
			'[data-testid="season-description"]',
		) as HTMLTextAreaElement;
		expect(descEl.value).toBe('Our autumn season notes');
	});

	it('no-clobber: editing name only → patch carries original description (RED-MOB.1)', async () => {
		// This is the exact bug: name-only edit must NOT wipe description to ''.
		const onupdate = vi.fn();
		const { container } = render(SeasonForm, { season: existingSeason, onupdate });
		await new Promise((r) => setTimeout(r, 10));

		// Change only the name; description field stays pre-filled
		const nameInput = container.querySelector('[data-testid="season-name"]') as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: 'New Name' } });
		const saveBtn = container.querySelector(
			'[data-testid="season-form-save"]',
		) as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		const patch = onupdate.mock.calls[0]?.[0];
		// description must be the season's real description, NOT ''
		expect(patch?.description).toBe('Our autumn season notes');
		expect(patch?.description).not.toBe('');
	});
});

// S33 sub-chain 3 — §2 readability conformance
// The form heading and field labels must sit on a colored-background ancestor.
// RED until Byrd wraps <form data-testid="season-form"> in a panel container
// (mirroring ConductorPanel's .panel with background: #fbf9f3).
describe('SeasonForm — readability conformance (S33 §2)', () => {
	it('form heading has a colored-background ancestor (not bare on desk)', () => {
		const { container } = render(SeasonForm, { oncreate: vi.fn() });
		const heading = container.querySelector('h2.form-heading');
		expect(heading).not.toBeNull();
		// Walk ancestors looking for any element with a non-transparent bg class or style
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
		const { container } = render(SeasonForm, { oncreate: vi.fn() });
		// The form must be wrapped in a panel or the form itself carries a bg class
		const panel = container.querySelector('.panel, [data-testid="season-form-panel"]');
		expect(panel).not.toBeNull();
	});
});

// (*MVOX:Tallis*)
