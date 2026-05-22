/**
 * RED tests for src/lib/auth/exchange.ts (client-side exchange helper)
 *
 * This module is extracted from +page.svelte so it's unit-testable.
 * Byrd imports and calls it from the callback page's client-side script.
 *
 * Flow:
 *   exchangeSession({ sessionToken, db }) →
 *     1. GET api.entu.app/{db}/auth with Authorization: Bearer {sessionToken}
 *     2. On 200 with valid token → POST { token } to /auth/cookie
 *     3. On success → { ok: true }
 *     4. On any failure → { ok: false, error: <error_code> }
 *
 * The helper uses the global fetch (browser context at runtime).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SESSION_TOKEN = 'entu.session.token.xyz';
const JWT = 'entu.48h.jwt.signed';
const DB = 'polyphony';

describe('exchangeSession()', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Missing session token
	// -------------------------------------------------------------------------

	it('returns { ok: false, error: "missing_session_token" } when sessionToken is empty', async () => {
		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		const result = await exchangeSession({ sessionToken: '', db: DB });

		expect(result).toEqual({ ok: false, error: 'missing_session_token' });
	});

	it('does not call fetch when sessionToken is missing', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		await exchangeSession({ sessionToken: '', db: DB });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Happy path: Entu exchange → cookie POST → { ok: true }
	// -------------------------------------------------------------------------

	it('calls Entu auth endpoint with session token as Bearer', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('entu.app');
		expect(url).toContain(`/${DB}/auth`);
		const headers = new Headers(init?.headers);
		expect(headers.get('Authorization')).toBe(`Bearer ${SESSION_TOKEN}`);
	});

	it('Entu auth request includes Accept: application/json', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const headers = new Headers(init?.headers);
		expect(headers.get('Accept')).toBe('application/json');
	});

	it('POSTs JWT to /auth/cookie on successful Entu response', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		const [cookieUrl, cookieInit] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(cookieUrl).toContain('/auth/cookie');
		expect(cookieInit?.method).toBe('POST');
		const body = JSON.parse(cookieInit?.body as string) as { token: string };
		expect(body.token).toBe(JWT);
	});

	it('returns { ok: true } on full success', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		const result = await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		expect(result).toEqual({ ok: true });
	});

	// -------------------------------------------------------------------------
	// Entu auth failure
	// -------------------------------------------------------------------------

	it('returns { ok: false, error: "entu_auth_failed" } on Entu 401', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'session expired' }), { status: 401 }),
			);
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		const result = await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		expect(result).toEqual({ ok: false, error: 'entu_auth_failed' });
	});

	it('does not POST to /auth/cookie on Entu auth failure', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		expect(fetchMock).toHaveBeenCalledOnce();
	});

	// -------------------------------------------------------------------------
	// /auth/cookie POST failure
	// -------------------------------------------------------------------------

	it('returns { ok: false, error: "cookie_set_failed" } when /auth/cookie returns non-200', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'bad token' }), { status: 400 }));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		const result = await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		expect(result).toEqual({ ok: false, error: 'cookie_set_failed' });
	});

	it('returns { ok: false, error: "cookie_set_failed" } when /auth/cookie fetch throws', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: JWT }), { status: 200 }))
			.mockRejectedValueOnce(new Error('network failure'));
		vi.stubGlobal('fetch', fetchMock);

		const { exchangeSession } = await import('../../../../lib/auth/exchange.ts');
		const result = await exchangeSession({ sessionToken: SESSION_TOKEN, db: DB });

		expect(result).toEqual({ ok: false, error: 'cookie_set_failed' });
	});
});
