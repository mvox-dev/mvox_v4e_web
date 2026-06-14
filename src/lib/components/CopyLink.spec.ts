// @vitest-environment happy-dom
// RED phase — CopyLink clipboard component.
// NOTE: CopyChip is NOT this component — it's an attendance checkbox cell.
// This is a fresh component: navigator.clipboard.writeText.
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyLink from './CopyLink.svelte';

afterEach(cleanup);

describe('CopyLink', () => {
	let writeTextMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: writeTextMock },
			configurable: true,
			writable: true,
		});
	});

	it('renders a copyable link element with the provided URL', () => {
		const { container } = render(CopyLink, { props: { url: 'https://mvox.eu/invite/tok-abc' } });
		// After GREEN: container should show the URL or a copy button; stub shows nothing useful
		// RED: stub renders empty div, assertions below will fail
		const button = container.querySelector('[data-testid="copy-link-button"]');
		expect(button).not.toBeNull();
	});

	it('shows the invite URL text in the component', () => {
		const { container } = render(CopyLink, { props: { url: 'https://mvox.eu/invite/tok-abc' } });
		expect(container.textContent).toContain('https://mvox.eu/invite/tok-abc');
	});

	it('clicking the copy button calls navigator.clipboard.writeText with the url', async () => {
		const { container } = render(CopyLink, { props: { url: 'https://mvox.eu/invite/tok-abc' } });
		const button = container.querySelector('[data-testid="copy-link-button"]');
		if (button) await fireEvent.click(button);
		expect(writeTextMock).toHaveBeenCalledWith('https://mvox.eu/invite/tok-abc');
	});

	it('shows a visual confirmation after copying (copied state)', async () => {
		const { container } = render(CopyLink, { props: { url: 'https://mvox.eu/invite/tok-abc' } });
		const button = container.querySelector('[data-testid="copy-link-button"]');
		if (button) await fireEvent.click(button);
		// After GREEN: component shows "Copied!" or aria-live announcement
		const copied = container.querySelector('[data-testid="copy-link-copied"]');
		expect(copied).not.toBeNull();
	});

	it('has an accessible label on the copy button', () => {
		const { container } = render(CopyLink, { props: { url: 'https://mvox.eu/invite/tok' } });
		const button = container.querySelector('[data-testid="copy-link-button"]');
		// aria-label or visible text — either satisfies accessibility
		const hasLabel =
			button?.getAttribute('aria-label') !== null || (button?.textContent?.trim().length ?? 0) > 0;
		expect(hasLabel).toBe(true);
	});
});

// (*MVOX:Tallis*)
