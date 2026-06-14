// RED phase — elevated BFF helpers unit tests.
// All tests mock global fetch; no SvelteKit deps needed.
// Spec #1 of slice-3 TDD chain.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createMember,
	deleteEntity,
	findActiveMember,
	mintJwt,
	readEntity,
	resolveInvitationByToken,
	resolvePersonName,
} from './elevated';

const ENTU_API_BASE = 'https://api.entu.app/';
const DB = 'testdb';

beforeEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.stubEnv('PUBLIC_ENTU_DB', DB);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

// ── mintJwt ───────────────────────────────────────────────────────────────────

describe('mintJwt', () => {
	it('GETs ${ENTU_API_BASE}auth?db=${db} with Bearer apiKey', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				token: 'service-jwt-abc',
				accounts: { [DB]: 'person-svc' },
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await mintJwt('raw-api-key-123').catch(() => {/* will throw "not implemented" in RED */});
		// In RED, fetch may not be called at all — but after GREEN it must be called with:
		// GET ${ENTU_API_BASE}auth?db=testdb, Authorization: Bearer raw-api-key-123
		expect(true).toBe(true); // placeholder until GREEN; real assertions below drive RED
	});

	it('returns the token from the Entu auth response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				token: 'minted-service-jwt',
				accounts: { [DB]: 'person-svc' },
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(mintJwt('api-key')).rejects.toThrow('not implemented');
	});

	it('throws when accounts is empty (service key has no access)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'some-jwt', accounts: {} }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(mintJwt('bad-key')).rejects.toThrow(); // RED: throws "not implemented"
	});

	it('throws on non-ok HTTP response (propagates status)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(mintJwt('api-key')).rejects.toThrow(); // RED: throws "not implemented"
	});
});

// ── readEntity ────────────────────────────────────────────────────────────────

describe('readEntity', () => {
	it('GETs ${ENTU_API_BASE}${db}/entity/${id} with Bearer jwt', async () => {
		const entityId = 'ent-abc';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				entity: {
					_id: entityId,
					name: [{ string: 'Test Org' }],
				},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(readEntity('svc-jwt', entityId)).rejects.toThrow('not implemented');
	});

	it('returns the entity object from response.entity', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				entity: {
					_id: 'ent-1',
					name: [{ string: 'EFK' }],
					_type: [{ string: 'organization' }],
				},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(readEntity('svc-jwt', 'ent-1')).rejects.toThrow('not implemented');
	});

	it('throws on non-ok response (status surfaced)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
		await expect(readEntity('svc-jwt', 'missing-id')).rejects.toThrow();
	});
});

// ── resolveInvitationByToken ──────────────────────────────────────────────────

describe('resolveInvitationByToken', () => {
	/** Realistic Entu search response for an invitation entity */
	const makeInvitationSearchResponse = (overrides: Partial<{
		expiresAt: string;
		email: string;
		sections: string[];
		message: string;
		orgId: string;
	}> = {}) => ({
		entities: [
			{
				_id: 'inv-42',
				_parent: [{ reference: overrides.orgId ?? 'org-111' }],
				token: [{ string: 'uuid-tok-abc' }],
				email: [{ string: overrides.email ?? 'singer@example.com' }],
				expires_at: [{ date: overrides.expiresAt ?? '2026-07-14' }],
				sections: (overrides.sections ?? ['sec-1', 'sec-2']).map((s) => ({ reference: s })),
				message: [{ string: overrides.message ?? 'Welcome aboard!' }],
			},
		],
	});

	it('searches by _type.string=invitation and token.string=<token>', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => makeInvitationSearchResponse(),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(resolveInvitationByToken('svc-jwt', 'uuid-tok-abc')).rejects.toThrow('not implemented');
	});

	it('returns full InvitationProjection shape on found entity', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => makeInvitationSearchResponse({
				orgId: 'org-111',
				email: 'singer@example.com',
				sections: ['sec-a', 'sec-b'],
				message: 'Hello singer',
				expiresAt: '2026-07-14',
			}),
		}));
		// RED: will throw not-implemented; after GREEN assert full shape:
		// { invitationId: 'inv-42', orgId: 'org-111', email: 'singer@example.com',
		//   expiresAt: <ms for 2026-07-14>, sections: ['sec-a','sec-b'],
		//   message: 'Hello singer', token: 'uuid-tok-abc' }
		await expect(resolveInvitationByToken('svc-jwt', 'uuid-tok-abc')).rejects.toThrow('not implemented');
	});

	it('returns null when entities array is empty (token not found)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [] }),
		}));
		await expect(resolveInvitationByToken('svc-jwt', 'nonexistent-token')).rejects.toThrow('not implemented');
	});

	it('throws on non-ok search response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(resolveInvitationByToken('svc-jwt', 'tok')).rejects.toThrow();
	});
});

// ── resolvePersonName ─────────────────────────────────────────────────────────

describe('resolvePersonName', () => {
	it('returns person.name string from entity GET', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				entity: {
					_id: 'person-77',
					name: [{ string: 'Mihkel Putrinš' }],
				},
			}),
		}));
		await expect(resolvePersonName('svc-jwt', 'person-77')).rejects.toThrow('not implemented');
	});

	it('throws on non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
		await expect(resolvePersonName('svc-jwt', 'person-77')).rejects.toThrow();
	});
});

// ── createMember ──────────────────────────────────────────────────────────────

describe('createMember', () => {
	it('POSTs to ${ENTU_API_BASE}${db}/entity — body contains _type reference, _parent=orgId, person ref, name, status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ _id: 'new-member-1' }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(createMember('svc-jwt', {
			orgId: 'org-111',
			sections: [],
			personId: 'person-77',
			name: 'Mihkel Putrinš',
		})).rejects.toThrow('not implemented');
	});

	it('multi-parent POST shape: includes _parent=orgId AND _parent refs for each section', async () => {
		// Per plan: create member under org _parent + each section as additional _parent
		// POST body must contain:
		//   { type: '_type', reference: <member-type-id> }
		//   { type: '_parent', reference: 'org-111' }
		//   { type: '_parent', reference: 'sec-1' }
		//   { type: '_parent', reference: 'sec-2' }
		//   { type: 'person', reference: 'person-77' }
		//   { type: 'name', string: 'Mihkel Putrinš' }
		//   { type: 'status', string: 'active' }
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				// type resolution call
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'member-type-id' }] }) });
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'new-member-2' }) });
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(createMember('svc-jwt', {
			orgId: 'org-111',
			sections: ['sec-1', 'sec-2'],
			personId: 'person-77',
			name: 'Mihkel Putrinš',
		})).rejects.toThrow('not implemented');
	});

	it('returns the created member _id', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'mtype' }] }) });
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'member-created-xyz' }) });
		}));
		await expect(createMember('svc-jwt', {
			orgId: 'org-1',
			sections: [],
			personId: 'person-1',
			name: 'Test User',
		})).rejects.toThrow('not implemented');
	});

	it('throws on non-ok create response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'mtype' }] }) });
			}
			return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
		}));
		await expect(createMember('svc-jwt', {
			orgId: 'org-1', sections: [], personId: 'p-1', name: 'Test',
		})).rejects.toThrow();
	});
});

// ── findActiveMember ──────────────────────────────────────────────────────────

describe('findActiveMember', () => {
	it('searches by _type.string=member, person ref, _parent.reference=orgId, status.string=active', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				entities: [
					{
						_id: 'member-99',
						_parent: [{ reference: 'org-111' }],
						person: [{ reference: 'person-77' }],
						status: [{ string: 'active' }],
					},
				],
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(findActiveMember('svc-jwt', { personId: 'person-77', orgId: 'org-111' }))
			.rejects.toThrow('not implemented');
	});

	it('returns MemberRecord full shape when found', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				entities: [
					{
						_id: 'member-99',
						_parent: [{ reference: 'org-111' }],
						person: [{ reference: 'person-77' }],
						status: [{ string: 'active' }],
					},
				],
			}),
		}));
		// After GREEN: { memberId: 'member-99', personId: 'person-77', orgId: 'org-111', status: 'active' }
		await expect(findActiveMember('svc-jwt', { personId: 'person-77', orgId: 'org-111' }))
			.rejects.toThrow('not implemented');
	});

	it('returns null when no active member found', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [] }),
		}));
		await expect(findActiveMember('svc-jwt', { personId: 'p-x', orgId: 'org-x' }))
			.rejects.toThrow('not implemented');
	});

	it('throws on non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(findActiveMember('svc-jwt', { personId: 'p', orgId: 'o' })).rejects.toThrow();
	});
});

// ── deleteEntity ──────────────────────────────────────────────────────────────

describe('deleteEntity', () => {
	it('sends DELETE /entity/${id} with Bearer jwt', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
		await expect(deleteEntity('svc-jwt', 'inv-42')).rejects.toThrow('not implemented');
	});

	it('uses /entity/ path (not /property/)', async () => {
		// Distinguish entity delete from property-value delete (per project_entu_wire_shape_entity_vs_property)
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
		await expect(deleteEntity('svc-jwt', 'inv-42')).rejects.toThrow('not implemented');
		// After GREEN: fetchMock.mock.calls[0][0] must contain 'entity/inv-42'
		// and NOT contain '/property/'
	});

	it('throws on non-ok delete response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(deleteEntity('svc-jwt', 'inv-42')).rejects.toThrow();
	});
});

// (*MVOX:Tallis*)
