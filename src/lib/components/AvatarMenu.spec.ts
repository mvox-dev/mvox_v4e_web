// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import AvatarMenu from './AvatarMenu.svelte';

afterEach(cleanup);

describe('AvatarMenu', () => {
	it('renders the trigger button with the initial character + aria attributes', () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]');
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toContain('M');
		expect(btn?.getAttribute('aria-haspopup')).toBe('menu');
		expect(btn?.getAttribute('aria-expanded')).toBe('false');
		expect(btn?.getAttribute('aria-label')).toBe('User menu');
	});

	it('does not render the menu panel initially', () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});

	it('clicking trigger opens the menu panel with name + sign out link', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		const panel = container.querySelector('[data-testid="avatar-menu-panel"]');
		expect(panel).not.toBeNull();
		expect(panel?.textContent).toContain('Signed in as');
		expect(panel?.textContent).toContain('Mihkel Putrinš');
		expect(panel?.textContent).toContain('Sign out');
		expect(btn.getAttribute('aria-expanded')).toBe('true');
	});

	it('sign out link points to /auth/logout', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		const link = container.querySelector('a[data-testid="avatar-menu-signout"]');
		expect(link?.getAttribute('href')).toBe('/auth/logout');
	});

	it('clicking trigger again closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		await fireEvent.click(btn);
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
		expect(btn.getAttribute('aria-expanded')).toBe('false');
	});

	it('Escape key while open closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});

	it('outside click closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		// click on document.body (outside the component)
		await fireEvent.mouseDown(document.body);
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});

	it('focuses the first menuitem when opened (CHORE-75 YELLOW-75.1 fold-in)', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector(
			'button[data-testid="avatar-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(btn);
		const signoutLink = container.querySelector(
			'a[data-testid="avatar-menu-signout"]',
		) as HTMLAnchorElement;
		expect(document.activeElement).toBe(signoutLink);
	});
});
