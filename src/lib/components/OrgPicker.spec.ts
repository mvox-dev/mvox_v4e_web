// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { userStore } from '$lib/auth/userStore';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

import OrgPicker from './OrgPicker.svelte';

beforeEach(() => {
	localStorage.clear();
	window.history.replaceState({}, '', '/');
	userStore.set({
		status: 'ready',
		name: 'Test',
		initial: 'T',
		personId: 'p1',
		orgs: [
			{ id: 'org-1', label: 'EFK Library', initials: 'EL' },
			{ id: 'org-2', label: 'Other Org', initials: 'OO' },
		],
	});
});

describe('OrgPicker — rendering', () => {
	it('renders the chip closed by default', () => {
		const { container, queryByRole } = render(OrgPicker);
		expect(container.querySelector('[data-testid="org-picker-chip"]')).not.toBeNull();
		expect(queryByRole('menu')).toBeNull();
	});
});

describe('OrgPicker — open/close', () => {
	it('opens the dropdown when chip is clicked', async () => {
		const { container, findByRole } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		expect(await findByRole('menu')).not.toBeNull();
	});

	it('closes on Escape', async () => {
		const { container, findByRole, queryByRole } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		await findByRole('menu');
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(queryByRole('menu')).toBeNull();
	});
});

describe('OrgPicker — selection', () => {
	it('clicking an org writes URL + localStorage + closes menu', async () => {
		const { container, findByRole, queryByRole, findByText } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		await findByRole('menu');
		await fireEvent.click(await findByText('Other Org'));
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
		expect(new URL(window.location.href).searchParams.get('org')).toBe('org-2');
		expect(queryByRole('menu')).toBeNull();
	});
});
