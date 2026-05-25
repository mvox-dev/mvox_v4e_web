// @vitest-environment happy-dom
// src/lib/components/library/LibraryEditionCard.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import LibraryEditionCard from './LibraryEditionCard.svelte';
import type { EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const edition: EntuEdition = {
	id: 'ed-1',
	workId: 'work-a',
	label: 'Peters · full score',
	year: 1991,
	publisher: 'Peters',
	isbn: 'EP-8421',
};

describe('LibraryEditionCard', () => {
	it('renders the label as the title', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('Peters · full score')).toBeTruthy();
	});

	it('renders year in mono', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('1991')).toBeTruthy();
	});

	it('renders ISBN if present', () => {
		render(LibraryEditionCard, { props: { edition } });
		expect(screen.getByText('EP-8421')).toBeTruthy();
	});

	it('omits ISBN row when ISBN is missing', () => {
		const noIsbn = { ...edition, isbn: undefined };
		render(LibraryEditionCard, { props: { edition: noIsbn } });
		expect(screen.queryByText('EP-8421')).toBeNull();
	});
});
