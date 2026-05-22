import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

function makeEvent(jwt: string | null, searchParams: Record<string, string> = {}): RequestEvent {
	const urlParams = new URLSearchParams(searchParams);
	const url = new URL(`https://example.com/api/organizations?${urlParams.toString()}`);
	return {
		locals: { entuJwt: jwt },
		url,
		request: new Request(url),
		cookies: {} as RequestEvent['cookies'],
		params: {},
		route: { id: '/api/organizations' },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

// Fixture: full org with all optional fields + _thumbnail
const ORG_WITH_THUMB = {
	_id: 'org-1',
	name: [{ string: 'Test Choir' }],
	description: [{ string: 'A great choir' }],
	location: [{ string: 'Tallinn' }],
	_thumbnail: 'https://s3.example.com/photo-signed-url?ttl=60',
	member_count_per_section: [{ number: 5 }],
};

// Fixture: org with only required name, all optional absent
const ORG_SPARSE = {
	_id: 'org-2',
	name: [{ string: 'Sparse Choir' }],
};

function makeEntuSearchResponse(entities: unknown[]): Response {
	return new Response(JSON.stringify({ entities }), { status: 200 });
}

describe('GET /api/organizations', () => {
	beforeEach(() => {
		vi.stubEnv('ENTU_BASE_URL', 'https://entu.app/api/');
		vi.stubEnv('ENTU_DB', 'testdb');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it('returns 401 when entuJwt is absent', async () => {
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const event = makeEvent(null);
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns auth_required error code when JWT absent', async () => {
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const event = makeEvent(null);
		const response = await GET(event);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe('auth_required');
	});

	it('happy path: returns 200 with entities array', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(makeEntuSearchResponse([ORG_WITH_THUMB, ORG_SPARSE])),
		);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		expect(response.status).toBe(200);
		const body = (await response.json()) as { entities: unknown[] };
		expect(Array.isArray(body.entities)).toBe(true);
		expect(body.entities).toHaveLength(2);
	});

	it('happy path: entity matches §5.1 narrow shape exactly', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuSearchResponse([ORG_WITH_THUMB])));
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		const entity = body.entities[0];

		expect(entity._id).toBe('org-1');
		expect(entity.name).toBe('Test Choir');
		expect(entity.description).toBe('A great choir');
		expect(entity.location).toBe('Tallinn');
		expect(entity.photo).toBe('https://s3.example.com/photo-signed-url?ttl=60');
		expect(entity.member_count_per_section).toBe(5);
	});

	it('photo is populated from Entu _thumbnail (not a nested property lookup)', async () => {
		const thumbUrl = 'https://s3.example.com/thumb-abc';
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					makeEntuSearchResponse([{ _id: 'org-3', name: [{ string: 'X' }], _thumbnail: thumbUrl }]),
				),
		);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		expect(body.entities[0].photo).toBe(thumbUrl);
	});

	it('missing description → undefined in response (not null, not empty string)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuSearchResponse([ORG_SPARSE])));
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		expect(body.entities[0].description).toBeUndefined();
	});

	it('missing location → undefined', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuSearchResponse([ORG_SPARSE])));
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		expect(body.entities[0].location).toBeUndefined();
	});

	it('missing _thumbnail → photo is undefined', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuSearchResponse([ORG_SPARSE])));
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		expect(body.entities[0].photo).toBeUndefined();
	});

	it('empty result: Entu returns [] → 200 { entities: [] }, not 404', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuSearchResponse([])));
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		const response = await GET(makeEvent('valid-jwt'));
		expect(response.status).toBe(200);
		const body = (await response.json()) as { entities: unknown[] };
		expect(body.entities).toEqual([]);
	});

	it('pagination defaults: no params → Entu called with limit=50, skip=0', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt'));

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url] = fetchMock.mock.calls[0] as [string];
		const params = new URL(url).searchParams;
		expect(params.get('limit')).toBe('50');
		expect(params.get('skip')).toBe('0');
	});

	it('pagination user-supplied: ?limit=200&skip=100 → passed to Entu', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt', { limit: '200', skip: '100' }));

		const [url] = fetchMock.mock.calls[0] as [string];
		const params = new URL(url).searchParams;
		expect(params.get('limit')).toBe('200');
		expect(params.get('skip')).toBe('100');
	});

	it('pagination clamp: ?limit=500 → clamped to 200', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt', { limit: '500' }));

		const [url] = fetchMock.mock.calls[0] as [string];
		expect(new URL(url).searchParams.get('limit')).toBe('200');
	});

	it('pagination negative limit: ?limit=-5 → defaults to 50', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt', { limit: '-5' }));

		const [url] = fetchMock.mock.calls[0] as [string];
		expect(new URL(url).searchParams.get('limit')).toBe('50');
	});

	it('pagination non-numeric limit: ?limit=abc → defaults to 50', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt', { limit: 'abc' }));

		const [url] = fetchMock.mock.calls[0] as [string];
		expect(new URL(url).searchParams.get('limit')).toBe('50');
	});

	it('Entu search called with _type.string=organization and _thumbnail in props', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../../../routes/api/organizations/+server.ts');
		await GET(makeEvent('valid-jwt'));

		const [url] = fetchMock.mock.calls[0] as [string];
		const params = new URL(url).searchParams;
		expect(params.get('_type.string')).toBe('organization');
		const props = params.get('props') ?? '';
		expect(props).toContain('_thumbnail');
	});
});
