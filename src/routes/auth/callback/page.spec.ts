// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const SPEC_DIR = import.meta.dirname;
const REPO_ROOT = resolve(SPEC_DIR, '../../../..');

describe('callback +page.server.ts — uses $env/static/public, not $env/dynamic/private', () => {
	const source = readFileSync(resolve(SPEC_DIR, '+page.server.ts'), 'utf-8');

	it('does not import from $env/dynamic/private', () => {
		expect(source).not.toContain('$env/dynamic/private');
	});

	it('does not reference env.ENTU_DB', () => {
		expect(source).not.toContain('env.ENTU_DB');
	});

	it('imports from $env/static/public', () => {
		expect(source).toContain('$env/static/public');
	});

	it('references PUBLIC_ENTU_DB', () => {
		expect(source).toContain('PUBLIC_ENTU_DB');
	});
});

describe('wrangler.json — ENTU_DB dead var removed, PUBLIC_ENTU_DB preserved', () => {
	const wrangler = JSON.parse(readFileSync(resolve(REPO_ROOT, 'wrangler.json'), 'utf-8'));

	it('does not contain ENTU_DB in vars', () => {
		expect(wrangler.vars?.ENTU_DB).toBeUndefined();
	});

	it('preserves PUBLIC_ENTU_DB with value polyphony', () => {
		expect(wrangler.vars?.PUBLIC_ENTU_DB).toBe('polyphony');
	});
});

// === CHORE-74 — call order: hydrateUserStore before goto ===

const callOrder = vi.hoisted(() => ({ log: [] as string[] }));

const hydrateMock = vi.hoisted(() =>
	vi.fn(async () => {
		callOrder.log.push('hydrate');
	}),
);

const gotoMock = vi.hoisted(() =>
	vi.fn(async (_url: string) => {
		callOrder.log.push('goto');
	}),
);

vi.mock('$app/navigation', () => ({ goto: gotoMock }));

vi.mock('../../../lib/auth/userStore', () => ({
	hydrateUserStore: hydrateMock,
}));

vi.mock('../../../lib/auth/exchange', () => ({
	exchangeSession: vi.fn(async () => ({
		ok: true,
		token: 'tok',
		accounts: { polyphony: 'person-1' },
		user: { _id: 'person-1', email: 'u@example.com' },
	})),
}));

vi.mock('../../../lib/auth/storage', () => ({
	setToken: vi.fn(),
	setAccounts: vi.fn(),
	setUser: vi.fn(),
	setLastProvider: vi.fn(),
}));

vi.mock('../../../lib/auth/state', () => ({
	decodeState: vi.fn(() => ({
		nonce: 'n',
		return_to: '/',
		intent: 'login',
		provider: 'google',
	})),
}));

vi.mock('../[provider]/build-oauth-init-url', () => ({
	OAUTH_STATE_KEY: 'mvox.oauth_state',
}));

vi.mock('../../../lib/paraglide/messages.js', () => ({
	auth_callback_pending: () => 'pending…',
	auth_callback_success: () => 'success',
	auth_callback_failed: () => 'failed',
	auth_login_heading: () => 'Login',
}));

describe('callback +page.svelte — hydrateUserStore call order (CHORE-74)', () => {
	it('calls hydrateUserStore() before goto() on successful exchange', async () => {
		callOrder.log = [];
		hydrateMock.mockClear();
		gotoMock.mockClear();

		// Provide the OAUTH_STATE_KEY in localStorage so runExchange does not bail early
		localStorage.setItem('mvox.oauth_state', 'encoded-state-blob');

		const CallbackPage = (await import('./+page.svelte')).default;
		render(CallbackPage, {
			props: { data: { sessionToken: 'sess-tok', db: 'polyphony' } },
		});

		// $effect fires asynchronously — flush microtask queue
		await new Promise((r) => setTimeout(r, 0));

		expect(hydrateMock).toHaveBeenCalledOnce();
		expect(gotoMock).toHaveBeenCalledOnce();
		expect(callOrder.log).toEqual(['hydrate', 'goto']);
	});
});

// S33 sub-chain 3 — §2 readability conformance (source-level)
// auth/callback/+page.svelte currently renders bare <div class="max-w-md...">
// with text-gray-600 / text-red-600 / text-blue-600 and no DeskSurface wrapper.
// RED until Byrd wraps the content in DeskSurface + paper card and uses ink tokens.
const CALLBACK_PAGE_SOURCE = readFileSync(resolve(SPEC_DIR, '+page.svelte'), 'utf-8');

describe('auth/callback/+page.svelte — readability conformance (S33 §2)', () => {
	it('does not use raw text-gray-* class (must use theme ink tokens)', () => {
		expect(CALLBACK_PAGE_SOURCE).not.toMatch(/text-gray-\d+/);
	});

	it('does not use raw text-red-* class (must use theme color token)', () => {
		expect(CALLBACK_PAGE_SOURCE).not.toMatch(/text-red-\d+/);
	});

	it('does not use raw text-blue-* class (must use theme ink or accent token)', () => {
		expect(CALLBACK_PAGE_SOURCE).not.toMatch(/text-blue-\d+/);
	});

	it('wraps content in DeskSurface (or equivalent colored-bg ancestor)', () => {
		const hasDeskSurface = CALLBACK_PAGE_SOURCE.includes('DeskSurface');
		const hasBgClass = /class="[^"]*bg-[a-z]/.test(CALLBACK_PAGE_SOURCE);
		expect(hasDeskSurface || hasBgClass).toBe(true);
	});
});

// (*MVOX:Tallis*)
