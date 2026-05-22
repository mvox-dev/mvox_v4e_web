/**
 * RED tests for src/routes/auth/callback/+page.server.ts load()
 *
 * The server load function (runs on the server, before client JS):
 * 1. Reads `state` from URL search params
 * 2. Reads `csrf_state` cookie
 * 3. Compares — mismatch/missing → redirect to /auth/login?error=csrf_mismatch
 * 4. Reads `key` (session token) from URL search params
 * 5. On match: returns { sessionToken, db } to the page for client-side exchange
 *
 * The server load DOES NOT call Entu — exchange is client-side (IP-binding-safe).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies, ServerLoadEvent } from '@sveltejs/kit';

const CSRF_STATE = 'csrf-abc-123';
const SESSION_TOKEN = 'entu.session.xyz';

// Mutable env — reassign per-test to control $env/dynamic/private values
const mockEnv = { ENTU_DB: 'polyphony' };

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

function makeCookies(csrfState: string | null = CSRF_STATE): Cookies {
	const store: Record<string, string> = {};
	if (csrfState !== null) store['csrf_state'] = csrfState;
	return {
		get: (name: string) => store[name] ?? null,
		getAll: () => Object.entries(store).map(([name, value]) => ({ name, value })),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn().mockReturnValue(''),
	} as unknown as Cookies;
}

function makeCallbackEvent(
	key: string | null,
	stateInUrl: string | null = CSRF_STATE,
	csrfCookie: string | null = CSRF_STATE,
	origin = 'https://multivox.pages.dev',
): ServerLoadEvent {
	const params = new URLSearchParams();
	if (key !== null) params.set('key', key);
	if (stateInUrl !== null) params.set('state', stateInUrl);
	const urlStr = `${origin}/auth/callback?${params.toString()}`;
	return {
		locals: { entuJwt: null } as App.Locals,
		cookies: makeCookies(csrfCookie),
		url: new URL(urlStr),
		fetch: vi.fn(),
		params: {},
		route: { id: '/auth/callback' },
		platform: undefined,
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
		request: new Request(urlStr),
		depends: vi.fn(),
		parent: vi.fn().mockResolvedValue({}),
		untrack: vi.fn((fn: () => unknown) => fn()),
	} as unknown as ServerLoadEvent;
}

describe('auth/callback +page.server.ts load()', () => {
	beforeEach(() => {
		mockEnv.ENTU_DB = 'polyphony';
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Happy path: CSRF matches, key present → pass data to page
	// -------------------------------------------------------------------------

	it('returns sessionToken when state matches cookie and key is present', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN);
		const result = (await load(event)) as { sessionToken: string; db: string };

		expect(result.sessionToken).toBe(SESSION_TOKEN);
	});

	it('returns db from ENTU_DB env var', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN);
		const result = (await load(event)) as { sessionToken: string; db: string };

		expect(result.db).toBe('polyphony');
	});

	it('does not call Entu — no fetch calls on happy path', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN);
		await load(event);

		expect(event.fetch).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// CSRF mismatch → redirect to /auth/login?error=csrf_mismatch
	// -------------------------------------------------------------------------

	it('throws redirect to /auth/login?error=csrf_mismatch when state param is missing', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN, null, CSRF_STATE);

		await expect(load(event)).rejects.toMatchObject({
			location: expect.stringContaining('/auth/login'),
		});
	});

	it('throws redirect to /auth/login?error=csrf_mismatch when csrf_state cookie is missing', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN, CSRF_STATE, null);

		await expect(load(event)).rejects.toMatchObject({
			location: expect.stringContaining('/auth/login'),
		});
	});

	it('throws redirect to /auth/login?error=csrf_mismatch when state does not match cookie', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN, 'tampered-state', CSRF_STATE);

		await expect(load(event)).rejects.toMatchObject({
			location: expect.stringContaining('/auth/login'),
		});
	});

	it('redirect on CSRF mismatch includes error=csrf_mismatch', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN, 'wrong', CSRF_STATE);

		await expect(load(event)).rejects.toMatchObject({
			location: expect.stringContaining('csrf_mismatch'),
		});
	});

	it('does not call Entu on CSRF mismatch', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(SESSION_TOKEN, 'wrong', CSRF_STATE);

		await expect(load(event)).rejects.toBeDefined();
		expect(event.fetch).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Missing key
	// -------------------------------------------------------------------------

	it('throws redirect to /auth/login when key param is missing', async () => {
		const { load } = await import('../../../../routes/auth/callback/+page.server.ts');
		const event = makeCallbackEvent(null);

		await expect(load(event)).rejects.toMatchObject({
			location: expect.stringContaining('/auth/login'),
		});
	});
});
