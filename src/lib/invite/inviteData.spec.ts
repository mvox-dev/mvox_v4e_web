// RED phase — client-side invite data helpers.
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
		await expect(
			createInvitation(cfg, {
				orgId: 'org-111',
				email: 'singer@example.com',
				inviterPersonId: 'person-owner',
			}),
		).rejects.toThrow('not implemented');
		// After GREEN: find the entity-create POST call, parse body, assert:
		// [{ type: '_type', reference: 'inv-type-42' },
		//  { type: '_parent', reference: 'org-111' },
		//  { type: 'email', string: 'singer@example.com' },
		//  { type: 'token', string: <UUID> },
		//  { type: 'expires_at', date: <ISO date ~30d from now> },
		//  { type: 'status', string: 'active' }]
	});

	it('token value is a crypto.randomUUID()-shaped string (injectable/spy)', async () => {
		// token = crypto.randomUUID(); tests can spy on crypto.randomUUID to inject known value
		const mockUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid-for-test' as `${string}-${string}-${string}-${string}-${string}`);
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createInvitation(cfg, {
				orgId: 'org-1',
				email: 'e@test.com',
				inviterPersonId: 'p-owner',
			}),
		).rejects.toThrow('not implemented');
		mockUUID.mockRestore();
		// After GREEN: POST body token.string === 'fixed-uuid-for-test'
	});

	it('expires_at is approximately now + 30 days', async () => {
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createInvitation(cfg, {
				orgId: 'org-1',
				email: 'e@test.com',
				inviterPersonId: 'p-owner',
			}),
		).rejects.toThrow('not implemented');
		// After GREEN: parse expires_at date string, assert within ±1 day of now+30d
	});

	it('includes optional sections as reference array when provided', async () => {
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createInvitation(cfg, {
				orgId: 'org-1',
				email: 'e@test.com',
				inviterPersonId: 'p-owner',
				sections: ['sec-1', 'sec-2'],
			}),
		).rejects.toThrow('not implemented');
		// After GREEN: body includes { type: 'sections', reference: 'sec-1' } and { type: 'sections', reference: 'sec-2' }
	});

	it('includes optional message as text string when provided', async () => {
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createInvitation(cfg, {
				orgId: 'org-1',
				email: 'e@test.com',
				inviterPersonId: 'p-owner',
				message: 'Welcome to the choir!',
			}),
		).rejects.toThrow('not implemented');
		// After GREEN: body includes { type: 'message', string: 'Welcome to the choir!' }
	});

	it('returns { invitationId, token }', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'inv-created-99'));
		await expect(
			createInvitation(cfg, {
				orgId: 'org-1',
				email: 'e@test.com',
				inviterPersonId: 'p-owner',
			}),
		).rejects.toThrow('not implemented');
		// After GREEN: { invitationId: 'inv-created-99', token: <uuid string> }
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'type-id' }] }) });
			}
			return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
		}));
		await expect(
			createInvitation(cfg, { orgId: 'o', email: 'e@t.com', inviterPersonId: 'p' }),
		).rejects.toThrow();
	});
});

// ── buildInviteUrl ────────────────────────────────────────────────────────────

describe('buildInviteUrl', () => {
	it('returns ${origin}/invite/${token}', () => {
		expect(() => buildInviteUrl('https://mvox.eu', 'abc-token-123')).toThrow('not implemented');
		// After GREEN: 'https://mvox.eu/invite/abc-token-123'
	});

	it('handles origin without trailing slash', () => {
		expect(() => buildInviteUrl('https://mvox.eu/', 'tok')).toThrow('not implemented');
		// After GREEN: 'https://mvox.eu/invite/tok' (no double slash)
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
		await expect(listOrgInvitations(cfg, 'org-111')).rejects.toThrow('not implemented');
		// After GREEN: assert URL contains '_type.string=invitation' and 'org-111'
	});

	it('maps entities to { invitationId, email, expiresAt, sections } array', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
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
		}));
		await expect(listOrgInvitations(cfg, 'org-111')).rejects.toThrow('not implemented');
		// After GREEN: [{ invitationId: 'inv-a', email: 'singer@example.com',
		//                 expiresAt: <ms>, sections: ['sec-soprano'] }]
	});

	it('returns [] on empty response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ entities: [] }),
		}));
		await expect(listOrgInvitations(cfg, 'org-1')).rejects.toThrow('not implemented');
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false, status: 403, json: async () => ({}),
		}));
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
		await expect(resolveInvite('tok-abc')).rejects.toThrow('not implemented');
		// After GREEN: returns the parsed InviteProjection
	});

	it('URL is /api/invite/<token>', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ valid: false }),
		});
		vi.stubGlobal('fetch', fetchMock);
		await expect(resolveInvite('my-token-xyz')).rejects.toThrow('not implemented');
		// After GREEN: fetchMock.mock.calls[0][0] === '/api/invite/my-token-xyz'
	});

	it('returns { valid: false } on 404-shaped response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true, json: async () => ({ valid: false }),
		}));
		await expect(resolveInvite('missing')).rejects.toThrow('not implemented');
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
		vi.stubGlobal('fetch', makeFetchMock('app-type-42'));
		await expect(
			createApplication(cfg, { personId: 'person-77', orgId: 'org-111' }),
		).rejects.toThrow('not implemented');
		// After GREEN: assert body toEqual(expect.arrayContaining([
		//   { type: '_type', reference: 'app-type-42' },
		//   { type: '_parent', reference: 'person-77' },
		//   { type: 'target_org', reference: 'org-111' },
		//   { type: 'status', string: 'active' },
		//   { type: 'expires_at', date: <~30d from now> },
		// ]))
	});

	it('_parent = personId (application is child of the singer person entity)', async () => {
		// This is the identity-proof mechanism: only the person entity owner can create a child here.
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createApplication(cfg, { personId: 'person-singer-123', orgId: 'org-111' }),
		).rejects.toThrow('not implemented');
		// After GREEN: POST body contains { type: '_parent', reference: 'person-singer-123' }
	});

	it('does NOT set _sharing (inherits parent private sharing)', async () => {
		vi.stubGlobal('fetch', makeFetchMock());
		await expect(
			createApplication(cfg, { personId: 'p', orgId: 'o' }),
		).rejects.toThrow('not implemented');
		// After GREEN: POST body does NOT contain any { type: '_sharing' } element
	});

	it('returns the created applicationId', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'app-created-77'));
		await expect(
			createApplication(cfg, { personId: 'p', orgId: 'o' }),
		).rejects.toThrow('not implemented');
		// After GREEN: returns 'app-created-77'
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (url.includes('_type.string=entity')) {
				return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'type-id' }] }) });
			}
			return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
		}));
		await expect(createApplication(cfg, { personId: 'p', orgId: 'o' })).rejects.toThrow();
	});
});

// ── acceptInvite ──────────────────────────────────────────────────────────────

describe('acceptInvite', () => {
	it('POSTs to /api/invite/<token>/accept with { applicationId }', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true, orgId: 'org-111' }),
		}));
		await expect(acceptInvite('tok-abc', { applicationId: 'app-99' })).rejects.toThrow('not implemented');
		// After GREEN: fetch called with URL '/api/invite/tok-abc/accept' + method POST + body { applicationId: 'app-99' }
	});

	it('returns the parsed response { ok, orgId }', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true, orgId: 'org-111' }),
		}));
		await expect(acceptInvite('tok', { applicationId: 'app-1' })).rejects.toThrow('not implemented');
	});

	it('throws on non-ok HTTP response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false, status: 403, json: async () => ({}),
		}));
		await expect(acceptInvite('tok', { applicationId: 'app-1' })).rejects.toThrow();
	});
});

// (*MVOX:Tallis*)
