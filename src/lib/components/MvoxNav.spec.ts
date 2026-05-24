// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MvoxNav from './MvoxNav.svelte';

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
		expect(container.textContent).toContain('agenda');
		expect(container.textContent).toContain('library');
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
