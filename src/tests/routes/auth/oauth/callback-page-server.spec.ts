import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { verifyIdentity } from '../../../../lib/server/auth/identity-cookie';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$env/static/private', () => ({ MVOX_SESSION_SECRET: 'test-secret-32-bytes-placeholder!' }));
vi.mock('$app/environment', () => ({ dev: false }));

// Load is imported AFTER the vi.mock calls (hoisted above) so the module resolves
// with the env stubs in place.
import { load } from '../../../../routes/auth/callback/+page.server';

describe('/auth/callback server load', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ accounts: { testdb: 'some-person' } }),
			}),
		);
	});

	it('returns sessionToken + db when ?key is present', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session-abc');
		const result = await (
			load as unknown as (e: {
				url: URL;
				cookies: typeof cookiesMock;
			}) => Promise<{ sessionToken: string; db: string }>
		)({
			url,
			cookies: cookiesMock,
		});
		expect(result.sessionToken).toBe('session-abc');
		expect(result.db).toBeTruthy();
	});

	it('redirects to /auth/login?error=missing_session_token when ?key is absent', async () => {
		const url = new URL('https://multivox.pages.dev/auth/callback');
		await expect(
			(load as unknown as (e: { url: URL }) => Promise<unknown>)({ url }),
		).rejects.toMatchObject({ status: 303 });
	});

	it('sets the mvox_session cookie and does not read any cookie (CHORE-79)', async () => {
		const cookiesMock = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const url = new URL('https://multivox.pages.dev/auth/callback?key=session');
		await (load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
			url,
			cookies: cookiesMock,
		});
		// We never READ a cookie on the callback (no CSRF cookie under Path C).
		expect(cookiesMock.get).not.toHaveBeenCalled();
		// AC5: the server SETS the httpOnly mvox_session cookie = the session JWT.
		expect(cookiesMock.set).toHaveBeenCalledWith(
			'mvox_session',
			'session',
			expect.objectContaining({
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				maxAge: 172800,
			}),
		);
	});
});

// ── Trusted-identity: server-side Entu exchange + dual cookie ─────────────────

const SECRET = 'test-secret-32-bytes-placeholder!';
const NOW_MS = 2_000_000_000_000; // ms

/** Stub cookies mock used in exchange tests. */
function makeCookies() {
	return { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
}

/** Stub a global fetch that returns a valid Entu /auth response for the given personId. */
function stubEntuExchangeOk(personId = 'person-77') {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ accounts: { testdb: personId } }),
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('/auth/callback server load — server-side Entu exchange + identity cookie', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW_MS);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('exchange 200 + valid accounts → cookies.set called for BOTH mvox_session AND mvox_identity', async () => {
		stubEntuExchangeOk('person-77');
		const cookiesMock = makeCookies();
		const url = new URL('https://multivox.pages.dev/auth/callback?key=tok-abc');
		await (
			load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>
		)({ url, cookies: cookiesMock });

		const setCalls = cookiesMock.set.mock.calls.map((c) => c[0] as string);
		expect(setCalls).toContain('mvox_session');
		expect(setCalls).toContain('mvox_identity');
	});

	it('exchange 200 + valid accounts → identity cookie verifies to personId from Entu response', async () => {
		stubEntuExchangeOk('person-77');
		const cookiesMock = makeCookies();
		const url = new URL('https://multivox.pages.dev/auth/callback?key=tok-abc');
		await (
			load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>
		)({ url, cookies: cookiesMock });

		// Find the mvox_identity set call and extract the cookie value
		const identityCall = cookiesMock.set.mock.calls.find((c) => c[0] === 'mvox_identity');
		expect(identityCall, 'mvox_identity must have been set').toBeDefined();
		const cookieValue = identityCall![1] as string;

		// Verify the cookie value decodes to the Entu-confirmed personId
		const payload = await verifyIdentity(cookieValue, SECRET, NOW_MS);
		expect(payload).toEqual({ personId: 'person-77' });
	});

	it('exchange 401 → NO cookies set; throws redirect 303 to /auth/login?error=server_exchange_failed', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
		);
		const cookiesMock = makeCookies();
		const url = new URL('https://multivox.pages.dev/auth/callback?key=bad-key');

		await expect(
			(load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
				url,
				cookies: cookiesMock,
			}),
		).rejects.toMatchObject({ status: 303, location: expect.stringContaining('server_exchange_failed') });

		expect(cookiesMock.set).not.toHaveBeenCalled();
	});

	it('exchange 200 but accounts lacks the db → same loud failure: no cookies + redirect', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ accounts: { otherdb: 'person-x' } }), // testdb absent
			}),
		);
		const cookiesMock = makeCookies();
		const url = new URL('https://multivox.pages.dev/auth/callback?key=some-key');

		await expect(
			(load as unknown as (e: { url: URL; cookies: typeof cookiesMock }) => Promise<unknown>)({
				url,
				cookies: cookiesMock,
			}),
		).rejects.toMatchObject({ status: 303, location: expect.stringContaining('server_exchange_failed') });

		expect(cookiesMock.set).not.toHaveBeenCalled();
	});

	it('missing ?key param → existing redirect behavior unchanged (regression pin)', async () => {
		const url = new URL('https://multivox.pages.dev/auth/callback');
		await expect(
			(load as unknown as (e: { url: URL }) => Promise<unknown>)({ url }),
		).rejects.toMatchObject({ status: 303, location: expect.stringContaining('missing_session_token') });
	});
});
