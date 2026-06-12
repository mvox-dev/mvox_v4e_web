// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RsvpControl from './RsvpControl.svelte';
import type { RsvpStatus } from '$lib/rsvp/rsvpData';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	rsvp_going: () => 'Going',
	rsvp_not_going: () => 'Not going',
	rsvp_maybe: () => 'Maybe',
	rsvp_late: () => 'Late',
	rsvp_not_member: () => "You're not a member of this choir — RSVP unavailable.",
	rsvp_error: () => "Couldn't save your RSVP. Please try again.",
}));

afterEach(cleanup);

const ALL_STATUSES: RsvpStatus[] = ['going', 'not_going', 'maybe', 'late'];

describe('RsvpControl — 4 buttons', () => {
	it('renders 4 buttons with correct data-testid and label text', () => {
		const { container } = render(RsvpControl, { status: null, disabled: false });
		const expectations: [RsvpStatus, string][] = [
			['going', 'Going'],
			['not_going', 'Not going'],
			['maybe', 'Maybe'],
			['late', 'Late'],
		];
		for (const [s, label] of expectations) {
			const btn = container.querySelector(`[data-testid="rsvp-btn-${s}"]`);
			expect(btn, `button for ${s} must exist`).not.toBeNull();
			expect(btn?.textContent?.trim()).toBe(label);
		}
	});

	it('all 4 buttons present regardless of current status', () => {
		const { container } = render(RsvpControl, { status: 'going', disabled: false });
		for (const s of ALL_STATUSES) {
			expect(container.querySelector(`[data-testid="rsvp-btn-${s}"]`)).not.toBeNull();
		}
	});
});

describe('RsvpControl — active state (aria-pressed)', () => {
	it('active button has aria-pressed="true"; others have aria-pressed="false"', () => {
		const { container } = render(RsvpControl, { status: 'maybe', disabled: false });
		expect(
			container.querySelector('[data-testid="rsvp-btn-maybe"]')?.getAttribute('aria-pressed'),
		).toBe('true');
		for (const s of ALL_STATUSES.filter((x) => x !== 'maybe')) {
			expect(
				container.querySelector(`[data-testid="rsvp-btn-${s}"]`)?.getAttribute('aria-pressed'),
			).toBe('false');
		}
	});

	it('no button is aria-pressed="true" when status is null', () => {
		const { container } = render(RsvpControl, { status: null, disabled: false });
		for (const s of ALL_STATUSES) {
			expect(
				container.querySelector(`[data-testid="rsvp-btn-${s}"]`)?.getAttribute('aria-pressed'),
			).toBe('false');
		}
	});
});

describe('RsvpControl — onchange semantics', () => {
	it('clicking an inactive button calls onchange(status)', async () => {
		const onchange = vi.fn();
		const { container } = render(RsvpControl, { status: null, disabled: false, onchange });
		await fireEvent.click(
			container.querySelector('[data-testid="rsvp-btn-going"]') as HTMLButtonElement,
		);
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith('going');
	});

	it('clicking the currently active button calls onchange(null) — clears the RSVP', async () => {
		const onchange = vi.fn();
		const { container } = render(RsvpControl, { status: 'late', disabled: false, onchange });
		await fireEvent.click(
			container.querySelector('[data-testid="rsvp-btn-late"]') as HTMLButtonElement,
		);
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith(null);
	});

	it('clicking a different status while one is active calls onchange(newStatus)', async () => {
		const onchange = vi.fn();
		const { container } = render(RsvpControl, { status: 'going', disabled: false, onchange });
		await fireEvent.click(
			container.querySelector('[data-testid="rsvp-btn-not_going"]') as HTMLButtonElement,
		);
		expect(onchange).toHaveBeenCalledWith('not_going');
	});
});

describe('RsvpControl — disabled state', () => {
	it('all buttons are disabled when disabled=true', () => {
		const { container } = render(RsvpControl, { status: null, disabled: true });
		for (const s of ALL_STATUSES) {
			const btn = container.querySelector(`[data-testid="rsvp-btn-${s}"]`) as HTMLButtonElement;
			expect(btn?.disabled, `${s} button must be disabled`).toBe(true);
		}
	});

	it('rsvp_not_member hint text rendered when disabled=true', () => {
		const { container } = render(RsvpControl, { status: null, disabled: true });
		expect(container.textContent).toContain(
			"You're not a member of this choir — RSVP unavailable.",
		);
	});

	it('onchange is NOT called when a disabled button is clicked', async () => {
		const onchange = vi.fn();
		const { container } = render(RsvpControl, { status: null, disabled: true, onchange });
		const btn = container.querySelector('[data-testid="rsvp-btn-going"]') as HTMLButtonElement;
		// disabled buttons don't fire click events in happy-dom
		await fireEvent.click(btn);
		expect(onchange).not.toHaveBeenCalled();
	});
});
