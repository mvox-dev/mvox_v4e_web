// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MiniWorkCard from './MiniWorkCard.svelte';
import type { Work } from '$lib/types/library';

const w: Work = {
	id: 'tallis-spem',
	composer: 'Thomas Tallis',
	title: 'Spem in alium',
	year: 1570,
	lang: 'Latin',
	period: 'Renaissance',
	tags: [],
	editions: [
		{
			id: 'tallis-40',
			label: '40-part',
			voicing: '40-v',
			publisher: 'CN',
			year: 1928,
			total: 12,
			on_loan: 0,
			overdue: 0,
			returned_today: 0,
		},
	],
};

describe('MiniWorkCard', () => {
	it('renders composer, title, voicing, stats', () => {
		const { container } = render(MiniWorkCard, { props: { work: w } });
		expect(container.textContent).toContain('Thomas Tallis');
		expect(container.textContent).toContain('Spem in alium');
		expect(container.textContent).toContain('40-v');
		expect(container.textContent).toContain('12/12');
	});

	it('shows overdue indicator when pinnedTone="overdue"', () => {
		const overdue: Work = { ...w, editions: [{ ...w.editions[0], on_loan: 4, overdue: 4 }] };
		const { container } = render(MiniWorkCard, { props: { work: overdue, pinnedTone: 'overdue' } });
		const card = container.querySelector('[data-card]');
		expect(card?.className).toMatch(/border-t-\[3px\]|border-red/);
	});
});
