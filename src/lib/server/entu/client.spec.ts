import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EntuClient } from './client.ts';

// Mutable env object — reassign fields per-test to control what $env/dynamic/private exposes
const mockEnv = { ENTU_BASE_URL: 'https://entu.app/api/', ENTU_DB: 'testdb' };

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

describe('EntuClient', () => {
	beforeEach(() => {
		mockEnv.ENTU_BASE_URL = 'https://entu.app/api/';
		mockEnv.ENTU_DB = 'testdb';
		vi.resetModules();
	});

	afterEach(() => {
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

		it('uses ENTU_BASE_URL from $env/dynamic/private as base URL', async () => {
			mockEnv.ENTU_BASE_URL = 'https://custom.entu.host/api/';
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

		it('uses ENTU_DB from $env/dynamic/private in the request URL path', async () => {
			mockEnv.ENTU_DB = 'mychoir';
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
