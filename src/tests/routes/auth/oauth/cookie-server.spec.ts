/**
 * RED tests for src/routes/auth/cookie/+server.ts POST handler
 *
 * Receives { token: <JWT> } from client JS after Entu exchange.
 * Validates JWT shape (3 parts, non-expired `exp` claim).
 * Sets entu_jwt httpOnly cookie.
 *
 * Does NOT verify JWT signature — trust boundary is the Entu exchange itself.
 * Signature verification deferred until Entu public key is available.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

const PAYLOAD_VALID = { exp: Math.floor(Date.now() / 1000) + 3600, aud: '1.2.3.4', sub: 'abc' };
const PAYLOAD_EXPIRED = { exp: Math.floor(Date.now() / 1000) - 10, aud: '1.2.3.4', sub: 'abc' };

function makeJwt(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body = btoa(JSON.stringify(payload));
	return `${header}.${body}.fakesig`;
}

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

function makeCookiePostEvent(body: unknown): RequestEvent {
	const cookies = makeCookies();
	return {
		cookies,
		locals: { entuJwt: null } as App.Locals,
		request: new Request('https://multivox.pages.dev/auth/cookie', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}),
		url: new URL('https://multivox.pages.dev/auth/cookie'),
		params: {},
		route: { id: '/auth/cookie' },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

describe('POST /auth/cookie', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Happy path: valid JWT → cookie set + 200
	// -------------------------------------------------------------------------

	it('returns 200 { ok: true } for a valid non-expired JWT', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const jwt = makeJwt(PAYLOAD_VALID);
		const event = makeCookiePostEvent({ token: jwt });
		const response = await POST(event);

		expect(response.status).toBe(200);
		const json = await response.json() as { ok: boolean };
		expect(json.ok).toBe(true);
	});

	it('sets entu_jwt httpOnly cookie with the token value', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const jwt = makeJwt(PAYLOAD_VALID);
		const event = makeCookiePostEvent({ token: jwt });
		await POST(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const jwtCall = (cookies.set as ReturnType<typeof vi.fn>).mock.calls.find(
			(c: unknown[]) => c[0] === 'entu_jwt'
		);
		expect(jwtCall).toBeDefined();
		const [, value, opts] = jwtCall as [string, string, Record<string, unknown>];
		expect(value).toBe(jwt);
		expect(opts?.httpOnly).toBe(true);
	});

	it('sets entu_jwt cookie with sameSite lax and maxAge 48h', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const jwt = makeJwt(PAYLOAD_VALID);
		const event = makeCookiePostEvent({ token: jwt });
		await POST(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		const jwtCall = (cookies.set as ReturnType<typeof vi.fn>).mock.calls.find(
			(c: unknown[]) => c[0] === 'entu_jwt'
		);
		const [,, opts] = jwtCall as [string, string, Record<string, unknown>];
		expect(opts?.sameSite).toBe('lax');
		expect(opts?.maxAge).toBe(48 * 60 * 60);
	});

	// -------------------------------------------------------------------------
	// Malformed JWT → 400
	// -------------------------------------------------------------------------

	it('returns 400 when token field is missing', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const event = makeCookiePostEvent({});
		const response = await POST(event);

		expect(response.status).toBe(400);
	});

	it('returns 400 when token is not a 3-part JWT', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const event = makeCookiePostEvent({ token: 'not.a.valid' });
		// "not.a.valid" has 3 parts but the parts are not base64-JSON — implementation should reject
		// Use a clearly invalid shape: only 2 parts
		const event2 = makeCookiePostEvent({ token: 'onlytwoparts.here' });
		const response = await POST(event2);

		expect(response.status).toBe(400);
	});

	it('does not set cookie on malformed JWT', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const event = makeCookiePostEvent({ token: 'bad' });
		await POST(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		expect(cookies.set).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Expired JWT → 401
	// -------------------------------------------------------------------------

	it('returns 401 for an expired JWT', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const jwt = makeJwt(PAYLOAD_EXPIRED);
		const event = makeCookiePostEvent({ token: jwt });
		const response = await POST(event);

		expect(response.status).toBe(401);
	});

	it('does not set cookie for an expired JWT', async () => {
		const { POST } = await import('../../../../routes/auth/cookie/+server.ts');
		const jwt = makeJwt(PAYLOAD_EXPIRED);
		const event = makeCookiePostEvent({ token: jwt });
		await POST(event);

		const cookies = event.cookies as ReturnType<typeof makeCookies>;
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
