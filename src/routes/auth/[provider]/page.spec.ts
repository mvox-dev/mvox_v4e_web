// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { setUser } from '../../../lib/auth/storage';
import { decodeState } from '../../../lib/auth/state';
import { buildOAuthInitUrl } from './build-oauth-init-url';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('buildOAuthInitUrl', () => {
	it('builds api.entu.app/auth/<provider>?next=<callback-with-key-stub>', () => {
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		const parsed = new URL(url);
		expect(parsed.origin).toBe('https://api.entu.app');
		expect(parsed.pathname).toBe('/auth/google');
		expect(parsed.searchParams.get('next')).toBe('https://multivox.pages.dev/auth/callback?key=');
	});

	it('stores encoded state in localStorage as mvox.oauth_state', () => {
		buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		expect(localStorage.getItem('mvox.oauth_state')).toBeTruthy();
	});

	it('stored state decodes to the provided payload', () => {
		buildOAuthInitUrl({
			provider: 'smart-id',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/orgs?q=foo',
			intent: 'reauth',
			nonce: 'nonce-123',
		});
		const stored = localStorage.getItem('mvox.oauth_state');
		expect(decodeState(stored as string)).toEqual({
			nonce: 'nonce-123',
			return_to: '/orgs?q=foo',
			intent: 'reauth',
			provider: 'smart-id',
		});
	});

	it('includes login_hint from localStorage user email (forward-compat)', () => {
		setUser({ _id: 'u1', email: 'alice@example.com' });
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'reauth',
			nonce: 'fixed-nonce',
		});
		expect(new URL(url).searchParams.get('login_hint')).toBe('alice@example.com');
	});

	it('omits login_hint when no user in storage', () => {
		const url = buildOAuthInitUrl({
			provider: 'google',
			origin: 'https://multivox.pages.dev',
			db: 'polyphony',
			returnTo: '/',
			intent: 'login',
			nonce: 'fixed-nonce',
		});
		expect(new URL(url).searchParams.has('login_hint')).toBe(false);
	});
});

// S33 sub-chain 3 — §2 readability conformance (source-level)
// auth/[provider]/+page.svelte currently renders bare <div class="... text-gray-600">
// with no DeskSurface wrapper and no paper-bg ancestor.
// RED until Byrd wraps the content in DeskSurface + a paper card and uses ink tokens.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROVIDER_PAGE_SOURCE = readFileSync(
	resolve(import.meta.dirname, '+page.svelte'),
	'utf-8',
);

describe('auth/[provider]/+page.svelte — readability conformance (S33 §2)', () => {
	it('does not use raw text-gray-* Tailwind class (must use theme ink tokens)', () => {
		expect(PROVIDER_PAGE_SOURCE).not.toMatch(/text-gray-\d+/);
	});

	it('wraps content in DeskSurface (or equivalent colored-bg ancestor)', () => {
		// Must import/use DeskSurface OR contain a bg-paper/bg-* wrapper
		const hasDeskSurface = PROVIDER_PAGE_SOURCE.includes('DeskSurface');
		const hasBgClass = /class="[^"]*bg-[a-z]/.test(PROVIDER_PAGE_SOURCE);
		expect(hasDeskSurface || hasBgClass).toBe(true);
	});
});

// (*MVOX:Tallis*)
