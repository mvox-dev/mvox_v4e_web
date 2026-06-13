// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RsvpTallyBadge from './RsvpTallyBadge.svelte';
import type { RsvpTally } from '$lib/rsvp/rsvpData';

afterEach(cleanup);

const FULL_TALLY: RsvpTally = { going: 12, not_going: 3, maybe: 2, late: 1 };
const ZERO_TALLY: RsvpTally = { going: 0, not_going: 0, maybe: 0, late: 0 };

describe('RsvpTallyBadge (#slice-2b)', () => {
	it('renders the going count in [data-testid="tally-going"]', () => {
		const { container } = render(RsvpTallyBadge, { props: { tally: FULL_TALLY } });
		const el = container.querySelector('[data-testid="tally-going"]');
		expect(el, 'tally-going element should exist').toBeTruthy();
		expect(el!.textContent).toContain('12');
	});

	it('renders the not_going count in [data-testid="tally-not_going"]', () => {
		const { container } = render(RsvpTallyBadge, { props: { tally: FULL_TALLY } });
		const el = container.querySelector('[data-testid="tally-not_going"]');
		expect(el, 'tally-not_going element should exist').toBeTruthy();
		expect(el!.textContent).toContain('3');
	});

	it('renders the maybe count in [data-testid="tally-maybe"]', () => {
		const { container } = render(RsvpTallyBadge, { props: { tally: FULL_TALLY } });
		const el = container.querySelector('[data-testid="tally-maybe"]');
		expect(el, 'tally-maybe element should exist').toBeTruthy();
		expect(el!.textContent).toContain('2');
	});

	it('renders the late count in [data-testid="tally-late"]', () => {
		const { container } = render(RsvpTallyBadge, { props: { tally: FULL_TALLY } });
		const el = container.querySelector('[data-testid="tally-late"]');
		expect(el, 'tally-late element should exist').toBeTruthy();
		expect(el!.textContent).toContain('1');
	});

	it('zero-state: all four counts render 0 (not blank)', () => {
		const { container } = render(RsvpTallyBadge, { props: { tally: ZERO_TALLY } });
		for (const testid of ['tally-going', 'tally-not_going', 'tally-maybe', 'tally-late']) {
			const el = container.querySelector(`[data-testid="${testid}"]`);
			expect(el, `${testid} should exist`).toBeTruthy();
			expect(el!.textContent).toContain('0');
		}
	});
});
