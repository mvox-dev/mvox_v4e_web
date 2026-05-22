import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

function makeEvent(
	jwt: string | null,
	orgId: string = 'org-1',
	searchParams: Record<string, string> = {},
): RequestEvent {
	const urlParams = new URLSearchParams(searchParams);
	const url = new URL(
		`https://example.com/api/organizations/${orgId}/sections?${urlParams.toString()}`,
	);
	return {
		locals: { entuJwt: jwt },
		url,
		request: new Request(url),
		cookies: {} as RequestEvent['cookies'],
		params: { id: orgId },
		route: { id: '/api/organizations/[id]/sections' },
		platform: undefined,
		fetch: vi.fn(),
		getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
	} as unknown as RequestEvent;
}

const ORG_ENTITY = { _id: 'org-1', name: [{ string: 'Test Choir' }] };

const SECTION_FULL = {
	_id: 'sec-1',
	name: [{ string: 'Soprano' }],
	voice: [{ reference: 'voice-1', string: 'Soprano' }],
	description: [{ string: 'High voices' }],
	display_order: [{ number: 1 }],
	member_count: [{ number: 4 }],
};

const SECTION_WITH_PARENT = {
	_id: 'sec-2',
	name: [{ string: 'First Sopranos' }],
	voice: [{ reference: 'voice-1', string: 'Soprano' }],
	parent_section: [{ reference: 'sec-1', string: 'Soprano' }],
};

const SECTION_SPARSE = {
	_id: 'sec-3',
	name: [{ string: 'Bass' }],
};

function makeEntuEntityResponse(entity: unknown): Response {
	return new Response(JSON.stringify({ entity }), { status: 200 });
}

function makeEntuSearchResponse(entities: unknown[]): Response {
	return new Response(JSON.stringify({ entities }), { status: 200 });
}

function makeEntuErrorResponse(status: number): Response {
	return new Response(JSON.stringify({ error: 'forbidden' }), { status });
}

describe('GET /api/organizations/[id]/sections', () => {
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
		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent(null));
		expect(response.status).toBe(401);
	});

	it('pre-check: org GET 404 → returns 404 (collapse 403+404, hide existence)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuErrorResponse(404)));
		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'no-such-org'));
		expect(response.status).toBe(404);
	});

	it('pre-check: org GET 403 → returns 404 (collapses to same as not-found)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEntuErrorResponse(403)));
		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'forbidden-org'));
		expect(response.status).toBe(404);
	});

	it('happy path: org exists → section search uses _parent.reference = org id', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
			.mockResolvedValueOnce(makeEntuSearchResponse([SECTION_FULL]));
		vi.stubGlobal('fetch', fetchMock);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		expect(response.status).toBe(200);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [searchUrl] = fetchMock.mock.calls[1] as [string];
		const params = new URL(searchUrl).searchParams;
		expect(params.get('_type.string')).toBe('section');
		expect(params.get('_parent.reference')).toBe('org-1');
	});

	it('happy path: response matches §5.2 narrow section shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
				.mockResolvedValueOnce(makeEntuSearchResponse([SECTION_FULL])),
		);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		const sec = body.entities[0];

		expect(sec._id).toBe('sec-1');
		expect(sec.name).toBe('Soprano');
		expect((sec.voice as Record<string, unknown>)?._id).toBe('voice-1');
		expect((sec.voice as Record<string, unknown>)?.name).toBe('Soprano');
		expect(sec.description).toBe('High voices');
		expect(sec.display_order).toBe(1);
		expect(sec.member_count).toBe(4);
	});

	it('section-of-section: parent_section field populated in flat response', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
				.mockResolvedValueOnce(makeEntuSearchResponse([SECTION_WITH_PARENT])),
		);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		expect(body.entities[0].parent_section).toBe('sec-1');
	});

	it('sparse section: optional fields absent → undefined in response', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
				.mockResolvedValueOnce(makeEntuSearchResponse([SECTION_SPARSE])),
		);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		const body = (await response.json()) as { entities: Array<Record<string, unknown>> };
		const sec = body.entities[0];

		expect(sec.voice).toBeUndefined();
		expect(sec.description).toBeUndefined();
		expect(sec.display_order).toBeUndefined();
		expect(sec.member_count).toBeUndefined();
		expect(sec.parent_section).toBeUndefined();
	});

	it('empty list: org exists but no sections → 200 { entities: [] }', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
				.mockResolvedValueOnce(makeEntuSearchResponse([])),
		);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		expect(response.status).toBe(200);
		const body = (await response.json()) as { entities: unknown[] };
		expect(body.entities).toEqual([]);
	});

	it('pagination defaults: no params → Entu search called with limit=50, skip=0', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
			.mockResolvedValueOnce(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		await GET(makeEvent('valid-jwt', 'org-1'));

		const [searchUrl] = fetchMock.mock.calls[1] as [string];
		const params = new URL(searchUrl).searchParams;
		expect(params.get('limit')).toBe('50');
		expect(params.get('skip')).toBe('0');
	});

	it('pagination: ?limit=100&skip=50 → passed to search', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
			.mockResolvedValueOnce(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		await GET(makeEvent('valid-jwt', 'org-1', { limit: '100', skip: '50' }));

		const [searchUrl] = fetchMock.mock.calls[1] as [string];
		const params = new URL(searchUrl).searchParams;
		expect(params.get('limit')).toBe('100');
		expect(params.get('skip')).toBe('50');
	});

	it('pagination clamp: ?limit=999 → clamped to 200', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
			.mockResolvedValueOnce(makeEntuSearchResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		await GET(makeEvent('valid-jwt', 'org-1', { limit: '999' }));

		const [searchUrl] = fetchMock.mock.calls[1] as [string];
		expect(new URL(searchUrl).searchParams.get('limit')).toBe('200');
	});

	it('3 sections returned: response has 3 entities', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(makeEntuEntityResponse(ORG_ENTITY))
				.mockResolvedValueOnce(
					makeEntuSearchResponse([SECTION_FULL, SECTION_WITH_PARENT, SECTION_SPARSE]),
				),
		);

		const { GET } = await import(
			'../../../../../../routes/api/organizations/[id]/sections/+server.ts'
		);
		const response = await GET(makeEvent('valid-jwt', 'org-1'));
		const body = (await response.json()) as { entities: unknown[] };
		expect(body.entities).toHaveLength(3);
	});
});
