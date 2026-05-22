import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { takeSnapshot, type SnapshotOptions, type SnapshotResult } from './snapshotter';
import type { EntuClient } from './entu-client';

// Assumption (pending Finn's probe): Entu /entity pagination uses ?skip=N&limit=M.
// The count field in the response is the total entity count, used to detect end-of-pages.
// If the probe shows a different pagination contract, update these tests accordingly.

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt',
};

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(`${tmpdir()}/snapshotter-test-`);
	vi.restoreAllMocks();
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function makeEntity(id: string, type: string) {
	return {
		_id: id,
		_type: [{ string: type }],
		name: [{ string: `Entity ${id}` }],
	};
}

describe('takeSnapshot', () => {
	describe('single-page fetch (all entities fit in one page)', () => {
		it('fetches all entities and writes JSON to snapshotDir', async () => {
			const entities = [makeEntity('e1', 'organization'), makeEntity('e2', 'member')];
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			// First page: returns all 2 entities, count=2
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities, count: 2 }), { status: 200 }),
			);
			// Per-entity GETs (unconditional after list)
			for (const e of entities) {
				fetchMock.mockResolvedValueOnce(
					new Response(JSON.stringify({ entity: e }), { status: 200 }),
				);
			}

			const result: SnapshotResult = await takeSnapshot(client, {
				snapshotDir: tempDir,
				pageSize: 100,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.entityCount).toBe(2);
			expect(result.snapshotPath).toContain(tempDir);
			expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

			const fileContent = await readFile(result.snapshotPath, 'utf8');
			const parsed = JSON.parse(fileContent) as { entities: unknown[] };
			expect(parsed.entities).toHaveLength(2);
		});

		it('includes metadata in the snapshot JSON (timestamp, db, entityCount)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			const e1 = makeEntity('e1', 'org');
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: e1 }), { status: 200 }),
			);

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});

			const fileContent = await readFile(result.snapshotPath, 'utf8');
			const parsed = JSON.parse(fileContent) as {
				snapshotAt: string;
				db: string;
				entityCount: number;
				entities: unknown[];
			};
			expect(parsed.snapshotAt).toBe('2026-05-20T04:00:00Z');
			expect(parsed.db).toBe('polyphony');
			expect(parsed.entityCount).toBe(1);
		});
	});

	describe('multi-page fetch (pagination)', () => {
		it('fetches multiple pages and concatenates all entities', async () => {
			const page1 = [makeEntity('e1', 'org'), makeEntity('e2', 'member')];
			const page2 = [makeEntity('e3', 'person')];

			const fetchMock = vi.spyOn(globalThis, 'fetch');
			// Page 1: count=3 (total), entities=[e1,e2]
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: page1, count: 3 }), { status: 200 }),
			);
			// Page 2: entities=[e3]
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: page2, count: 3 }), { status: 200 }),
			);
			// Per-entity GETs for all 3
			for (const e of [...page1, ...page2]) {
				fetchMock.mockResolvedValueOnce(
					new Response(JSON.stringify({ entity: e }), { status: 200 }),
				);
			}

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				pageSize: 2,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.entityCount).toBe(3);
			// 2 list pages + 3 per-entity GETs = 5
			expect(fetchMock).toHaveBeenCalledTimes(5);
		});

		it('passes skip and limit params to the Entu API', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			const e1 = makeEntity('e1', 'org');
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: e1 }), { status: 200 }),
			);

			await takeSnapshot(client, {
				snapshotDir: tempDir,
				pageSize: 50,
				now: () => '2026-05-20T04:00:00Z',
			});

			const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toContain('skip=0');
			expect(url).toContain('limit=50');
		});

		it('stops fetching when all entities are received', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			const page = [makeEntity('e1', 'org'), makeEntity('e2', 'org')];
			// count=2, return both on first page — should not make a second list call
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: page, count: 2 }), { status: 200 }),
			);
			for (const e of page) {
				fetchMock.mockResolvedValueOnce(
					new Response(JSON.stringify({ entity: e }), { status: 200 }),
				);
			}

			await takeSnapshot(client, {
				snapshotDir: tempDir,
				pageSize: 100,
				now: () => '2026-05-20T04:00:00Z',
			});

			// 1 list call + 2 per-entity GETs = 3 (no second list page)
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});
	});

	describe('sha256 computation', () => {
		it('returns a consistent sha256 for the same entity set', async () => {
			const e1 = makeEntity('e1', 'org');
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			// Run 1: list + GET
			fetchMock
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response(JSON.stringify({ entity: e1 }), { status: 200 }))
				// Run 2: same data
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response(JSON.stringify({ entity: e1 }), { status: 200 }));

			const result1 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});
			const result2 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result1.sha256).toBe(result2.sha256);
		});

		it('returns different sha256 for different entity sets', async () => {
			const e1 = makeEntity('e1', 'org');
			const e2 = makeEntity('e2', 'member');
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			fetchMock
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response(JSON.stringify({ entity: e1 }), { status: 200 }))
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ entities: [e2], count: 1 }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response(JSON.stringify({ entity: e2 }), { status: 200 }));

			const result1 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});
			const result2 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:01:00Z',
			});

			expect(result1.sha256).not.toBe(result2.sha256);
		});
	});

	describe('dry-run mode', () => {
		it('does not write a file in dry-run mode', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			const e1 = makeEntity('e1', 'org');
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [e1], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: e1 }), { status: 200 }),
			);

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				dryRun: true,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.dryRun).toBe(true);
			expect(result.snapshotPath).toBeNull();
			expect(result.entityCount).toBe(1); // still counted from fetch
		});
	});

	describe('skip-snapshot mode (--skip-snapshot flag)', () => {
		it('skips fetch entirely and returns a sentinel result', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				skipSnapshot: true,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.skipped).toBe(true);
			expect(result.snapshotPath).toBeNull();
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('throws if the Entu fetch fails', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			fetchMock.mockResolvedValueOnce(new Response('Boom', { status: 500 }));

			await expect(
				takeSnapshot(client, {
					snapshotDir: tempDir,
					now: () => '2026-05-20T04:00:00Z',
				}),
			).rejects.toThrow(/500/);
		});
	});

	// Gap-4 (RED-4): full-payload snapshot — per-entity GET /entity/{id} fetch
	// The list endpoint returns summary payloads (_id + system fields only, per Entu API).
	// PO chose full-db-export as backup posture: each entity must be fetched individually
	// to capture full property arrays. Sha256 is computed over the full-payload JSON.
	describe('full-payload fetch (per-entity GET /entity/{id})', () => {
		it('fetches full payload for each entity via GET /entity/{id}', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			// List page: 2 entity stubs (summary only — no properties)
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'e1' }, { _id: 'e2' }],
						count: 2,
					}),
					{ status: 200 },
				),
			);
			// Full payload for e1
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entity: {
							_id: 'e1',
							_type: [{ string: 'organization' }],
							name: [{ string: 'Tallinna Kammerkoor' }],
							contact_email: [{ string: 'info@kammerkoor.ee' }],
						},
					}),
					{ status: 200 },
				),
			);
			// Full payload for e2
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entity: {
							_id: 'e2',
							_type: [{ string: 'member' }],
							name: [{ string: 'Jüri Mets' }],
							voice: [{ reference: 'voice-tenor-id' }],
						},
					}),
					{ status: 200 },
				),
			);

			await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});

			// 1 list call + 2 per-entity calls
			expect(fetchMock).toHaveBeenCalledTimes(3);

			// Per-entity calls must use GET /entity/{id} pattern
			const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
			expect(calls[1][0]).toMatch(/\/entity\/e1$/);
			expect(calls[2][0]).toMatch(/\/entity\/e2$/);
		});

		it('serializes full property arrays in the snapshot JSON, not just _id', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entity: {
							_id: 'e1',
							_type: [{ string: 'section' }],
							name: [{ string: 'Sopranod' }],
							ordinal: [{ number: 1 }],
							voice_type: [{ string: 'soprano' }],
						},
					}),
					{ status: 200 },
				),
			);

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});

			const fileContent = await readFile(result.snapshotPath!, 'utf8');
			const parsed = JSON.parse(fileContent) as {
				entities: Array<{ _id: string; name?: unknown; ordinal?: unknown; voice_type?: unknown }>;
			};
			const e1 = parsed.entities[0];
			// Full properties must be present — not just _id
			expect(e1.name).toBeDefined();
			expect(e1.ordinal).toBeDefined();
			expect(e1.voice_type).toBeDefined();
		});

		it('computes sha256 over the full-payload JSON, not just the list-page data', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			// Two runs: same entity, but different full-payload data
			// Run 1
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: { _id: 'e1', name: [{ string: 'Version A' }] } }), {
					status: 200,
				}),
			);
			// Run 2
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: { _id: 'e1', name: [{ string: 'Version B' }] } }), {
					status: 200,
				}),
			);

			const result1 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});
			const result2 = await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:01:00Z',
			});

			// Different full payloads → different sha256 values
			expect(result1.sha256).not.toBe(result2.sha256);
		});

		it('still works in dry-run mode (fetches but does not write)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entity: { _id: 'e1', name: [{ string: 'Org' }] } }), {
					status: 200,
				}),
			);

			const result = await takeSnapshot(client, {
				snapshotDir: tempDir,
				dryRun: true,
				now: () => '2026-05-20T04:00:00Z',
			});

			expect(result.dryRun).toBe(true);
			expect(result.snapshotPath).toBeNull();
			// sha256 computed over full payload even in dry-run
			expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
			// Still fetched per-entity
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('throws if a per-entity fetch fails', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [{ _id: 'e1' }], count: 1 }), { status: 200 }),
			);
			// Per-entity fetch fails
			fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

			await expect(
				takeSnapshot(client, {
					snapshotDir: tempDir,
					now: () => '2026-05-20T04:00:00Z',
				}),
			).rejects.toThrow(/404/);
		});

		// YELLOW-1 v2: per-entity fetch must be unconditional, not gated on isStubEntity heuristic.
		// Bentham recommended removing the heuristic (only-_id-and-system-fields detection) in favor
		// of always-fetch semantics — simpler and more correct for a full-db-backup posture.
		it('(YELLOW) always fetches GET /entity/{id} even when list payload appears to have full data', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			// List page returns entities that look "full" (have non-system properties inline)
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [
							{
								_id: 'e1',
								_type: [{ string: 'organization' }],
								name: [{ string: 'Inline data' }], // looks full, but list data is unreliable
							},
						],
						count: 1,
					}),
					{ status: 200 },
				),
			);
			// Full payload via per-entity GET (canonical source)
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entity: {
							_id: 'e1',
							_type: [{ string: 'organization' }],
							name: [{ string: 'Canonical full data' }],
							contact_email: [{ string: 'info@org.ee' }],
						},
					}),
					{ status: 200 },
				),
			);

			await takeSnapshot(client, {
				snapshotDir: tempDir,
				now: () => '2026-05-20T04:00:00Z',
			});

			// Must have made 2 calls: 1 list + 1 per-entity GET (unconditional)
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect((fetchMock.mock.calls[1] as [string, RequestInit])[0]).toMatch(/\/entity\/e1$/);
		});
	});
});
