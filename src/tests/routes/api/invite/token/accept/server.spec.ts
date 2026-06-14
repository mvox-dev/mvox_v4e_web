// RED phase — POST /api/invite/[token]/accept endpoint tests.
// Lives under src/tests/ per GOTCHA: +server.spec.ts in src/routes/ crashes SvelteKit sync.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$env/dynamic/private', () => ({ ENTU_SERVICE_KEY: 'svc-api-key' }));

vi.mock('../../../../../../lib/server/entu/elevated', () => ({
	mintJwt: vi.fn(),
	resolveInvitationByToken: vi.fn(),
	readEntity: vi.fn(),
	resolvePersonName: vi.fn(),
	createMember: vi.fn(),
	findActiveMember: vi.fn(),
	deleteEntity: vi.fn(),
}));

import {
	mintJwt,
	resolveInvitationByToken,
	readEntity,
	resolvePersonName,
	createMember,
	findActiveMember,
	deleteEntity,
} from '../../../../../../lib/server/entu/elevated';

const mockMintJwt = vi.mocked(mintJwt);
const mockResolveInvitation = vi.mocked(resolveInvitationByToken);
const mockReadEntity = vi.mocked(readEntity);
const mockResolvePersonName = vi.mocked(resolvePersonName);
const mockCreateMember = vi.mocked(createMember);
const mockFindActiveMember = vi.mocked(findActiveMember);
const mockDeleteEntity = vi.mocked(deleteEntity);

const NOW_MS = Date.now();
const FUTURE_MS = NOW_MS + 30 * 24 * 60 * 60 * 1000;

/** Realistic application entity as returned by readEntity */
const makeApplicationEntity = (opts: { personId?: string; targetOrg?: string } = {}) => ({
	entity: {
		_id: 'app-99',
		_parent: [{ reference: opts.personId ?? 'person-77' }],
		target_org: [{ reference: opts.targetOrg ?? 'org-111' }],
		status: [{ string: 'active' }],
		expires_at: [{ date: '2026-07-14' }],
	},
});

/** Build a minimal mock RequestEvent for POST /api/invite/[token]/accept */
function makeEvent(
	token: string,
	body: Record<string, unknown>,
	envKey: string | undefined = 'svc-api-key',
) {
	return {
		params: { token },
		platform: { env: { ENTU_SERVICE_KEY: envKey, PUBLIC_ENTU_DB: 'testdb' } },
		request: {
			json: async () => body,
		},
	};
}

const VALID_INVITATION = {
	invitationId: 'inv-42',
	orgId: 'org-111',
	email: 'singer@example.com',
	expiresAt: FUTURE_MS,
	sections: ['sec-soprano'],
	message: 'Welcome!',
	token: 'uuid-tok-abc',
};

beforeEach(() => {
	vi.clearAllMocks();
	mockMintJwt.mockResolvedValue('service-jwt-abc');
	mockResolveInvitation.mockResolvedValue(VALID_INVITATION);
	mockReadEntity.mockResolvedValue(makeApplicationEntity());
	mockResolvePersonName.mockResolvedValue('Mihkel Putrinš');
	mockCreateMember.mockResolvedValue('new-member-88');
	mockFindActiveMember.mockResolvedValue(null);
	mockDeleteEntity.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.resetModules();
});

// ── happy path ────────────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — happy path', () => {
	it('reads application by id, resolves personId from application._parent, creates member, deletes invitation+application', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		await expect(POST(event as never)).rejects.toThrow('not implemented');
		// After GREEN: assert all four steps were called in sequence
	});

	it('returns { ok: true, orgId } on success', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		await expect(POST(event as never)).rejects.toThrow('not implemented');
		// After GREEN: response body toEqual({ ok: true, orgId: 'org-111' })
	});

	it('NEVER uses the user JWT server-side — only mintJwt/service key', async () => {
		// The BFF must not read any Authorization header from the request or extract a user JWT.
		// Identity proof comes from application._parent (verified by Entu rights), not from
		// a user JWT on the server (which would 401 due to IP-binding, per project_entu_jwt_ip_bound).
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const eventWithUserJwt = {
			params: { token: 'uuid-tok-abc' },
			platform: { env: { ENTU_SERVICE_KEY: 'svc-api-key', PUBLIC_ENTU_DB: 'testdb' } },
			request: {
				json: async () => ({ applicationId: 'app-99' }),
				headers: { get: (_k: string) => 'Bearer user-jwt-should-not-be-used' },
			},
		};
		await expect(POST(eventWithUserJwt as never)).rejects.toThrow('not implemented');
		// After GREEN: assert mintJwt was called (service key path) and
		// no direct Entu call was made with the user-jwt string from the header
	});

	it('creates member with org + sections from invitation, person and name from application._parent', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		await expect(POST(event as never)).rejects.toThrow('not implemented');
		// After GREEN: assert createMember called with
		// { orgId: 'org-111', sections: ['sec-soprano'], personId: 'person-77', name: 'Mihkel Putrinš' }
	});

	it('deletes invitation AND application after member creation (cleanup)', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		await expect(POST(event as never)).rejects.toThrow('not implemented');
		// After GREEN: deleteEntity called at least twice: once for inv-42 + once for app-99
	});
});

// ── expired on accept ─────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — expired at accept time', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue({
			...VALID_INVITATION,
			expiresAt: Date.now() - 1000, // just expired
		});
	});

	it('returns 410-shaped { expired: true }', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('expired-tok', { applicationId: 'app-99' });
		// After GREEN: Response status 410, body { expired: true }
		await expect(POST(event as never)).rejects.toThrow('not implemented');
	});
});

// ── already a member (idempotent) ─────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — already a member', () => {
	beforeEach(() => {
		mockFindActiveMember.mockResolvedValue({
			memberId: 'existing-member-55',
			personId: 'person-77',
			orgId: 'org-111',
			status: 'active',
		});
	});

	it('skips createMember, still cleans up, returns { ok: true, orgId, alreadyMember: true }', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		await expect(POST(event as never)).rejects.toThrow('not implemented');
		// After GREEN: createMember NOT called; deleteEntity called (cleanup still happens);
		// response body: { ok: true, orgId: 'org-111', alreadyMember: true }
	});
});

// ── identity-proof absent / non-person parent ─────────────────────────────────

describe('POST /api/invite/[token]/accept — missing identity proof', () => {
	it('returns 403 when application._parent is absent', async () => {
		mockReadEntity.mockResolvedValue({
			entity: {
				_id: 'app-bad',
				// _parent absent — no identity proof
				target_org: [{ reference: 'org-111' }],
				status: [{ string: 'active' }],
			},
		});
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-bad' });
		// After GREEN: Response status 403
		await expect(POST(event as never)).rejects.toThrow('not implemented');
	});
});

// ── org mismatch ───────────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — org mismatch', () => {
	it('returns 403 when application.target_org !== invitation.org', async () => {
		// Application says target_org='org-DIFFERENT', invitation says orgId='org-111'
		mockReadEntity.mockResolvedValue(makeApplicationEntity({ targetOrg: 'org-DIFFERENT' }));
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-mismatch' });
		// After GREEN: Response status 403
		await expect(POST(event as never)).rejects.toThrow('not implemented');
	});
});

// ── delete failure (soft warning) ─────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — delete fails (soft warning)', () => {
	it('still returns ok when deleteEntity throws (member is the durable outcome)', async () => {
		mockDeleteEntity.mockRejectedValue(new Error('Entu delete failed'));
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('uuid-tok-abc', { applicationId: 'app-99' });
		// After GREEN: member created; deleteEntity throws; response is still ok
		// (mirrors deleteSeriesCascade pattern: member is durable, delete is best-effort)
		await expect(POST(event as never)).rejects.toThrow('not implemented');
	});
});

// ── missing service key ────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — missing ENTU_SERVICE_KEY', () => {
	it('returns 500', async () => {
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const event = makeEvent('tok', { applicationId: 'app-99' }, undefined);
		await expect(POST(event as never)).rejects.toThrow('not implemented');
	});
});

// (*MVOX:Tallis*)
