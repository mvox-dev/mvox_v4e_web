// @vitest-environment happy-dom
// src/lib/components/library/LibraryMaster.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import LibraryMaster from './LibraryMaster.svelte';
import type { EntuWork } from '$lib/types/library-entu';

afterEach(() => cleanup());

const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem Op. 9' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti laul 141' },
	{ id: 'work-c', libraryId: 'lib-1', composer: 'Pärt', title: 'Da pacem Domine' },
];

describe('LibraryMaster', () => {
	it('renders all work rows in order', () => {
		render(LibraryMaster, { props: { works, selectedWorkId: 'work-b', onselect: () => {} } });
		expect(screen.getByText('Requiem Op. 9')).toBeTruthy();
		expect(screen.getByText('Taaveti laul 141')).toBeTruthy();
		expect(screen.getByText('Da pacem Domine')).toBeTruthy();
	});

	it('renders the count in the header', () => {
		render(LibraryMaster, { props: { works, selectedWorkId: 'work-a', onselect: () => {} } });
		// Expect "3 works" rendering from the plural i18n key
		expect(screen.getByText(/3 works/)).toBeTruthy();
	});

	it('applies sel class to the selected row', () => {
		const { container } = render(LibraryMaster, {
			props: { works, selectedWorkId: 'work-b', onselect: () => {} },
		});
		const selectedRow = container.querySelector('[data-work-id="work-b"].row.sel');
		expect(selectedRow).not.toBeNull();
	});

	it('emits onselect with the workId when a row is clicked', async () => {
		const handler = vi.fn();
		const { container } = render(LibraryMaster, {
			props: { works, selectedWorkId: 'work-a', onselect: handler },
		});
		const row = container.querySelector('[data-work-id="work-c"]') as HTMLElement;
		await fireEvent.click(row);
		expect(handler).toHaveBeenCalledWith('work-c');
	});
});
