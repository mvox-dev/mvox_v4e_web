import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

function makeCookies(): Cookies & { store: Record<string, string> } {
	const store: Record<string, string> = {};
	return {
		store,
		get: (name: string) => store[name] ?? null,
		getAll: () => Object.entries(store).map(([name, value]) => ({ name, value })),
		set: vi.fn((name: string, value: string) => { store[name] = value; }),
		delete: vi.fn((name: string) => { delete store[name]; }),
		serialize: vi.fn().mockReturnValue(''),
	} as unknown as Cookies & { store: Record<string, string> };
}

function makeAuthEvent(apiKey: string | null, db: string = 'testdb'): RequestEvent {
	const headers = new Headers();
	if (apiKey !== null) {
		headers.set('Authorization', `Bearer ${apiKey}`);
	}
	const cookies = makeCookies();
	return {
		cookies,
		locals: {} as App.Locals,
		request: new Request(`https://example.com/auth?db=${db}`, { headers }),
		url: new URL(`https://example.com/auth?db=${db}`),
		params: {},
		route: { id: '/auth' },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

describe('POST /auth', () => {
	beforeEach(() => {
		vi.stubEnv('ENTU_BASE_URL', 'https://entu.app/api/');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('forwards the api-key to Entu auth endpoint', async () => {
		const jwt = 'entu.issued.jwt';
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ token: jwt }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('my-api-key', 'testdb');
		await POST(event);

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('entu.app');
		const reqHeaders = new Headers(init?.headers);
		expect(reqHeaders.get('Authorization')).toBe('Bearer my-api-key');
	});

	it('includes db param in the Entu request URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ token: 'tok' }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('api-key', 'mychoir');
		await POST(event);

		const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('mychoir');
	});

	it('sets httpOnly entu_jwt cookie on success', async () => {
		const jwt = 'entu.issued.jwt';
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ token: jwt }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('api-key');
		await POST(event);

		const cookiesSet = event.cookies.set as ReturnType<typeof vi.fn>;
		expect(cookiesSet).toHaveBeenCalledOnce();
		const [name, value, opts] = cookiesSet.mock.calls[0] as [string, string, Record<string, unknown>];
		expect(name).toBe('entu_jwt');
		expect(value).toBe(jwt);
		expect(opts?.httpOnly).toBe(true);
		expect(opts?.sameSite).toBe('lax');
		// 48h in seconds
		expect(opts?.maxAge).toBe(48 * 60 * 60);
	});

	it('returns 200 response on success', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ token: 'tok' }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('api-key');
		const response = await POST(event);

		expect(response.status).toBe(200);
	});

	it('does not set cookie on Entu auth failure', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'invalid key' }), { status: 401 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('bad-api-key');
		await POST(event);

		const cookiesSet = event.cookies.set as ReturnType<typeof vi.fn>;
		expect(cookiesSet).not.toHaveBeenCalled();
	});

	it('returns an error response on Entu auth failure', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'invalid key' }), { status: 401 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent('bad-api-key');
		const response = await POST(event);

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	it('returns 401 when no Authorization header is provided', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const { POST } = await import('../../../routes/auth/+server.ts');
		const event = makeAuthEvent(null);
		const response = await POST(event);

		expect(response.status).toBe(401);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
