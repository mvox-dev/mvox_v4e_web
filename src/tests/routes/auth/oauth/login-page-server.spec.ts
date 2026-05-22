/**
 * RED tests for src/routes/auth/login/+page.server.ts load()
 *
 * The server load function:
 * 1. Generates a csrf_state token (UUID)
 * 2. Sets it in an httpOnly cookie (maxAge 600s, path /auth, sameSite lax)
 * 3. Returns a `providers` array with fully-formed Entu OAuth URLs
 *
 * Entu OAuth URL shape (Finn's research 2026-05-22):
 *   https://api.entu.app/auth/{provider}?next=<encoded-callback>?state=<csrf>&key=
 * Entu concatenates the session token onto the `next` param value.
 *
 * Provider order: smart-id, mobile-id, id-card, google, apple, e-mail
 * (PO directive 2026-05-22 — Estonian eID first, global second, e-mail last)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies, ServerLoadEvent } from '@sveltejs/kit';

const ORDERED_PROVIDER_IDS = [
	'smart-id',
	'mobile-id',
	'id-card',
	'google',
	'apple',
	'e-mail',
] as const;

// Mutable env — reassign per-test to control $env/dynamic/private values
const mockEnv = { ENTU_BASE_URL: 'https://entu.app/api/', ENTU_DB: 'polyphony' };

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

function makeCookies(): Cookies & { store: Record<string, string>; opts: Record<string, unknown> } {
	const store: Record<string, string> = {};
	const opts: Record<string, unknown> = {};
	return {
		store,
		opts,
		get: (name: string) => store[name] ?? null,
		getAll: () => Object.entries(store).map(([name, value]) => ({ name, value })),
		set: vi.fn((name: string, value: string, options?: unknown) => {
			store[name] = value;
			opts[name] = options;
		}),
		delete: vi.fn(),
		serialize: vi.fn().mockReturnValue(''),
	} as unknown as Cookies & { store: Record<string, string>; opts: Record<string, unknown> };
}

function makeLoadEvent(origin = 'https://multivox.pages.dev'): ServerLoadEvent {
	return {
		locals: { entuJwt: null } as App.Locals,
		cookies: makeCookies(),
		url: new URL(`${origin}/auth/login`),
		fetch: vi.fn(),
		params: {},
		route: { id: '/auth/login' },
		platform: undefined,
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
		request: new Request(`${origin}/auth/login`),
		depends: vi.fn(),
		parent: vi.fn().mockResolvedValue({}),
		untrack: vi.fn((fn: () => unknown) => fn()),
	} as unknown as ServerLoadEvent;
}

describe('auth/login +page.server.ts load()', () => {
	beforeEach(() => {
		mockEnv.ENTU_BASE_URL = 'https://entu.app/api/';
		mockEnv.ENTU_DB = 'polyphony';
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// providers shape
	// -------------------------------------------------------------------------

	it('returns a providers array', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: unknown[] };

		expect(Array.isArray(result.providers)).toBe(true);
		expect(result.providers.length).toBeGreaterThan(0);
	});

	it('providers array contains all 6 expected provider IDs', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string }> };

		const ids = result.providers.map((p) => p.id);
		for (const expected of ORDERED_PROVIDER_IDS) {
			expect(ids).toContain(expected);
		}
	});

	it('providers appear in correct order: smart-id, mobile-id, id-card, google, apple, e-mail', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string }> };

		const ids = result.providers.map((p) => p.id);
		expect(ids).toEqual([...ORDERED_PROVIDER_IDS]);
	});

	it('each provider has id, label, and url fields', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as {
			providers: Array<{ id: string; label: string; url: string }>;
		};

		for (const provider of result.providers) {
			expect(typeof provider.id).toBe('string');
			expect(typeof provider.label).toBe('string');
			expect(typeof provider.url).toBe('string');
		}
	});

	// -------------------------------------------------------------------------
	// provider URL shape
	// -------------------------------------------------------------------------

	it('each provider URL contains the Entu auth base URL', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ url: string }> };

		for (const provider of result.providers) {
			expect(provider.url).toContain('entu.app');
		}
	});

	it('each provider URL contains the provider id in the path', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		for (const provider of result.providers) {
			expect(provider.url).toContain(`/auth/${provider.id}`);
		}
	});

	it('each provider URL next param points to /auth/callback on the request origin', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent('https://multivox.pages.dev');
		const result = (await load(event)) as { providers: Array<{ url: string }> };

		for (const provider of result.providers) {
			const nextMatch = provider.url.match(/[?&]next=([^&]+)/);
			expect(nextMatch).not.toBeNull();
			const next = decodeURIComponent(nextMatch![1]);
			expect(next).toContain('multivox.pages.dev');
			expect(next).toContain('/auth/callback');
		}
	});

	it('each provider URL next param ends with key= (Entu appends session token here)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ url: string }> };

		for (const provider of result.providers) {
			const nextMatch = provider.url.match(/[?&]next=([^&]+)/);
			const next = decodeURIComponent(nextMatch![1]);
			expect(next).toMatch(/[?&]key=$/);
		}
	});

	it('each provider URL next param contains the csrf_state value', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ url: string }> };
		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const csrfState = cookies.store['csrf_state'];

		expect(csrfState).toBeTruthy();
		for (const provider of result.providers) {
			expect(provider.url).toContain(csrfState);
		}
	});

	it('uses event.url.origin for callback URL (dev origin works)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent('http://localhost:5173');
		const result = (await load(event)) as { providers: Array<{ url: string }> };

		const firstNext = result.providers[0].url.match(/[?&]next=([^&]+)/);
		const next = decodeURIComponent(firstNext![1]);
		expect(next).toContain('localhost:5173');
	});

	// -------------------------------------------------------------------------
	// CSRF cookie
	// -------------------------------------------------------------------------

	it('sets csrf_state cookie as httpOnly', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		await load(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const cookieOpts = cookies.opts['csrf_state'] as Record<string, unknown>;
		expect(cookieOpts?.httpOnly).toBe(true);
	});

	it('sets csrf_state cookie with maxAge 600 (5 min)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		await load(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const cookieOpts = cookies.opts['csrf_state'] as Record<string, unknown>;
		expect(cookieOpts?.maxAge).toBe(600);
	});

	it('sets csrf_state cookie with path /auth', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		await load(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const cookieOpts = cookies.opts['csrf_state'] as Record<string, unknown>;
		expect(cookieOpts?.path).toBe('/auth');
	});

	it('all provider URLs share the same csrf_state value', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ url: string }> };
		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const csrfState = cookies.store['csrf_state'];

		const statesInUrls = result.providers.map((p) => {
			const nextMatch = p.url.match(/[?&]next=([^&]+)/);
			if (!nextMatch) return null;
			const next = decodeURIComponent(nextMatch[1]);
			const stateMatch = next.match(/[?&]state=([^&]+)/);
			return stateMatch ? stateMatch[1] : null;
		});
		for (const stateInUrl of statesInUrls) {
			expect(stateInUrl).toBe(csrfState);
		}
	});
});

// ---------------------------------------------------------------------------
// #50 — Corrected OAuth URL shape: host + path + single state
// These tests pin the FIXED shape and FAIL against the current buggy code.
// Unset ENTU_BASE_URL so the code falls through to ENTU_API_BASE in
// entu-config.ts — GREEN fixes entu-config.ts to 'https://api.entu.app/'.
// ---------------------------------------------------------------------------
describe('auth/login +page.server.ts load() — #50 corrected URL shape', () => {
	beforeEach(() => {
		// Force code to use ENTU_API_BASE constant (not env override) so the
		// host assertion targets the constant's value, which GREEN must fix.
		mockEnv.ENTU_BASE_URL = undefined as unknown as string;
		mockEnv.ENTU_DB = 'polyphony';
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('smart-id URL host is api.entu.app (not entu.app)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const smartId = result.providers.find((p) => p.id === 'smart-id')!;
		const parsed = new URL(smartId.url);
		expect(parsed.host).toBe('api.entu.app');
	});

	it('google URL host is api.entu.app (not entu.app)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const google = result.providers.find((p) => p.id === 'google')!;
		const parsed = new URL(google.url);
		expect(parsed.host).toBe('api.entu.app');
	});

	it('smart-id URL path is /auth/smart-id (no /api/ prefix)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const smartId = result.providers.find((p) => p.id === 'smart-id')!;
		const parsed = new URL(smartId.url);
		expect(parsed.pathname).toBe('/auth/smart-id');
	});

	it('google URL path is /auth/google (no /api/ prefix)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const google = result.providers.find((p) => p.id === 'google')!;
		const parsed = new URL(google.url);
		expect(parsed.pathname).toBe('/auth/google');
	});

	it('smart-id URL has no top-level state query parameter (state lives only inside encoded next)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const smartId = result.providers.find((p) => p.id === 'smart-id')!;
		const parsed = new URL(smartId.url);
		expect(parsed.searchParams.has('state')).toBe(false);
	});

	it('google URL has no top-level state query parameter (state lives only inside encoded next)', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent();
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };

		const google = result.providers.find((p) => p.id === 'google')!;
		const parsed = new URL(google.url);
		expect(parsed.searchParams.has('state')).toBe(false);
	});

	it('smart-id URL state value appears inside the decoded next param', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent('https://multivox.pages.dev');
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };
		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const csrfState = cookies.store['csrf_state'];

		const smartId = result.providers.find((p) => p.id === 'smart-id')!;
		const parsed = new URL(smartId.url);
		const next = decodeURIComponent(parsed.searchParams.get('next') ?? '');
		expect(next).toContain(`state=${csrfState}`);
	});

	it('smart-id URL next param decodes to callback URL shape with state and key=', async () => {
		const { load } = await import('../../../../routes/auth/login/+page.server.ts');
		const event = makeLoadEvent('https://multivox.pages.dev');
		const result = (await load(event)) as { providers: Array<{ id: string; url: string }> };
		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const csrfState = cookies.store['csrf_state'];

		const smartId = result.providers.find((p) => p.id === 'smart-id')!;
		const parsed = new URL(smartId.url);
		const next = decodeURIComponent(parsed.searchParams.get('next') ?? '');
		expect(next).toBe(`https://multivox.pages.dev/auth/callback?state=${csrfState}&key=`);
	});
});
