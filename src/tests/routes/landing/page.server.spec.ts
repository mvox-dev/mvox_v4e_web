/**
 * Unit tests for src/routes/+page.server.ts load() function.
 *
 * RED: fails until Josquin implements the load() function.
 *
 * Contract pins:
 * - load() returns { orgs: OrgsResponse } on success
 * - load() returns { orgs: null, error: true } on BFF non-200
 * - load() returns { session: { jwt: string } | null } to drive auth state in template
 * - No entuJwt → returns signed-out shape (no BFF call made)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ServerLoadEvent } from '@sveltejs/kit';

type OrgEntity = {
	_id: string;
	name: string;
	description?: string;
	location?: string;
	photo?: string;
	member_count_per_section?: number;
};

type LoadResult = {
	session: { jwt: string } | null;
	orgs: OrgEntity[] | null;
	error?: boolean;
};

const ORG_FIXTURES: OrgEntity[] = [
	{
		_id: 'org-1',
		name: 'Test Choir',
		description: 'A choir',
		location: 'Tallinn',
		photo: 'https://s3.example.com/p1',
		member_count_per_section: 4,
	},
	{ _id: 'org-2', name: 'Sparse Choir' },
];

function makeLoadEvent(jwt: string | null, fetchImpl?: typeof fetch): Record<string, unknown> {
	return {
		locals: { entuJwt: jwt },
		fetch: fetchImpl ?? vi.fn(),
		url: new URL('https://example.com/'),
	};
}

function makeOrgsResponse(orgs: OrgEntity[], status = 200): Response {
	return new Response(JSON.stringify({ entities: orgs }), { status });
}

describe('+page.server.ts load()', () => {
	beforeEach(() => {
		vi.stubEnv('ENTU_BASE_URL', 'https://entu.app/api/');
		vi.stubEnv('ENTU_DB', 'testdb');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it('signed-out: no JWT → returns null session, null orgs, no fetch called', async () => {
		const fetchMock = vi.fn();
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent(null, fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(result.session).toBeNull();
		expect(result.orgs).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('signed-in: JWT present → session shape returned', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeOrgsResponse(ORG_FIXTURES));
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(result.session).not.toBeNull();
		expect(result.session?.jwt).toBe('my.jwt.token');
	});

	it('signed-in: load() calls /api/organizations via event.fetch', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeOrgsResponse(ORG_FIXTURES));
		const { load } = await import('../../../routes/+page.server.ts');
		await load(makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent);

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url] = fetchMock.mock.calls[0] as [string];
		expect(url).toMatch(/\/api\/organizations/);
	});

	it('signed-in: returns orgs array from BFF response', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeOrgsResponse(ORG_FIXTURES));
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(Array.isArray(result.orgs)).toBe(true);
		expect(result.orgs).toHaveLength(2);
		expect(result.orgs?.[0]._id).toBe('org-1');
	});

	it('signed-in: BFF returns empty array → orgs is [] (not null), no error', async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeOrgsResponse([]));
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(result.orgs).toEqual([]);
		expect(result.error).toBeFalsy();
	});

	it('signed-in: BFF returns 500 → error true, orgs null', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ error: 'upstream_unavailable' }), { status: 500 }),
			);
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(result.error).toBe(true);
		expect(result.orgs).toBeNull();
	});

	it('signed-in: BFF fetch throws (network error) → error true, orgs null', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'));
		const { load } = await import('../../../routes/+page.server.ts');
		const result = (await load(
			makeLoadEvent('my.jwt.token', fetchMock) as unknown as ServerLoadEvent,
		)) as LoadResult;

		expect(result.error).toBe(true);
		expect(result.orgs).toBeNull();
	});
});
