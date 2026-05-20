/**
 * RED tests for Phase B live-wiring (4 stubs + parent_copy iteration fix).
 * Encodes the wire contract for migrateProperty, deleteProperty, updateFormula,
 * and verifyDeleteSafe — none of which have real implementations yet.
 *
 * Wire shape authority:
 *   - DELETE /property/{id}: entu-api property deletion
 *   - POST /entity/{id} with formula property: formula update on property-def entity
 *   - GET /entity?_type.reference=...&name.string=...: name lookup (Finn Q3)
 *   - verifyDeleteSafe: formula-reference scan + instance-set scan before deleting
 *
 * (*MVOX:Tallis*)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildLiveCallbacks } from '../2026-05-20-phase-b';
import type { EntuClient } from './entu-client';
import type { BackfillDataOp, DeletePropertyOp, UpdateFormulaOp } from './diff';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

afterEach(() => {
	vi.restoreAllMocks();
});

// ── RED-1: migrateProperty live callback ─────────────────────────────────────

describe('RED-1: buildLiveCallbacks.migrateProperty — live wire shape', () => {
	describe('copy kind (simple value copy on same entity)', () => {
		it('GETs source entity then POSTs target property to same entity', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			// GET /entity/{id} — return entity with source property
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entity: {
							_id: 'person-1',
							photo: [{ _id: 'photo-prop-id', type: 'file', reference: 'file-entity-id-1' }]
						}
					}),
					{ status: 200 }
				)
			);
			// POST /entity/{id} — accept target property write
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						_id: 'person-1',
						properties: [{ _id: 'new-prop-id', type: 'avatar', reference: 'file-entity-id-1' }]
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: BackfillDataOp = {
				kind: 'BACKFILL_DATA',
				parentType: 'person',
				sourceProperty: 'photo',
				targetProperty: 'avatar',
				backfillKind: 'file'
			};

			// migrateProperty must not throw "not yet wired" for 'file' kind
			await expect(cbs.migrateProperty(client, op)).resolves.toBeDefined();

			// Verify GET was called for the source entity
			const getCall = fetchMock.mock.calls.find(
				([url]) => typeof url === 'string' && url.includes('/entity/')
			);
			expect(getCall).toBeDefined();
		});
	});

	// parent_copy delegation tests moved to live-wiring-delegation.spec.ts (RED v11).
	// The old inline call-sequence test (list → GET child → GET parent → POST) is replaced
	// by delegation contract tests that spy on dataMigratorMigrateProperty.

	describe('string_to_reference kind (exact name.string= search)', () => {
		it('uses name.string= exact-match query (not q=) to resolve voice entity', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');

			// List section instances
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [
							{ _id: 'section-1', voice_type: [{ type: 'string', string: 'soprano' }] }
						],
						count: 1
					}),
					{ status: 200 }
				)
			);
			// GET /entity?_type.reference=<voice-type-id>&name.string=soprano
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'voice-soprano-id' }],
						count: 1
					}),
					{ status: 200 }
				)
			);
			// POST voice reference to section
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						_id: 'section-1',
						properties: [{ _id: 'new-voice-prop-id', type: 'voice' }]
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: BackfillDataOp = {
				kind: 'BACKFILL_DATA',
				parentType: 'section',
				sourceProperty: 'voice_type',
				targetProperty: 'voice',
				backfillKind: 'string_to_reference'
			};

			await expect(cbs.migrateProperty(client, op)).resolves.toBeDefined();

			// The name lookup fetch must use name.string=, NOT q=
			const lookupFetch = fetchMock.mock.calls.find(
				([url]) => typeof url === 'string' && url.includes('name.string=')
			);
			expect(lookupFetch).toBeDefined();
			const lookupUrl = String(lookupFetch![0]);
			expect(lookupUrl).toContain('name.string=soprano');
			expect(lookupUrl).not.toContain('q=soprano');
		});
	});
});

// ── RED-2 / RED v12.1: deleteProperty live callback ─────────────────────────
//
// Bug 1 fix: property-def entities ARE entities. DELETE /[db]/entity/{id} is correct.
// DELETE /[db]/property/{id} returns 404 universally (wrong endpoint).

describe('RED-2 / RED v12.1: buildLiveCallbacks.deleteProperty — DELETE /entity/{id}', () => {
	it('calls DELETE /[db]/entity/{propertyDefId} (NOT /property/)', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id'
		};

		const result = await cbs.deleteProperty(client, op);
		expect(result.deleted).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		// Must call /entity/{id} — property-def entities ARE entities
		expect(url).toContain('/entity/org-contact-email-prop-id');
		// Must NOT call /property/ endpoint (returns 404 universally in Entu)
		expect(url).not.toContain('/property/');
		expect(init?.method).toBe('DELETE');
	});

	it('succeeds (no throw) on 200 response', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'ok-prop-id'
		};

		await expect(cbs.deleteProperty(client, op)).resolves.toEqual({ deleted: true });
	});

	it('throws with status + body on non-2xx response', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'Property not found' }), { status: 404 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'missing-prop-id'
		};

		await expect(cbs.deleteProperty(client, op)).rejects.toThrow(/404/);
	});
});

// ── RED-3: updateFormula live callback ───────────────────────────────────────

describe('RED-3: buildLiveCallbacks.updateFormula — POST new formula to property-def entity', () => {
	it('POSTs {type:"formula", string:"<expr>"} to /entity/{propertyDefId}', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		// v12 Bug 2 fix: updateFormula does a pre-GET to read existing formula values.
		// Mock the GET as returning a "fresh" prop-def (no formula values), so no DELETE fires.
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ entity: { _id: 'member-count-prop-id' } }),
				{ status: 200 }
			)
		);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					_id: 'member-count-prop-id',
					properties: [{ _id: 'new-formula-prop-id', type: 'formula', string: '(_child.member COUNT) (_child.section.member_count SUM) +' }]
				}),
				{ status: 200 }
			)
		);

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		const result = await cbs.updateFormula(client, op);
		expect(result.updated).toBe(true);

		// v12 Bug 2 fix: updateFormula now GETs first (to pre-delete existing formula values),
		// then POSTs. Find the POST call by method rather than asserting calls[0].
		const postCall = fetchMock.mock.calls.find(
			([, init]) => (init as RequestInit | undefined)?.method === 'POST'
		);
		expect(postCall).toBeDefined();
		const [url, init] = postCall as [string, RequestInit];
		expect(url).toContain('/entity/member-count-prop-id');
		expect(init?.method).toBe('POST');

		const body = JSON.parse(init?.body as string) as Array<{ type: string; string: string }>;
		const formulaProp = body.find((p) => p.type === 'formula');
		expect(formulaProp).toBeDefined();
		expect(formulaProp?.string).toBe('(_child.member COUNT) (_child.section.member_count SUM) +');
	});

	it('throws on non-2xx response from formula POST', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response('Forbidden', { status: 403 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		await expect(cbs.updateFormula(client, op)).rejects.toThrow();
	});
});

// ── RED v12.2: updateFormula must pre-delete existing formula values ──────────
//
// Bug 2 fix: POST appends, not replaces (Q5 multi-value gotcha). updateFormula must:
// 1. GET prop-def entity to read existing formula property _ids
// 2. DELETE each existing formula value (_id) BEFORE POST
// 3. POST the new formula expression
// Same pattern as data-migrator's pruneExistingTarget / v9.2 guard.
//
// (*MVOX:Tallis*)

describe('RED v12.2: buildLiveCallbacks.updateFormula — pre-delete existing formula values', () => {
	it('DELETEs existing formula property value before POSTing new formula', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// GET prop-def entity — has one existing formula value
		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			if (!init?.method || init.method === 'GET') {
				return new Response(
					JSON.stringify({
						entity: {
							_id: 'member-count-prop-id',
							formula: [{ _id: 'stale-formula-id', string: '_referrer.member.name COUNT' }]
						}
					}),
					{ status: 200 }
				);
			}
			if (init?.method === 'DELETE') {
				return new Response(JSON.stringify({ deleted: true }), { status: 200 });
			}
			if (init?.method === 'POST') {
				return new Response(
					JSON.stringify({ _id: 'member-count-prop-id', properties: [{ _id: 'new-formula-id' }] }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		await cbs.updateFormula(client, op);

		// Must have called DELETE /property/stale-formula-id (property-VALUE delete, not /entity/)
		const deleteCall = fetchMock.mock.calls.find(
			([url, init]) =>
				(init as RequestInit)?.method === 'DELETE' &&
				String(url).includes('/property/stale-formula-id')
		);
		expect(deleteCall).toBeDefined();

		// DELETE must come before POST
		const deleteIdx = fetchMock.mock.calls.findIndex(
			([url, init]) =>
				(init as RequestInit)?.method === 'DELETE' &&
				String(url).includes('/property/stale-formula-id')
		);
		const postIdx = fetchMock.mock.calls.findIndex(
			([, init]) => (init as RequestInit)?.method === 'POST'
		);
		expect(deleteIdx).toBeLessThan(postIdx);
	});

	it('DELETEs ALL stale formula values when multiple exist (multi-value cleanup)', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			if (!init?.method || init.method === 'GET') {
				return new Response(
					JSON.stringify({
						entity: {
							_id: 'member-count-prop-id',
							formula: [
								{ _id: 'stale-1', string: 'old-formula-a' },
								{ _id: 'stale-2', string: 'old-formula-b' },
								{ _id: 'stale-3', string: 'old-formula-c' }
							]
						}
					}),
					{ status: 200 }
				);
			}
			if (init?.method === 'DELETE') {
				return new Response(JSON.stringify({ deleted: true }), { status: 200 });
			}
			if (init?.method === 'POST') {
				return new Response(
					JSON.stringify({ _id: 'member-count-prop-id' }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		await cbs.updateFormula(client, op);

		const deleteCalls = fetchMock.mock.calls.filter(
			([, init]) => (init as RequestInit)?.method === 'DELETE'
		);
		expect(deleteCalls).toHaveLength(3);
		const deleteUrls = deleteCalls.map(([url]) => String(url));
		// property-VALUE DELETEs must use /property/{id}, not /entity/{id}
		expect(deleteUrls.some((u) => u.includes('/property/stale-1'))).toBe(true);
		expect(deleteUrls.some((u) => u.includes('/property/stale-2'))).toBe(true);
		expect(deleteUrls.some((u) => u.includes('/property/stale-3'))).toBe(true);
	});

	it('skips DELETE when no existing formula values on prop-def (fresh prop-def)', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			if (!init?.method || init.method === 'GET') {
				// No existing formula values
				return new Response(
					JSON.stringify({ entity: { _id: 'member-count-prop-id' } }),
					{ status: 200 }
				);
			}
			if (init?.method === 'POST') {
				return new Response(
					JSON.stringify({ _id: 'member-count-prop-id' }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		await cbs.updateFormula(client, op);

		// No DELETEs should be called — nothing to prune
		const deleteCalls = fetchMock.mock.calls.filter(
			([, init]) => (init as RequestInit)?.method === 'DELETE'
		);
		expect(deleteCalls).toHaveLength(0);
	});
});

// ── RED-4: verifyDeleteSafe live callback ─────────────────────────────────────

describe('RED-4: buildLiveCallbacks.verifyDeleteSafe — formula reference + instance-set probe', () => {
	it('returns {safe: true} when no formula references the property and no instances have it set', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Probe 1: search all property-def entities for formula.string containing 'contact_email'
		// Returns 0 — no formula references it
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ entities: [], count: 0 }),
				{ status: 200 }
			)
		);
		// Probe 2: query instances of parent type with this property in result
		// Returns 0 — no instances have it set
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ entities: [], count: 0 }),
				{ status: 200 }
			)
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);
		expect(result.safe).toBe(true);
	});

	it('returns {safe: false, reason} when a formula references the property', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Probe 1: some property-def formula references 'contact_email'
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entities: [{ _id: 'some-prop-def-id', formula: [{ string: 'organization.contact_email' }] }],
					count: 1
				}),
				{ status: 200 }
			)
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);
		expect(result.safe).toBe(false);
		expect(result.reason).toMatch(/formula/i);
	});

	it('returns {safe: false, reason} when instances have the property set', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Probe 1: no formula references it
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// Probe 2: some organization instances still have contact_email set
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entities: [{ _id: 'org-1', contact_email: [{ string: 'info@example.com' }] }],
					count: 1
				}),
				{ status: 200 }
			)
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);
		expect(result.safe).toBe(false);
		expect(result.reason).toBeDefined();
	});

	it('no longer returns {safe: false} with the stub reason "not yet wired"', async () => {
		// Guard: stub must be replaced. If verifyDeleteSafe still returns the scaffold stub reason,
		// this test fails — prompting the GREEN implementer to wire the real probe.
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Both probes return empty (safe scenario)
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);
		expect(result.reason ?? '').not.toContain('not yet wired');
	});

	// RED-v8: verify_then_delete materialized name check.
	// Q4 probe showed: person with no forename/surname has name=" " (single space —
	// formula evaluated against empty sources). Deleting forename/surname from such a
	// person would freeze " " as their permanent name. verifyDeleteSafe must reject
	// deletion when the dependent formula value fails /\S/ (has no non-whitespace chars).
	// The op carries materializedNameProperty: 'name' to trigger this probe.
	describe('verify_then_delete: materialized name must pass /\\S/ before deletion', () => {
		it('returns {safe: true} when person.name is "Test User" (non-whitespace present)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			// Probe 1 (formula ref check): no formula references 'forename'
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			// Probe 2 (instance set): no instances still have forename set
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			// Probe 3 (materialized name check): instances with their name property
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'person-1', name: [{ string: 'Test User' }] }],
						count: 1
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: DeletePropertyOp & { materializedNameProperty?: string } = {
				kind: 'DELETE_PROPERTY',
				parentType: 'person',
				propertyName: 'forename',
				propertyDefId: 'person-forename-prop-id',
				verifyPreconditions: true,
				materializedNameProperty: 'name'
			};

			const result = await cbs.verifyDeleteSafe(client, op);
			expect(result.safe).toBe(true);
		});

		it('returns {safe: false, reason} when person.name is " " (whitespace-only)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			// Probe 1: no formula ref
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			// Probe 2: no instances with prop set
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			// Probe 3: person has whitespace-only materialized name
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'person-2', name: [{ string: ' ' }] }],
						count: 1
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: DeletePropertyOp & { materializedNameProperty?: string } = {
				kind: 'DELETE_PROPERTY',
				parentType: 'person',
				propertyName: 'forename',
				propertyDefId: 'person-forename-prop-id',
				verifyPreconditions: true,
				materializedNameProperty: 'name'
			};

			const result = await cbs.verifyDeleteSafe(client, op);
			expect(result.safe).toBe(false);
			expect(result.reason).toMatch(/whitespace|empty|name/i);
		});

		it('returns {safe: false, reason} when person.name is "" (empty string)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'person-3', name: [{ string: '' }] }],
						count: 1
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: DeletePropertyOp & { materializedNameProperty?: string } = {
				kind: 'DELETE_PROPERTY',
				parentType: 'person',
				propertyName: 'forename',
				propertyDefId: 'person-forename-prop-id',
				verifyPreconditions: true,
				materializedNameProperty: 'name'
			};

			const result = await cbs.verifyDeleteSafe(client, op);
			expect(result.safe).toBe(false);
		});

		it('returns {safe: true} when person.name is "A" (single non-whitespace char)', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch');
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
			);
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						entities: [{ _id: 'person-4', name: [{ string: 'A' }] }],
						count: 1
					}),
					{ status: 200 }
				)
			);

			const cbs = buildLiveCallbacks(client);
			const op: DeletePropertyOp & { materializedNameProperty?: string } = {
				kind: 'DELETE_PROPERTY',
				parentType: 'person',
				propertyName: 'forename',
				propertyDefId: 'person-forename-prop-id',
				verifyPreconditions: true,
				materializedNameProperty: 'name'
			};

			const result = await cbs.verifyDeleteSafe(client, op);
			expect(result.safe).toBe(true);
		});
	});

	// RED-v7 Test 1: Probe 1 must use q= (substring) not formula.string= (exact match).
	// formula.string=forename returns 0 because Entu's = operator requires the ENTIRE value
	// to equal "forename". Real formulas are expressions like "forename ' ' surname" — exact
	// match never fires. Must use q= which does substring matching.
	it('Probe 1 uses q= substring search, not formula.string= exact match', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Discriminating mock: formula.string= returns 0 (Entu exact-match behavior),
		// q= returns 2 (substring hits — the real check).
		fetchMock.mockImplementation(async (url: RequestInfo) => {
			const urlStr = String(url);
			if (urlStr.includes('formula.string=forename')) {
				// Entu exact-match: "forename" !== "forename ' ' surname" → 0 results
				return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
			}
			if (urlStr.includes('q=forename')) {
				// Substring match returns formulas that contain "forename" as a token
				return new Response(
					JSON.stringify({
						entities: [
							{ _id: 'name-prop-def', formula: [{ string: "forename ' ' surname" }] },
							{ _id: 'display-prop-def', formula: [{ string: 'forename CONCAT' }] }
						],
						count: 2
					}),
					{ status: 200 }
				);
			}
			// Probe 2 (instance check) — not reached if Probe 1 already returns unsafe
			return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'person',
			propertyName: 'forename',
			propertyDefId: 'person-forename-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);

		// Must detect the formula reference — safe: true here means the bug is present
		expect(result.safe).toBe(false);

		// The fetch that found the formulas must use q=, not formula.string=
		const formulaProbeCall = fetchMock.mock.calls.find(
			([url]) => typeof url === 'string' && String(url).includes('q=forename')
		);
		expect(formulaProbeCall).toBeDefined();
		// Must NOT have used formula.string= as the finding mechanism
		const exactMatchCall = fetchMock.mock.calls.find(
			([url]) => typeof url === 'string' && String(url).includes('formula.string=forename')
		);
		// If safe is false AND only formula.string= was used, the result is a false negative
		// (formula.string= always returns 0 in production → verifyDeleteSafe would wrongly return safe:true)
		if (exactMatchCall && !formulaProbeCall) {
			throw new Error(
				'verifyDeleteSafe used formula.string= exact match — will return safe:true in production ' +
				'because no formula value literally equals the property name'
			);
		}
	});

	// RED-v7 Test 2: q= results must be post-filtered with word-boundary regex.
	// q=email returns substring hits including "member_email_legacy" which is NOT a reference
	// to the "email" property — it's a different token. Only whole-word matches count.
	it('Probe 1 post-filters q= results with word-boundary regex, not raw substring', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// q=email returns 2 candidates — only 1 is a real word-boundary match
		fetchMock.mockImplementation(async (url: RequestInfo) => {
			const urlStr = String(url);
			if (urlStr.includes('q=email')) {
				return new Response(
					JSON.stringify({
						entities: [
							// Real match: "person.email" contains "email" as a whole token (bounded by ".")
							{ _id: 'contact-prop-def', formula: [{ string: 'person.email CONCAT' }] },
							// Substring-only: "email" appears inside "member_email_legacy" — NOT a ref to "email" prop
							{ _id: 'legacy-prop-def', formula: [{ string: 'member_email_legacy' }] }
						],
						count: 2
					}),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'member',
			propertyName: 'email',
			propertyDefId: 'member-email-prop-id',
			verifyPreconditions: true
		};

		const result = await cbs.verifyDeleteSafe(client, op);

		// Must be unsafe (1 real word-boundary match found)
		expect(result.safe).toBe(false);
		// Reason must mention exactly 1 matching property-def — the legacy substring is excluded
		expect(result.reason).toMatch(/1\s*(property|prop)/i);
	});
});

// ── RED v10 integration: multi-value pre-delete guard reaches live path ───────
//
// These tests exercise buildLiveCallbacks end-to-end via fetch mocks (no data-migrator spy).
// They will be RED until buildLiveCallbacks.migrateProperty delegates to
// data-migrator.migrateProperty, because only that path invokes pruneExistingTarget.
//
// (*MVOX:Tallis*)

describe('RED v10 integration: live-mode multi-value pre-delete guard', () => {
	it('DELETEs stale target property value before POSTing new value', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// List section instances — section-1 already has a stale voice reference
		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			// listInstances for section
			if (urlStr.includes('_type.string=section') || urlStr.includes('_type.reference=')) {
				return new Response(
					JSON.stringify({
						entities: [
							{
								_id: 'section-1',
								voice_type: [{ type: 'string', string: 'soprano' }],
								// Stale voice reference already present — triggers pruneExistingTarget
								voice: [{ _id: 'stale-voice-ref', type: 'reference', reference: 'old-voice-id' }]
							}
						],
						count: 1
					}),
					{ status: 200 }
				);
			}
			// Voice name lookup
			if (urlStr.includes('name.string=soprano')) {
				return new Response(
					JSON.stringify({ entities: [{ _id: 'soprano-voice-id' }], count: 1 }),
					{ status: 200 }
				);
			}
			// DELETE /property/{id} — property-VALUE delete (pruneExistingTarget path)
			if (init?.method === 'DELETE' && urlStr.includes('/property/')) {
				return new Response(JSON.stringify({ deleted: true }), { status: 200 });
			}
			// POST /entity/{id} — target property write
			if (init?.method === 'POST' && urlStr.includes('/entity/section-1')) {
				return new Response(
					JSON.stringify({ _id: 'section-1', properties: [{ _id: 'new-voice-prop-id' }] }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference'
		};

		await cbs.migrateProperty(client, op);

		// Must have called DELETE /property/stale-voice-ref (property-VALUE delete, not /entity/)
		const deleteCall = fetchMock.mock.calls.find(
			([url, init]) =>
				(init as RequestInit)?.method === 'DELETE' &&
				String(url).includes('/property/stale-voice-ref')
		);
		expect(deleteCall).toBeDefined();

		// DELETE must come before POST to /entity/section-1
		const deleteCalls = fetchMock.mock.calls
			.map((call, i) => ({ call, i }))
			.filter(({ call: [url, init] }) =>
				(init as RequestInit)?.method === 'DELETE' &&
				String(url).includes('/property/stale-voice-ref')
			);
		const postCalls = fetchMock.mock.calls
			.map((call, i) => ({ call, i }))
			.filter(({ call: [url, init] }) =>
				(init as RequestInit)?.method === 'POST' &&
				String(url).includes('/entity/section-1')
			);

		expect(deleteCalls[0].i).toBeLessThan(postCalls[0].i);
	});

	it('skips DELETE and POST when target already matches source (idempotency-skip)', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// section-1 already has voice=soprano-voice-id — matches what we'd write
		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			// listInstances for section
			if (urlStr.includes('_type.string=section') || urlStr.includes('_type.reference=')) {
				return new Response(
					JSON.stringify({
						entities: [
							{
								_id: 'section-1',
								voice_type: [{ type: 'string', string: 'soprano' }],
								// voice already points to soprano-voice-id — idempotent skip path
								voice: [{ _id: 'current-voice-ref', type: 'reference', reference: 'soprano-voice-id' }]
							}
						],
						count: 1
					}),
					{ status: 200 }
				);
			}
			// Voice name lookup — returns same entity that's already in voice
			if (urlStr.includes('name.string=soprano')) {
				return new Response(
					JSON.stringify({ entities: [{ _id: 'soprano-voice-id' }], count: 1 }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference'
		};

		await cbs.migrateProperty(client, op);

		// Must NOT have called DELETE — no stale cleanup on idempotent instances
		const deleteCall = fetchMock.mock.calls.find(
			([, init]) => (init as RequestInit)?.method === 'DELETE'
		);
		expect(deleteCall).toBeUndefined();

		// Must NOT have called POST to write a new property
		const postCall = fetchMock.mock.calls.find(
			([url, init]) =>
				(init as RequestInit)?.method === 'POST' &&
				String(url).includes('/entity/section-1')
		);
		expect(postCall).toBeUndefined();
	});
});

// ── RED YELLOW-13 (#54): verifyDeleteSafe Probe 2 limit undercount ────────────
//
// polyphony has 116 member instances; limit=10 means only 10 are checked.
// Probe 2 URL must use limit=500 so all instances are scanned.
//
// (*MVOX:Tallis*)

describe('RED YELLOW-13: verifyDeleteSafe Probe 2 must use limit=500 (not limit=10)', () => {
	it('Probe 2 instance URL contains limit=500', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// Probe 1: no formula references the property
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// Probe 2: instance scan — return empty (safe)
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'member',
			propertyName: 'joined_at',
			propertyDefId: 'member-joined-at-prop-id',
			verifyPreconditions: true
		};

		await cbs.verifyDeleteSafe(client, op);

		// Probe 2 is the second fetch call — it must include limit=500
		const probe2Url = String(fetchMock.mock.calls[1][0]);
		expect(probe2Url).toContain('limit=500');
		expect(probe2Url).not.toContain('limit=10');
	});
});

// ── RED YELLOW-12 (#52): updateFormula bare-catch swallows DELETE failures ────
//
// Current: try/catch wraps BOTH fetchEntityJson (GET) and the DELETE loop.
// Bug: if GET succeeds but DELETE throws mid-loop, the catch absorbs it.
// The subsequent POST then appends the new formula alongside the un-deleted old
// value — re-introducing Q5 multi-value pollution.
//
// Required: try/catch scopes only the GET. DELETE failures must propagate.
//
// (*MVOX:Tallis*)

describe('RED YELLOW-12: updateFormula must propagate DELETE failures (not swallow them)', () => {
	it('rejects and does not call postEntityProperty when a pre-delete DELETE throws', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// GET: prop-def has 2 existing formula values
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entity: {
						_id: 'section-member-count-prop-id',
						formula: [
							{ _id: 'f1', string: 'old-formula-a' },
							{ _id: 'f2', string: 'old-formula-b' }
						]
					}
				}),
				{ status: 200 }
			)
		);
		// DELETE f1: succeeds
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 })
		);
		// DELETE f2: fails (non-2xx triggers throw inside deletePropertyByIdLive)
		fetchMock.mockResolvedValueOnce(
			new Response('Internal Server Error', { status: 500 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'section-member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		// The DELETE failure must propagate — updateFormula must reject
		await expect(cbs.updateFormula(client, op)).rejects.toThrow();

		// POST must NOT be called — no formula appended over stale values
		const postCall = fetchMock.mock.calls.find(
			([, init]) => (init as RequestInit)?.method === 'POST'
		);
		expect(postCall).toBeUndefined();
	});
});

// ── RED v13: property-value DELETE must use /property/{id}, not /entity/{id} ──
//
// Wire-shape bug (#56): deletePropertyByIdLive uses /entity/{id} for ALL callers.
// Correct:
//   - op-level deleteProperty (prop-def delete): DELETE /entity/{propertyDefId}  [v12 Bug-1, unchanged]
//   - updateFormula pre-delete loop (formula-value delete): DELETE /property/{id}
//   - migrateProperty injectables.deleteProperty (pruneExistingTarget path): DELETE /property/{id}
//
// (*MVOX:Tallis*)

describe('RED v13.1: updateFormula pre-delete loop uses DELETE /property/{id} for formula values', () => {
	it('pre-delete fetch URL ends with /property/{formulaValueId}, not /entity/{formulaValueId}', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// GET prop-def entity — has one existing formula value
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					entity: {
						_id: 'member-count-prop-id',
						formula: [{ _id: 'fv1', string: '_referrer.member.name COUNT' }]
					}
				}),
				{ status: 200 }
			)
		);
		// DELETE response (whatever endpoint is called)
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 })
		);
		// POST response
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ _id: 'member-count-prop-id', properties: [{ _id: 'new-formula-id' }] }),
				{ status: 200 }
			)
		);

		const cbs = buildLiveCallbacks(client);
		const op: UpdateFormulaOp = {
			kind: 'UPDATE_FORMULA',
			parentType: 'section',
			propertyName: 'member_count',
			propertyDefId: 'member-count-prop-id',
			newFormula: '(_child.member COUNT) (_child.section.member_count SUM) +'
		};

		await cbs.updateFormula(client, op);

		const deleteCall = fetchMock.mock.calls.find(
			([, init]) => (init as RequestInit)?.method === 'DELETE'
		);
		expect(deleteCall).toBeDefined();
		const deleteUrl = String(deleteCall![0]);
		// Must use /property/{id} — formula values are property records, not entities
		expect(deleteUrl).toContain('/property/fv1');
		expect(deleteUrl).not.toContain('/entity/fv1');
	});
});

describe('RED v13.2: migrateProperty injectables.deleteProperty uses DELETE /property/{id} for property values', () => {
	it('pruneExistingTarget DELETE URL ends with /property/{staleValueId}, not /entity/{staleValueId}', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		fetchMock.mockImplementation(async (url: RequestInfo, init?: RequestInit) => {
			const urlStr = String(url);
			// listInstances for section — returns section with a stale voice reference
			if (urlStr.includes('_type.string=section') || urlStr.includes('/entity/')) {
				if (!init?.method || init.method === 'GET') {
					return new Response(
						JSON.stringify({
							entities: [
								{
									_id: 'section-1',
									voice_type: [{ type: 'string', string: 'soprano' }],
									voice: [{ _id: 'stale-pv1', type: 'reference', reference: 'old-voice-id' }]
								}
							],
							count: 1
						}),
						{ status: 200 }
					);
				}
			}
			if (urlStr.includes('name.string=soprano')) {
				return new Response(
					JSON.stringify({ entities: [{ _id: 'soprano-voice-id' }], count: 1 }),
					{ status: 200 }
				);
			}
			if (init?.method === 'DELETE') {
				return new Response(JSON.stringify({ deleted: true }), { status: 200 });
			}
			if (init?.method === 'POST') {
				return new Response(
					JSON.stringify({ _id: 'section-1', properties: [{ _id: 'new-voice-prop-id' }] }),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 });
		});

		const cbs = buildLiveCallbacks(client);
		const op: BackfillDataOp = {
			kind: 'BACKFILL_DATA',
			parentType: 'section',
			sourceProperty: 'voice_type',
			targetProperty: 'voice',
			backfillKind: 'string_to_reference'
		};

		await cbs.migrateProperty(client, op);

		const deleteCall = fetchMock.mock.calls.find(
			([, init]) => (init as RequestInit)?.method === 'DELETE'
		);
		expect(deleteCall).toBeDefined();
		const deleteUrl = String(deleteCall![0]);
		// Must use /property/{id} — stale target property values are property records, not entities
		expect(deleteUrl).toContain('/property/stale-pv1');
		expect(deleteUrl).not.toContain('/entity/stale-pv1');
	});
});

describe('RED v13.3 (regression): op-level deleteProperty still uses DELETE /entity/{propertyDefId}', () => {
	it('DELETE URL ends with /entity/{propertyDefId} — the v12 Bug-1 fix must be preserved', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 })
		);

		const cbs = buildLiveCallbacks(client);
		const op: DeletePropertyOp = {
			kind: 'DELETE_PROPERTY',
			parentType: 'organization',
			propertyName: 'contact_email',
			propertyDefId: 'org-contact-email-prop-id'
		};

		await cbs.deleteProperty(client, op);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		// Prop-def DELETE must still use /entity/{id} — property-def entities ARE entities
		expect(url).toContain('/entity/org-contact-email-prop-id');
		expect(url).not.toContain('/property/');
		expect(init?.method).toBe('DELETE');
	});
});
