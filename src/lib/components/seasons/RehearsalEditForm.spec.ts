// @vitest-environment happy-dom
// RED (#87): RehearsalEditForm — inline edit form for a single rehearsal.
// House style: {#if} inline form block, NO modal — mirrors SeasonForm.svelte.
// Byrd creates the component; these tests are RED until GREEN.
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RehearsalEditForm from './RehearsalEditForm.svelte';
import type { Rehearsal } from '$lib/seasons/types';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_form_rehearsal_edit_heading: () => 'Edit rehearsal',
	seasons_field_start_date: () => 'Start date',
	seasons_field_duration: () => 'Duration (minutes)',
	seasons_field_location: () => 'Location',
	seasons_field_description: () => 'Notes',
	seasons_form_season_save: () => 'Save changes',
	seasons_actions_edit: () => 'Edit',
	// cancel button rendered when oncancel prop is provided
	actions_cancel: () => 'Cancel',
}));

afterEach(cleanup);

const sampleRehearsal: Rehearsal = {
	id: 'r1',
	seriesId: 'ser1',
	startDatetime: '2026-09-01T16:00:00.000Z',
	durationMinutes: 90,
	location: 'Church Hall',
	description: 'Bring scores',
tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
};

describe('RehearsalEditForm — pre-population (#87)', () => {
	it('renders heading with text from seasons_form_rehearsal_edit_heading (YELLOW-87.1)', () => {
		// Mirrors SeasonForm edit-heading pattern. Heading must be present and
		// show the "Edit rehearsal" string so the user knows what they are editing.
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		const heading = container.querySelector('[data-testid="rehearsal-edit-heading"]');
		expect(heading).not.toBeNull();
		expect(heading?.textContent?.trim()).toBe('Edit rehearsal');
	});

	it('renders start_datetime field pre-filled from rehearsal prop', () => {
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		const input = container.querySelector(
			'[data-testid="rehearsal-edit-start-datetime"]',
		) as HTMLInputElement;
		expect(input).not.toBeNull();
		// Pre-filled from rehearsal.startDatetime
		expect(input.value).toBeTruthy();
	});

	it('renders duration_minutes field pre-filled from rehearsal prop', () => {
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		const input = container.querySelector(
			'[data-testid="rehearsal-edit-duration"]',
		) as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(Number(input.value)).toBe(90);
	});

	it('renders location field pre-filled from rehearsal prop', () => {
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		const input = container.querySelector(
			'[data-testid="rehearsal-edit-location"]',
		) as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.value).toBe('Church Hall');
	});

	it('renders description field pre-filled from rehearsal prop', () => {
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		const input = container.querySelector(
			'[data-testid="rehearsal-edit-description"]',
		) as HTMLInputElement | HTMLTextAreaElement | null;
		expect(input).not.toBeNull();
		expect(input?.value).toBe('Bring scores');
	});

	it('renders a save/submit button', () => {
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave: vi.fn(),
		});
		expect(
			container.querySelector('[data-testid="rehearsal-edit-save"]'),
		).not.toBeNull();
	});
});

describe('RehearsalEditForm — dirty tracking / onsave patch (#87)', () => {
	it('changing only start_datetime: onsave patch contains ONLY start_datetime', async () => {
		// Dirty tracking: only changed fields appear in the emitted patch.
		// Editing only start_time must NOT carry description/location/duration.
		const onsave = vi.fn();
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave,
		});

		const dtInput = container.querySelector(
			'[data-testid="rehearsal-edit-start-datetime"]',
		) as HTMLInputElement;
		const saveBtn = container.querySelector(
			'[data-testid="rehearsal-edit-save"]',
		) as HTMLButtonElement;

		// Change only the start datetime
		await fireEvent.input(dtInput, { target: { value: '2026-09-08T16:00:00.000Z' } });
		await fireEvent.click(saveBtn);

		expect(onsave).toHaveBeenCalledOnce();
		const patch = onsave.mock.calls[0][0] as Record<string, unknown>;
		// REGRESSION GUARD (session-29 description-wipe class of bug):
		// patching only start_datetime must NOT wipe description or location.
		expect(patch).toHaveProperty('start_datetime');
		expect(patch).not.toHaveProperty('description');
		expect(patch).not.toHaveProperty('location');
		expect(patch).not.toHaveProperty('duration_minutes');
	});

	it('changing only location: onsave patch contains ONLY location', async () => {
		const onsave = vi.fn();
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave,
		});

		const locInput = container.querySelector(
			'[data-testid="rehearsal-edit-location"]',
		) as HTMLInputElement;
		const saveBtn = container.querySelector(
			'[data-testid="rehearsal-edit-save"]',
		) as HTMLButtonElement;

		await fireEvent.input(locInput, { target: { value: 'New Room' } });
		await fireEvent.click(saveBtn);

		expect(onsave).toHaveBeenCalledOnce();
		const patch = onsave.mock.calls[0][0] as Record<string, unknown>;
		expect(patch).toHaveProperty('location', 'New Room');
		expect(patch).not.toHaveProperty('start_datetime');
		expect(patch).not.toHaveProperty('description');
		expect(patch).not.toHaveProperty('duration_minutes');
	});

	it('submitting with nothing changed: onsave called with empty/no-op patch', async () => {
		// No changes → patch should be empty (no fields), or onsave called with {}.
		const onsave = vi.fn();
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave,
		});

		const saveBtn = container.querySelector(
			'[data-testid="rehearsal-edit-save"]',
		) as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		expect(onsave).toHaveBeenCalledOnce();
		const patch = onsave.mock.calls[0][0] as Record<string, unknown>;
		// Patch must not include any of the original fields (nothing changed)
		expect(Object.keys(patch)).toHaveLength(0);
	});

	it('changing multiple fields: patch contains exactly those fields', async () => {
		const onsave = vi.fn();
		const { container } = render(RehearsalEditForm, {
			rehearsal: sampleRehearsal,
			onsave,
		});

		const locInput = container.querySelector(
			'[data-testid="rehearsal-edit-location"]',
		) as HTMLInputElement;
		const descInput = container.querySelector(
			'[data-testid="rehearsal-edit-description"]',
		) as HTMLInputElement | HTMLTextAreaElement;
		const saveBtn = container.querySelector(
			'[data-testid="rehearsal-edit-save"]',
		) as HTMLButtonElement;

		await fireEvent.input(locInput, { target: { value: 'Updated Hall' } });
		await fireEvent.input(descInput, { target: { value: 'Updated notes' } });
		await fireEvent.click(saveBtn);

		expect(onsave).toHaveBeenCalledOnce();
		const patch = onsave.mock.calls[0][0] as Record<string, unknown>;
		expect(patch).toHaveProperty('location', 'Updated Hall');
		expect(patch).toHaveProperty('description', 'Updated notes');
		expect(patch).not.toHaveProperty('start_datetime');
		expect(patch).not.toHaveProperty('duration_minutes');
	});
});
