import { describe, it, expect, vi, afterEach } from 'vitest';
import { touchSaveFormula, entuTouchSave, type TouchSaveOptions, type TouchSaveResult } from './touch-saver';
import type { EntuClient } from './entu-client';

// Wire shape resolved (Josquin's Q2 probe 2026-05-20, docs/migration/findings/phase-b-api-probes-2026-05-20.md):
// Touch-save = POST /entity/{id} re-asserting the instance's current _sharing value.
// Rationale: formula values have no _id — they are virtual, computed on read.
// Re-asserting _sharing (always present, single-value, non-load-bearing) triggers
// Entu's server-side formula recomputation as a side-effect of the save path.
// `propertyName` + `formulaExpression` args on the abstract interface are informational only.

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('touchSaveFormula', () => {
	describe('basic re-write on existing instances', () => {
		it('re-writes the formula property on each instance', async () => {
			const instances = [
				{ _id: 'org-1' },
				{ _id: 'org-2' },
				{ _id: 'org-3' }
			];

			const mockListInstances = vi.fn().mockResolvedValue(instances);
			const mockTouchSave = vi.fn().mockResolvedValue(undefined);

			const result: TouchSaveResult = await touchSaveFormula(client, {
				parentType: 'organization',
				propertyName: 'member_count_per_section',
				formulaExpression: '(_child.member COUNT) (_child.section.member_count SUM) +',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			expect(result.touchSaveCount).toBe(3);
			expect(result.noInstances).toBe(false);
			expect(mockTouchSave).toHaveBeenCalledTimes(3);
		});

		it('calls touchSave with the correct entity id', async () => {
			const instances = [{ _id: 'org-42' }];
			const mockListInstances = vi.fn().mockResolvedValue(instances);
			const mockTouchSave = vi.fn().mockResolvedValue(undefined);

			await touchSaveFormula(client, {
				parentType: 'organization',
				propertyName: 'member_count_per_section',
				formulaExpression: 'some_formula',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			const [entityId] = mockTouchSave.mock.calls[0] as [string, string, string];
			expect(entityId).toBe('org-42');
		});

		it('passes the property name and formula expression to touchSave', async () => {
			const instances = [{ _id: 'org-1' }];
			const mockListInstances = vi.fn().mockResolvedValue(instances);
			const mockTouchSave = vi.fn().mockResolvedValue(undefined);

			await touchSaveFormula(client, {
				parentType: 'organization',
				propertyName: 'member_count_per_section',
				formulaExpression: 'my_formula',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			const [, propertyName, formulaExpression] = mockTouchSave.mock.calls[0] as [string, string, string];
			expect(propertyName).toBe('member_count_per_section');
			expect(formulaExpression).toBe('my_formula');
		});
	});

	describe('no-op when no instances exist', () => {
		it('records noInstances=true and does not call touchSave', async () => {
			const mockListInstances = vi.fn().mockResolvedValue([]);
			const mockTouchSave = vi.fn();

			const result = await touchSaveFormula(client, {
				parentType: 'lending',
				propertyName: 'name',
				formulaExpression: 'some_formula',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			expect(result.touchSaveCount).toBe(0);
			expect(result.noInstances).toBe(true);
			expect(mockTouchSave).not.toHaveBeenCalled();
		});
	});

	describe('re-write semantics (always writes, no idempotency skip)', () => {
		it('always calls touchSave even if instance appears already correct', async () => {
			// Touch-save is intentionally NOT idempotent — the point is to force Entu re-eval.
			// Even if the formula is "already set", we re-write to trigger materialization.
			const instances = [
				{
					_id: 'org-1',
					member_count_per_section: [{ type: 'formula', string: '...' }] // already set
				}
			];

			const mockListInstances = vi.fn().mockResolvedValue(instances);
			const mockTouchSave = vi.fn().mockResolvedValue(undefined);

			const result = await touchSaveFormula(client, {
				parentType: 'organization',
				propertyName: 'member_count_per_section',
				formulaExpression: 'my_formula',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			// Must still call touchSave — this is NOT a skip case
			expect(mockTouchSave).toHaveBeenCalledTimes(1);
			expect(result.touchSaveCount).toBe(1);
		});
	});

	describe('error handling', () => {
		it('records per-instance failures without aborting the remaining instances', async () => {
			const instances = [
				{ _id: 'org-1' },
				{ _id: 'org-2' },
				{ _id: 'org-3' }
			];

			const mockListInstances = vi.fn().mockResolvedValue(instances);
			const mockTouchSave = vi.fn()
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('touch-save failed: 500'))
				.mockResolvedValueOnce(undefined);

			const result = await touchSaveFormula(client, {
				parentType: 'organization',
				propertyName: 'member_count_per_section',
				formulaExpression: 'my_formula',
				listInstances: mockListInstances,
				touchSave: mockTouchSave
			});

			expect(result.touchSaveCount).toBe(2); // 2 succeeded
			expect(result.failed).toBe(1); // 1 failed
		});
	});
});

// Wire-shape tests for the concrete `entuTouchSave` implementation.
// This is the default touchSave injectable for live runs — it reads the entity's current
// _sharing value and POSTs it back to /entity/{id}, triggering formula recomputation.
describe('entuTouchSave (concrete wire shape — _sharing POST)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('POSTs _sharing back to /entity/{id} to trigger formula recomputation', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// GET /entity/{id} to read current _sharing value
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entity: {
						_id: 'org-1',
						_sharing: [{ _id: 'sharing-prop-id', string: 'private' }]
					}
				}),
				{ status: 200 }
			)
		);
		// POST /entity/{id} to re-assert _sharing
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ _id: 'org-1', properties: [{ _id: 'new-sharing-id', type: '_sharing', string: 'private' }] }),
				{ status: 200 }
			)
		);

		await entuTouchSave(client, 'org-1');

		// First call: GET entity to read current _sharing
		const [getUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(getUrl).toMatch(/\/entity\/org-1/);
		expect((fetchMock.mock.calls[0] as [string, RequestInit])[1]?.method ?? 'GET').toBe('GET');

		// Second call: POST entity with _sharing value
		const [postUrl, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(postUrl).toMatch(/\/entity\/org-1$/);
		expect(postInit.method).toBe('POST');

		const body = JSON.parse(postInit.body as string) as Array<{ type: string; string: string }>;
		const sharingProp = body.find(p => p.type === '_sharing');
		expect(sharingProp).toBeDefined();
		expect(sharingProp!.string).toBe('private');
	});

	it('reads the current _sharing value before POSTing (does not hardcode a value)', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Entity has _sharing = 'public'
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entity: {
						_id: 'org-2',
						_sharing: [{ _id: 'sp-2', string: 'public' }]
					}
				}),
				{ status: 200 }
			)
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'org-2', properties: [] }), { status: 200 })
		);

		await entuTouchSave(client, 'org-2');

		const [, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
		const body = JSON.parse(postInit.body as string) as Array<{ type: string; string: string }>;
		const sharingProp = body.find(p => p.type === '_sharing');
		// Must use the actual current value, not a hardcoded constant
		expect(sharingProp!.string).toBe('public');
	});

	it('throws if _sharing is absent on the target entity', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Entity has no _sharing property
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entity: {
						_id: 'org-3',
						name: [{ string: 'Some org' }]
						// no _sharing
					}
				}),
				{ status: 200 }
			)
		);

		await expect(entuTouchSave(client, 'org-3')).rejects.toThrow(/_sharing/);
	});

	it('throws if the entity GET fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

		await expect(entuTouchSave(client, 'org-missing')).rejects.toThrow(/404/);
	});

	it('throws if the _sharing POST fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ entity: { _id: 'org-1', _sharing: [{ _id: 'sp', string: 'private' }] } }),
				{ status: 200 }
			)
		);
		fetchMock.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

		await expect(entuTouchSave(client, 'org-1')).rejects.toThrow(/500/);
	});
});
