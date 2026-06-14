// GREEN phase — client-side invite data helpers.
// Mirrors rsvpData.spec.ts patterns: vi.stubGlobal fetch, type-resolution call, prop-array POST.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	acceptInvite,
	buildInviteUrl,
	createApplication,
	createInvitation,
	listOrgInvitations,
	resolveInvite,
} from './inviteData';
import { resetTypeIdCache } from '$lib/seasons/entuSeasons';

const cfg = { db: 'testdb', token: 'user-jwt' };

beforeEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	resetTypeIdCache();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── createInvitation ──────────────────────────────────────────────────────────

describe('createInvitation', () => {
	/** Build fetch mock: type resolution + entity create */
	function makeFetchMock(typeId = 'invitation-type-id', createdId = 'inv-new-1') {
		return vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: typeId }] }) });
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: createdId }) });
		});
	}

	it('POST body contains _type reference, _parent=orgId, email, token (UUID), expires_at (+30d), status=active', async () => {
		const fetchMock = makeFetchMock('inv-type-42');
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, {
			orgId: 'org-111',
			email: 'singer@example.com',
			inviterPersonId: 'person-owner',
		});
		// Find the entity-create POST call (second call — first is type resolution)
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		expect(postCall).toBeDefined();
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'inv-type-42' },
				{ type: '_parent', reference: 'org-111' },
				{ type: 'email', string: 'singer@example.com' },
				expect.objectContaining({ type: 'token', string: expect.any(String) }),
				expect.objectContaining({ type: 'expires_at', date: expect.any(String) }),
				{ type: 'status', string: 'active' },
			]),
		);
	});

	it('token value is a crypto.randomUUID()-shaped string (injectable/spy)', async () => {
		const mockUUID = vi
			.spyOn(crypto, 'randomUUID')
			.mockReturnValue(
				'fixed-uuid-for-test' as `${string}-${string}-${string}-${string}-${string}`,
			);
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, {
			orgId: 'org-1',
			email: 'e@test.com',
			inviterPersonId: 'p-owner',
		});
		mockUUID.mockRestore();
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		const tokenProp = body.find((p) => p.type === 'token');
		expect(tokenProp?.string).toBe('fixed-uuid-for-test');
	});

	it('expires_at is approximately now + 30 days', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		const before = Date.now();
		await createInvitation(cfg, {
			orgId: 'org-1',
			email: 'e@test.com',
			inviterPersonId: 'p-owner',
		});
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		const expiresProp = body.find((p) => p.type === 'expires_at');
		const expiresMs = new Date(expiresProp!.date).getTime();
		const expected30d = before + 30 * 24 * 60 * 60 * 1000;
		// Within ±1 day tolerance
		expect(Math.abs(expiresMs - expected30d)).toBeLessThan(24 * 60 * 60 * 1000);
	});

	it('includes optional sections as reference array when provided', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, {
			orgId: 'org-1',
			email: 'e@test.com',
			inviterPersonId: 'p-owner',
			sections: ['sec-1', 'sec-2'],
		});
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: 'sections', reference: 'sec-1' },
				{ type: 'sections', reference: 'sec-2' },
			]),
		);
	});

	it('includes optional message as text string when provided', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, {
			orgId: 'org-1',
			email: 'e@test.com',
			inviterPersonId: 'p-owner',
			message: 'Welcome to the choir!',
		});
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body).toEqual(
			expect.arrayContaining([{ type: 'message', string: 'Welcome to the choir!' }]),
		);
	});

	it('returns { invitationId, token }', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'inv-created-99'));
		const result = await createInvitation(cfg, {
			orgId: 'org-1',
			email: 'e@test.com',
			inviterPersonId: 'p-owner',
		});
		expect(result.invitationId).toBe('inv-created-99');
		expect(typeof result.token).toBe('string');
		expect(result.token.length).toBeGreaterThan(0);
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(
			createInvitation(cfg, { orgId: 'o', email: 'e@t.com', inviterPersonId: 'p' }),
		).rejects.toThrow();
	});
});

// ── buildInviteUrl ────────────────────────────────────────────────────────────

describe('buildInviteUrl', () => {
	it('returns ${origin}/invite/${token}', () => {
		expect(buildInviteUrl('https://mvox.eu', 'abc-token-123')).toBe(
			'https://mvox.eu/invite/abc-token-123',
		);
	});

	it('handles origin without trailing slash', () => {
		expect(buildInviteUrl('https://mvox.eu/', 'tok')).toBe('https://mvox.eu/invite/tok');
	});
});

// ── listOrgInvitations ────────────────────────────────────────────────────────

describe('listOrgInvitations', () => {
	it('queries with _type.string=invitation and _parent.reference=orgId', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ entities: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await listOrgInvitations(cfg, 'org-111');
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain('_type.string=invitation');
		expect(url).toContain('org-111');
	});

	it('maps entities to { invitationId, email, expiresAt, sections } array', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					entities: [
						{
							_id: 'inv-a',
							email: [{ string: 'singer@example.com' }],
							expires_at: [{ date: '2026-07-14' }],
							sections: [{ reference: 'sec-soprano' }],
						},
					],
				}),
			}),
		);
		const result = await listOrgInvitations(cfg, 'org-111');
		expect(result).toEqual([
			{
				invitationId: 'inv-a',
				email: 'singer@example.com',
				expiresAt: new Date('2026-07-14').getTime(),
				sections: ['sec-soprano'],
			},
		]);
	});

	it('returns [] on empty response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ entities: [] }),
			}),
		);
		const result = await listOrgInvitations(cfg, 'org-1');
		expect(result).toEqual([]);
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				json: async () => ({}),
			}),
		);
		await expect(listOrgInvitations(cfg, 'org-1')).rejects.toThrow();
	});
});

// ── resolveInvite ─────────────────────────────────────────────────────────────

describe('resolveInvite', () => {
	it('fetches /api/invite/<token> and returns the projection', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				valid: true,
				expired: false,
				orgName: 'EFK',
				email: 'singer@example.com',
				sections: [],
				message: '',
			}),
		});
		vi.stubGlobal('fetch', fetchMock);
		const result = await resolveInvite('tok-abc');
		expect(result).toEqual({
			valid: true,
			expired: false,
			orgName: 'EFK',
			email: 'singer@example.com',
			sections: [],
			message: '',
		});
	});

	it('URL is /api/invite/<token>', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ valid: false }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await resolveInvite('my-token-xyz');
		expect(fetchMock.mock.calls[0][0]).toBe('/api/invite/my-token-xyz');
	});

	it('returns { valid: false } on 404-shaped response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ valid: false }),
			}),
		);
		const result = await resolveInvite('missing');
		expect(result).toEqual({ valid: false });
	});
});

// ── createApplication ─────────────────────────────────────────────────────────

describe('createApplication', () => {
	function makeFetchMock(typeId = 'app-type-id', createdId = 'app-new-1') {
		return vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: typeId }] }) });
			}
			return Promise.resolve({ ok: true, json: async () => ({ _id: createdId }) });
		});
	}

	it('POST body mirrors createRsvp shape: _type ref, _parent=personId, target_org ref, status, expires_at', async () => {
		const fetchMock = makeFetchMock('app-type-42');
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'person-77', orgId: 'org-111' });
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body).toEqual(
			expect.arrayContaining([
				{ type: '_type', reference: 'app-type-42' },
				{ type: '_parent', reference: 'person-77' },
				{ type: 'target_org', reference: 'org-111' },
				{ type: 'status', string: 'active' },
				expect.objectContaining({ type: 'expires_at', date: expect.any(String) }),
			]),
		);
	});

	it('_parent = personId (application is child of the singer person entity)', async () => {
		// Identity-proof: only the person entity owner can create a child here.
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'person-singer-123', orgId: 'org-111' });
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body).toEqual(
			expect.arrayContaining([{ type: '_parent', reference: 'person-singer-123' }]),
		);
	});

	it('does NOT set _sharing (inherits parent private sharing)', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'p', orgId: 'o' });
		const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
			const [, init] = c as [string, RequestInit | undefined];
			return init?.method === 'POST';
		});
		const body = JSON.parse(postCall![1].body as string) as Array<Record<string, string>>;
		expect(body.some((p) => p.type === '_sharing')).toBe(false);
	});

	it('returns the created applicationId', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'app-created-77'));
		const result = await createApplication(cfg, { personId: 'p', orgId: 'o' });
		expect(result).toBe('app-created-77');
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(createApplication(cfg, { personId: 'p', orgId: 'o' })).rejects.toThrow();
	});
});

// ── acceptInvite ──────────────────────────────────────────────────────────────

describe('acceptInvite', () => {
	it('POSTs to /api/invite/<token>/accept with { applicationId }', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true, orgId: 'org-111' }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await acceptInvite('tok-abc', { applicationId: 'app-99' });
		expect(fetchMock.mock.calls[0][0]).toBe('/api/invite/tok-abc/accept');
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body as string)).toEqual({ applicationId: 'app-99' });
	});

	it('returns the parsed response { ok, orgId }', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ ok: true, orgId: 'org-111' }),
			}),
		);
		const result = await acceptInvite('tok', { applicationId: 'app-1' });
		expect(result).toEqual({ ok: true, orgId: 'org-111' });
	});

	it('throws on non-ok HTTP response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				json: async () => ({}),
			}),
		);
		await expect(acceptInvite('tok', { applicationId: 'app-1' })).rejects.toThrow();
	});
});

// (*MVOX:Tallis*)
