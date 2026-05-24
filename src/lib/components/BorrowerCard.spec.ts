// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BorrowerCard from './BorrowerCard.svelte';
import type { Member, Loan } from '$lib/types/library';

describe('BorrowerCard', () => {
	const member: Member = { id: 'hk', name: 'Henn Kuusik', voice: 'B2' };
	const loans: Loan[] = [
		{ copy: '#14', member: 'hk', since: '2025-11-12', days_overdue: 195 },
		{ copy: '#15', member: 'hk', since: '2025-11-12', days_overdue: 195 },
	];

	it('renders avatar initials + name + voice + copies + days', () => {
		const { container } = render(BorrowerCard, { props: { member, loans } });
		expect(container.textContent).toContain('HK');
		expect(container.textContent).toContain('Henn Kuusik');
		expect(container.textContent).toContain('B2');
		expect(container.textContent).toContain('#14');
		expect(container.textContent).toContain('#15');
		expect(container.textContent).toContain('195');
	});
});
