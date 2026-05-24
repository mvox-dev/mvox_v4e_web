// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ProviderButton from './ProviderButton.svelte';

describe('ProviderButton', () => {
	it('renders provider name', () => {
		const { container } = render(ProviderButton, {
			props: { providerId: 'google', name: 'Continue with Google', href: '/auth/google' },
		});
		expect(container.textContent).toContain('Continue with Google');
	});

	it('renders sub-label when provided', () => {
		const { container } = render(ProviderButton, {
			props: { providerId: 'smart-id', name: 'Smart-ID', sub: 'EE/LV/LT', href: '/auth/smart-id' },
		});
		expect(container.textContent).toContain('EE/LV/LT');
	});

	it('applies featured background class when featured=true', () => {
		const { container } = render(ProviderButton, {
			props: { providerId: 'google', name: 'Google', href: '/x', featured: true },
		});
		const el = container.querySelector('a');
		expect(el?.className).toMatch(/bg-highlight/);
	});
});
