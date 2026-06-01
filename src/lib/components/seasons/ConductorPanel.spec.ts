// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConductorPanel from './ConductorPanel.svelte';
import type { OrgMember } from './ConductorPanel.svelte';
import type { Conductor } from '$lib/seasons/types';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_conductors_heading: () => 'Conductors',
	seasons_conductors_empty: () => 'No conductors assigned yet',
	seasons_conductors_remove: () => 'Remove',
	seasons_conductors_add: () => 'Add conductor',
}));

afterEach(cleanup);

const mockConductors: Conductor[] = [
	{ personId: 'p1', name: 'Alice B.' },
	{ personId: 'p2', name: 'Bob C.' },
];

const mockMembers: OrgMember[] = [
	{ personId: 'p3', name: 'Carol D.' },
	{ personId: 'p4', name: 'Dave E.' },
];

describe('ConductorPanel', () => {
	it('renders conductors list when conductors are provided', () => {
		const { container } = render(ConductorPanel, {
			conductors: mockConductors,
			members: mockMembers,
			canManage: false,
			onassign: vi.fn(),
			onremove: vi.fn(),
		});
		expect(container.querySelector('[data-testid="conductors-list"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="conductors-empty"]')).toBeNull();
		expect(container.textContent).toContain('Alice B.');
		expect(container.textContent).toContain('Bob C.');
	});

	it('shows empty state when conductors list is empty', () => {
		const { container } = render(ConductorPanel, {
			conductors: [],
			members: mockMembers,
			canManage: false,
			onassign: vi.fn(),
			onremove: vi.fn(),
		});
		expect(container.querySelector('[data-testid="conductors-empty"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="conductors-list"]')).toBeNull();
	});

	it('onremove fires with personId (not propertyValueId)', async () => {
		const onremove = vi.fn();
		const { container } = render(ConductorPanel, {
			conductors: mockConductors,
			members: mockMembers,
			canManage: true,
			onassign: vi.fn(),
			onremove,
		});
		const removeButtons = container.querySelectorAll('[data-testid="conductor-remove"]');
		// Click the first remove button (Alice's)
		await fireEvent.click(removeButtons[0]);
		expect(onremove).toHaveBeenCalledOnce();
		expect(onremove).toHaveBeenCalledWith('p1'); // personId — revoke by person
	});

	it('picker offers org members only; conductor-assign calls onassign(personId)', async () => {
		const onassign = vi.fn();
		const { container } = render(ConductorPanel, {
			conductors: [],
			members: mockMembers,
			canManage: true,
			onassign,
			onremove: vi.fn(),
		});
		const select = container.querySelector(
			'[data-testid="conductor-picker-select"]',
		) as HTMLSelectElement;
		const assignBtn = container.querySelector(
			'[data-testid="conductor-assign"]',
		) as HTMLButtonElement;

		// Picker must contain member options
		const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
		expect(options).toContain('p3');
		expect(options).toContain('p4');

		// Select Carol and assign
		await fireEvent.change(select, { target: { value: 'p3' } });
		await fireEvent.click(assignBtn);

		expect(onassign).toHaveBeenCalledOnce();
		expect(onassign).toHaveBeenCalledWith('p3');
	});

	it('canManage=false: picker and remove buttons not rendered', () => {
		const { container } = render(ConductorPanel, {
			conductors: mockConductors,
			members: mockMembers,
			canManage: false,
			onassign: vi.fn(),
			onremove: vi.fn(),
		});
		expect(container.querySelector('[data-testid="conductor-remove"]')).toBeNull();
		expect(container.querySelector('[data-testid="conductor-picker"]')).toBeNull();
		expect(container.querySelector('[data-testid="conductor-assign"]')).toBeNull();
	});

	it('canManage=true: picker and remove buttons are rendered', () => {
		const { container } = render(ConductorPanel, {
			conductors: mockConductors,
			members: mockMembers,
			canManage: true,
			onassign: vi.fn(),
			onremove: vi.fn(),
		});
		expect(container.querySelector('[data-testid="conductor-remove"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="conductor-picker"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="conductor-assign"]')).not.toBeNull();
	});

	it('picker excludes members who are already conductors (no duplicate assign opportunity)', () => {
		// p3 is in both members and conductors — must NOT appear in the picker options.
		const conductorsWithP3: Conductor[] = [
			{ personId: 'p3', name: 'Carol D.' }, // already a conductor
		];
		const { container } = render(ConductorPanel, {
			conductors: conductorsWithP3,
			members: mockMembers, // p3 + p4
			canManage: true,
			onassign: vi.fn(),
			onremove: vi.fn(),
		});
		const select = container.querySelector(
			'[data-testid="conductor-picker-select"]',
		) as HTMLSelectElement;
		const options = Array.from(select.querySelectorAll('option')).map((o) => o.value).filter(Boolean);
		// p4 offered; p3 NOT offered (already a conductor)
		expect(options).toContain('p4');
		expect(options).not.toContain('p3');
	});
});
