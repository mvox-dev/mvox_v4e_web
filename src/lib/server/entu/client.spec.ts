import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EntuClient } from './client.ts';

describe('EntuClient', () => {
	beforeEach(() => {
		vi.stubEnv('ENTU_BASE_URL', 'https://entu.app/api/');
		vi.stubEnv('ENTU_DB', 'testdb');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('accepts an Entu JWT string', async () => {
			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('test-jwt-token');
			expect(client).toBeDefined();
		});
	});

	describe('fetch behaviour', () => {
		it('attaches Authorization: Bearer header on outbound requests', async () => {
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entity: {} }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			await client.get('entity-123');

			expect(fetchMock).toHaveBeenCalledOnce();
			const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			const headers = new Headers(init?.headers);
			expect(headers.get('Authorization')).toBe('Bearer my-jwt');
		});

		it('uses ENTU_BASE_URL env var as base URL', async () => {
			vi.stubEnv('ENTU_BASE_URL', 'https://custom.entu.host/api/');
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entity: {} }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			await client.get('entity-abc');

			const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toContain('custom.entu.host');
		});

		it('includes ENTU_DB in the request URL path', async () => {
			vi.stubEnv('ENTU_DB', 'mychoir');
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entity: {} }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			await client.get('entity-abc');

			const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toContain('mychoir');
		});
	});

	describe('get(entityId)', () => {
		it('returns the entity from the Entu response', async () => {
			const entity = { _id: 'entity-123', name: [{ string: 'Test Entity' }] };
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entity }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			const result = await client.get('entity-123');

			expect(result).toEqual(entity);
		});
	});

	describe('search(query)', () => {
		it('returns an array of entities', async () => {
			const entities = [{ _id: 'e1' }, { _id: 'e2' }];
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ entities }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			const result = await client.search({ type: 'song' });

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
		});
	});

	describe('setProperty(entityId, prop, value)', () => {
		it('makes a POST/PUT request with the property value', async () => {
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ _id: 'prop-456' }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('my-jwt');
			await client.setProperty('entity-123', 'name', 'My Choir');

			expect(fetchMock).toHaveBeenCalledOnce();
			const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(['POST', 'PUT']).toContain(init?.method?.toUpperCase());
		});

		it('attaches Authorization header on setProperty requests', async () => {
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ _id: 'prop-456' }), { status: 200 })
			);
			vi.stubGlobal('fetch', fetchMock);

			const { EntuClient } = await import('./client.ts');
			const client = new EntuClient('set-jwt');
			await client.setProperty('entity-123', 'name', 'value');

			const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			const headers = new Headers(init?.headers);
			expect(headers.get('Authorization')).toBe('Bearer set-jwt');
		});
	});
});
