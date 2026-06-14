// RED phase — elevated BFF helpers unit tests.
// All tests mock global fetch; no SvelteKit deps needed.
// `db` is passed explicitly (helpers are pure — no $env import inside elevated.ts).
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

const DB = 'testdb';
const ENTU_API_BASE = 'https://api.entu.app/';

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

// ── mintJwt ───────────────────────────────────────────────────────────────────

describe('mintJwt', () => {
	it('GETs ${ENTU_API_BASE}auth?db=${db} with Authorization: Bearer apiKey', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'svc-jwt', accounts: { [DB]: 'person-svc' } }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await mintJwt('raw-api-key-123', DB);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${ENTU_API_BASE}auth?db=${DB}`);
		expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer raw-api-key-123');
	});

	it('returns the token string from response.token', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'minted-svc-jwt', accounts: { [DB]: 'svc-person' } }),
		}));
		// RED: stub throws; GREEN must return 'minted-svc-jwt'
		const result = await mintJwt('api-key', DB).catch(() => null);
		expect(result).toBe('minted-svc-jwt');
	});

	it('uses correct URL shape: ${ENTU_API_BASE}auth?db=${db}', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'tok', accounts: { [DB]: 'p' } }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await mintJwt('api-key', DB);
		const url = (fetchMock.mock.calls[0] as [string])[0];
		expect(url).toBe(`${ENTU_API_BASE}auth?db=${DB}`);
	});

	it('sends Authorization: Bearer <apiKey> header', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'tok', accounts: { [DB]: 'p' } }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await mintJwt('api-key-XYZ', DB);
		const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
		expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer api-key-XYZ');
	});

	it('throws when accounts is empty (service key has no db access)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ token: 'tok', accounts: {} }),
		}));
		// RED stub throws "not implemented"; GREEN must throw specifically for empty accounts
		await expect(mintJwt('bad-key', DB)).rejects.toThrow();
	});

	it('throws on non-ok HTTP response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false, status: 401, json: async () => ({}),
		}));
		await expect(mintJwt('api-key', DB)).rejects.toThrow();
	});
});

// ── readEntity ────────────────────────────────────────────────────────────────

describe('readEntity', () => {
	it('GETs ${ENTU_API_BASE}${db}/entity/${id} with Bearer jwt', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entity: { _id: 'ent-abc' } }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await readEntity('svc-jwt', DB, 'ent-abc');
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${ENTU_API_BASE}${DB}/entity/ent-abc`);
		expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer svc-jwt');
	});

	it('returns the entity object from response.entity', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entity: { _id: 'ent-1', name: [{ string: 'EFK' }] } }),
		}));
		// RED: throws → catch → null; GREEN must return the entity object
		const result = await readEntity('svc-jwt', DB, 'ent-1').catch(() => null);
		expect(result).toEqual({ _id: 'ent-1', name: [{ string: 'EFK' }] });
	});

	it('throws on non-ok response (status surfaced)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
		await expect(readEntity('svc-jwt', DB, 'missing-id')).rejects.toThrow();
	});
});

// ── resolveInvitationByToken ──────────────────────────────────────────────────

describe('resolveInvitationByToken', () => {
	function makeSearchResponse(opts: {
		orgId?: string; email?: string; sections?: string[];
		message?: string; expiresAt?: string; token?: string;
	} = {}) {
		return {
			entities: [{
				_id: 'inv-42',
				_parent: [{ reference: opts.orgId ?? 'org-111' }],
				token: [{ string: opts.token ?? 'uuid-tok-abc' }],
				email: [{ string: opts.email ?? 'singer@example.com' }],
				expires_at: [{ date: opts.expiresAt ?? '2099-07-14' }],
				sections: (opts.sections ?? ['sec-1', 'sec-2']).map((s) => ({ reference: s })),
				message: [{ string: opts.message ?? 'Welcome!' }],
			}],
		};
	}

	it('searches with _type.string=invitation and token.string=<token>', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true, json: async () => makeSearchResponse(),
		});
		vi.stubGlobal('fetch', fetchMock);
		await resolveInvitationByToken('svc-jwt', DB, 'uuid-tok-abc');
		const url = (fetchMock.mock.calls[0] as [string])[0];
		expect(url).toContain('_type.string=invitation');
		expect(url).toContain('uuid-tok-abc');
	});

	it('returns full InvitationProjection toEqual when found', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => makeSearchResponse({
				orgId: 'org-111', email: 'singer@example.com',
				sections: ['sec-a', 'sec-b'], message: 'Hello singer',
				token: 'uuid-tok-abc', expiresAt: '2099-07-14',
			}),
		}));
		// RED: throws → null; GREEN must return the full shape
		const result = await resolveInvitationByToken('svc-jwt', DB, 'uuid-tok-abc').catch(() => null);
		expect(result).toEqual({
			invitationId: 'inv-42',
			orgId: 'org-111',
			email: 'singer@example.com',
			expiresAt: new Date('2099-07-14').getTime(),
			sections: ['sec-a', 'sec-b'],
			message: 'Hello singer',
			token: 'uuid-tok-abc',
		});
	});

	it('returns null when entities array is empty (not found)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ entities: [] }),
		}));
		// RED: throws → 'threw'; GREEN must return null
		const result = await resolveInvitationByToken('svc-jwt', DB, 'nonexistent').catch(() => 'threw');
		expect(result).toBeNull();
	});

	it('throws on non-ok search response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(resolveInvitationByToken('svc-jwt', DB, 'tok')).rejects.toThrow();
	});
});

// ── resolvePersonName ─────────────────────────────────────────────────────────

describe('resolvePersonName', () => {
	it('returns person.name string from entity GET', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entity: { _id: 'person-77', name: [{ string: 'Mihkel Putrinš' }] } }),
		}));
		// RED: throws → null; GREEN must return 'Mihkel Putrinš'
		const result = await resolvePersonName('svc-jwt', DB, 'person-77').catch(() => null);
		expect(result).toBe('Mihkel Putrinš');
	});

	it('throws on non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
		await expect(resolvePersonName('svc-jwt', DB, 'person-77')).rejects.toThrow();
	});
});

// ── createMember ──────────────────────────────────────────────────────────────

describe('createMember', () => {
	function makeTypeFetchMock(createdId = 'new-member-1') {
		return vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'member-type-id' }] }) });
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: createdId }) });
		});
	}

	it('POST body exact shape — _type ref, _parent=orgId, person ref, name, status=active (no sections)', async () => {
		const fetchMock = makeTypeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createMember('svc-jwt', DB, {
			orgId: 'org-111', sections: [], personId: 'person-77', name: 'Mihkel Putrinš',
		});
		const postCall = (fetchMock.mock.calls as Array<[string, { method?: string; body?: string }]>)
			.find(([, init]) => init?.method === 'POST');
		expect(postCall).toBeDefined();
		const body = JSON.parse(postCall?.[1].body ?? '[]') as Array<{ type: string; reference?: string; string?: string }>;
		expect(body).toEqual(expect.arrayContaining([
			{ type: '_type', reference: 'member-type-id' },
			{ type: '_parent', reference: 'org-111' },
			{ type: 'person', reference: 'person-77' },
			{ type: 'name', string: 'Mihkel Putrinš' },
			{ type: 'status', string: 'active' },
		]));
		const parentRefs = body.filter((p) => p.type === '_parent');
		expect(parentRefs).toHaveLength(1); // only orgId — no sections
	});

	it('multi-parent POST: _parent=orgId AND one _parent per section (3 total for 2 sections)', async () => {
		const fetchMock = makeTypeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createMember('svc-jwt', DB, {
			orgId: 'org-111', sections: ['sec-1', 'sec-2'], personId: 'person-77', name: 'Test',
		});
		const postCall = (fetchMock.mock.calls as Array<[string, { method?: string; body?: string }]>)
			.find(([, init]) => init?.method === 'POST');
		expect(postCall).toBeDefined();
		const body = JSON.parse(postCall?.[1].body ?? '[]') as Array<{ type: string; reference?: string }>;
		const parentRefs = body.filter((p) => p.type === '_parent').map((p) => p.reference);
		expect(parentRefs).toHaveLength(3); // org + 2 sections
		expect(parentRefs).toContain('org-111');
		expect(parentRefs).toContain('sec-1');
		expect(parentRefs).toContain('sec-2');
	});

	it('returns the created member _id', async () => {
		vi.stubGlobal('fetch', makeTypeFetchMock('member-xyz'));
		// RED: throws → null; GREEN must return 'member-xyz'
		const result = await createMember('svc-jwt', DB, {
			orgId: 'org-1', sections: [], personId: 'p-1', name: 'Test',
		}).catch(() => null);
		expect(result).toBe('member-xyz');
	});

	it('throws on non-ok create response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'mtype' }] }) });
			}
			return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
		}));
		await expect(createMember('svc-jwt', DB, {
			orgId: 'o', sections: [], personId: 'p', name: 'T',
		})).rejects.toThrow();
	});
});

// ── findActiveMember ──────────────────────────────────────────────────────────

describe('findActiveMember', () => {
	const memberEntity = {
		_id: 'member-99',
		_parent: [{ reference: 'org-111' }],
		person: [{ reference: 'person-77' }],
		status: [{ string: 'active' }],
	};

	it('URL contains _type.string=member, person ref, _parent.reference=orgId, status.string=active', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ entities: [memberEntity] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await findActiveMember('svc-jwt', DB, { personId: 'person-77', orgId: 'org-111' });
		const url = (fetchMock.mock.calls[0] as [string])[0];
		expect(url).toContain('_type.string=member');
		expect(url).toContain('person-77');
		expect(url).toContain('org-111');
		expect(url).toContain('status.string=active');
	});

	it('returns MemberRecord full shape { memberId, personId, orgId, status }', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ entities: [memberEntity] }),
		}));
		// RED: throws → null; GREEN must return the shape
		const result = await findActiveMember('svc-jwt', DB, { personId: 'person-77', orgId: 'org-111' })
			.catch(() => null);
		expect(result).toEqual({
			memberId: 'member-99',
			personId: 'person-77',
			orgId: 'org-111',
			status: 'active',
		});
	});

	it('returns null when entities empty (no active member)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ entities: [] }),
		}));
		// RED: throws → 'threw'; GREEN must return null
		const result = await findActiveMember('svc-jwt', DB, { personId: 'p', orgId: 'o' })
			.catch(() => 'threw');
		expect(result).toBeNull();
	});

	it('throws on non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(findActiveMember('svc-jwt', DB, { personId: 'p', orgId: 'o' })).rejects.toThrow();
	});
});

// ── deleteEntity ──────────────────────────────────────────────────────────────

describe('deleteEntity', () => {
	it('sends DELETE to /entity/{id} path (NOT /property/{id}), Authorization: Bearer jwt', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
		await deleteEntity('svc-jwt', DB, 'inv-42');
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain(`${DB}/entity/inv-42`);
		expect(url).not.toContain('/property/');
		expect(init?.method).toBe('DELETE');
		expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer svc-jwt');
	});

	it('throws on non-ok delete response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
		await expect(deleteEntity('svc-jwt', DB, 'inv-42')).rejects.toThrow();
	});
});

// (*MVOX:Tallis*)
