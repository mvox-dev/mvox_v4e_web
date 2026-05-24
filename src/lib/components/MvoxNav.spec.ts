// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userStore } from '$lib/auth/userStore';
import MvoxNav from './MvoxNav.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

beforeEach(() => {
	localStorage.clear();
	window.history.replaceState({}, '', '/');
});

describe('MvoxNav', () => {
	it('renders brand and section tabs', () => {
		const { container } = render(MvoxNav, {
			props: {
				signedIn: true,
				currentTab: 'library',
				orgLabel: 'Estonian Philharmonic Chamber Choir',
				orgInitials: 'EP',
				userInitial: 'M',
				userName: 'Maire L.',
			},
		});
		expect(container.textContent).toContain('mvox');
		expect(container.textContent).toContain('Agenda');
		expect(container.textContent).toContain('Library');
		expect(container.textContent).toContain('Maire L.');
	});

	it('shows LIBRARIAN role chip when on library tab and signed in', () => {
		const { container } = render(MvoxNav, {
			props: {
				signedIn: true,
				currentTab: 'library',
				orgLabel: 'X',
				orgInitials: 'X',
				userInitial: 'X',
				userName: 'X',
			},
		});
		expect(container.textContent).toContain('LIBRARIAN');
	});

	it('does not render user pill when not signed in', () => {
		const { container } = render(MvoxNav, { props: { signedIn: false, currentTab: 'library' } });
		expect(container.textContent).not.toContain('Maire');
	});
});

describe('MvoxNav — orgPickerMode', () => {
	it('placeholder mode renders placeholder copy and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: '',
				userInitial: '',
				orgLabel: '',
				orgInitials: '',
				orgPickerMode: 'placeholder',
			},
		});
		expect(container.textContent).toContain('No organizations');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('static mode renders orgLabel non-interactively and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'EFK Library',
				orgInitials: 'EL',
				orgPickerMode: 'static',
			},
		});
		expect(container.textContent).toContain('EFK Library');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('dropdown mode mounts the OrgPicker', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [
				{ id: 'a', label: 'A', initials: 'A' },
				{ id: 'b', label: 'B', initials: 'B' },
			],
		});
		const { getByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'A',
				orgInitials: 'A',
				orgPickerMode: 'dropdown',
			},
		});
		expect(getByTestId('org-picker-chip')).not.toBeNull();
	});
});
