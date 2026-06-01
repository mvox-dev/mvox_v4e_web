// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeasonBar from './SeasonBar.svelte';
import type { Season } from '$lib/seasons/types';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_a11y_edit_season: () => 'Edit selected season',
	seasons_a11y_create_season: () => 'Create season',
}));

afterEach(cleanup);

const seasons: Season[] = [
	{ id: 'sea1', name: 'Autumn 2026', startDate: '2026-09-01', endDate: '2027-05-31' },
	{ id: 'sea2', name: 'Spring 2027', startDate: '2027-01-01', endDate: '2027-06-30' },
];

describe('SeasonBar', () => {
	it('renders one season-tag per season with correct data-season-id', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: false,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		const tags = container.querySelectorAll('[data-testid="season-tag"]');
		expect(tags).toHaveLength(2);
		const ids = Array.from(tags).map((t) => t.getAttribute('data-season-id'));
		expect(ids).toContain('sea1');
		expect(ids).toContain('sea2');
	});

	it('clicking a season-tag fires onselect with that season id', async () => {
		const onselect = vi.fn();
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: false,
			onselect,
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		const tags = container.querySelectorAll('[data-testid="season-tag"]');
		// Click sea2
		await fireEvent.click(tags[1]);
		expect(onselect).toHaveBeenCalledOnce();
		expect(onselect).toHaveBeenCalledWith('sea2');
	});

	it('selected + canManage → season-tag-edit present on the selected tag', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: true,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		expect(container.querySelector('[data-testid="season-tag-edit"]')).not.toBeNull();
	});

	it('clicking season-tag-edit fires onedit()', async () => {
		const onedit = vi.fn();
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: true,
			onselect: vi.fn(),
			onedit,
			oncreate: vi.fn(),
		});
		const editBtn = container.querySelector('[data-testid="season-tag-edit"]') as HTMLButtonElement;
		await fireEvent.click(editBtn);
		expect(onedit).toHaveBeenCalledOnce();
	});

	it('season-tag-edit only appears on the SELECTED tag (not on other tags)', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: true,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		const editBtns = container.querySelectorAll('[data-testid="season-tag-edit"]');
		// Only one edit button; it must be adjacent to sea1's tag
		expect(editBtns).toHaveLength(1);
		// The closest ancestor tag-wrap must contain sea1
		const tagWrap = editBtns[0].closest('.tag-wrap') as HTMLElement;
		const tagBtn = tagWrap?.querySelector('[data-testid="season-tag"]');
		expect(tagBtn?.getAttribute('data-season-id')).toBe('sea1');
	});

	it('canManage=false → season-tag-edit NOT present', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: false,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		expect(container.querySelector('[data-testid="season-tag-edit"]')).toBeNull();
	});

	it('NOT selected + canManage → no season-tag-edit on unselected tag', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea2', // sea1 is NOT selected
			canManage: true,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		// Edit button is adjacent to sea2 (selected), not sea1
		const sea1Wrap = container.querySelector('[data-season-id="sea1"]')?.closest('.tag-wrap');
		expect(sea1Wrap?.querySelector('[data-testid="season-tag-edit"]')).toBeNull();
	});

	it('canManage → season-create present, click fires oncreate()', async () => {
		const oncreate = vi.fn();
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: true,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate,
		});
		const createBtn = container.querySelector('[data-testid="season-create"]') as HTMLButtonElement;
		expect(createBtn).not.toBeNull();
		await fireEvent.click(createBtn);
		expect(oncreate).toHaveBeenCalledOnce();
	});

	it('canManage=false → season-create NOT present', () => {
		const { container } = render(SeasonBar, {
			seasons,
			selectedId: 'sea1',
			canManage: false,
			onselect: vi.fn(),
			onedit: vi.fn(),
			oncreate: vi.fn(),
		});
		expect(container.querySelector('[data-testid="season-create"]')).toBeNull();
	});
});
