// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PullItemCard from './PullItemCard.svelte';
import type { Work } from '$lib/types/library';

const tormis: Work = {
	id: 'tormis-raua',
	composer: 'Veljo Tormis',
	title: 'Raua needmine',
	title_alt: 'Curse upon Iron',
	year: 1972,
	lang: 'Estonian',
	period: 'Contemporary',
	tags: [],
	editions: [
		{
			id: 'raua-fg',
			label: 'Fennica Gehrman',
			voicing: 'SATB · drum',
			publisher: 'FG',
			year: 1991,
			total: 52,
			on_loan: 0,
			overdue: 0,
			returned_today: 0,
		},
	],
};

describe('PullItemCard', () => {
	it('renders composer, title, alt-title, and to-pull count', () => {
		const { container } = render(PullItemCard, {
			props: { work: tormis, edition: tormis.editions[0], pulled: 0, needed: 48 },
		});
		expect(container.textContent).toContain('Veljo Tormis');
		expect(container.textContent).toContain('Raua needmine');
		expect(container.textContent).toContain('Curse upon Iron');
		expect(container.textContent).toContain('48');
		expect(container.textContent).toContain('to pull');
	});

	it('renders done state when pulled >= needed', () => {
		const { container } = render(PullItemCard, {
			props: { work: tormis, edition: tormis.editions[0], pulled: 48, needed: 48 },
		});
		expect(container.textContent).toContain('pulled');
		expect(container.textContent).toContain('on the desk');
	});
});
