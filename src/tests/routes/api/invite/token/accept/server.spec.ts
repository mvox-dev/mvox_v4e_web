// RED phase — POST /api/invite/[token]/accept endpoint tests.
// Lives under src/tests/ per GOTCHA: +server.spec.ts in src/routes/ crashes SvelteKit sync.
// Security focus: identity-proof via application._parent, no user JWT server-side,
// org-mismatch 403, already-member idempotent, delete-failure soft-warning.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$env/dynamic/private', () => ({ env: { ENTU_SERVICE_KEY: 'svc-api-key' } }));

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
function makeApplicationEntity(opts: { personId?: string; targetOrg?: string } = {}) {
	return {
		_id: 'app-99',
		_parent: [{ reference: opts.personId ?? 'person-77' }],
		target_org: [{ reference: opts.targetOrg ?? 'org-111' }],
		status: [{ string: 'active' }],
		expires_at: [{ date: '2099-07-14' }],
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
			headers: { get: (_k: string) => null }, // no user JWT in headers
		},
	};
}

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

// helper: run POST and return parsed Response or the thrown Error
async function runPost(token: string, body: Record<string, unknown>, envKey?: string | undefined) {
	const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
	const event = makeEvent(token, body, envKey);
	return Promise.resolve(POST(event as never)).catch((e: Error) => e) as Promise<Response | Error>;
}

// ── happy path ────────────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — happy path', () => {
	it('returns 200 { ok: true, orgId }', async () => {
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toEqual({ ok: true, orgId: 'org-111' });
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('calls createMember with orgId + sections from invitation, personId from application._parent, name from resolvePersonName', async () => {
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			expect(mockCreateMember).toHaveBeenCalledWith('service-jwt-abc', 'testdb', {
				orgId: 'org-111',
				sections: ['sec-soprano'],
				personId: 'person-77',
				name: 'Mihkel Putrinš',
			});
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('deletes both invitation and application after member creation', async () => {
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			const deletedIds = mockDeleteEntity.mock.calls.map((c) => c[2]);
			expect(deletedIds).toContain('inv-42');
			expect(deletedIds).toContain('app-99');
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('SECURITY: BFF uses ONLY the service-key-minted JWT — never the user JWT from request headers', async () => {
		// The endpoint receives a request; its Authorization header is the USER's JWT (IP-bound, unusable from CF)
		// The BFF must ONLY call mintJwt(serviceKey, db) and use that result for all Entu calls.
		// It must never forward or use any Authorization header from the incoming request.
		const eventWithUserJwt = {
			params: { token: 'uuid-tok-abc' },
			platform: { env: { ENTU_SERVICE_KEY: 'svc-api-key', PUBLIC_ENTU_DB: 'testdb' } },
			request: {
				json: async () => ({ applicationId: 'app-99' }),
				headers: {
					get: (k: string) => (k === 'authorization' ? 'Bearer USER-JWT-MUST-NOT-BE-USED' : null),
				},
			},
		};
		const { POST } = await import('../../../../../../routes/api/invite/[token]/accept/+server');
		const res = await Promise.resolve(POST(eventWithUserJwt as never)).catch((e: Error) => e);
		if (res instanceof Response) {
			// mintJwt must have been called (service-key path)
			expect(mockMintJwt).toHaveBeenCalledWith('svc-api-key', 'testdb');
			// Every elevated call uses the minted service JWT, not the user JWT
			// (verify by checking no elevated helper was called with 'USER-JWT-MUST-NOT-BE-USED')
			const allHelperCalls = [
				...mockResolveInvitation.mock.calls,
				...mockReadEntity.mock.calls,
				...mockResolvePersonName.mock.calls,
				...mockCreateMember.mock.calls,
				...mockFindActiveMember.mock.calls,
				...mockDeleteEntity.mock.calls,
			];
			for (const call of allHelperCalls) {
				expect((call as unknown[])[0]).not.toBe('Bearer USER-JWT-MUST-NOT-BE-USED');
				expect((call as unknown[])[0]).not.toBe('USER-JWT-MUST-NOT-BE-USED');
			}
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── expired on accept ─────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — expired at accept time', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue({
			...VALID_INVITATION,
			expiresAt: NOW_MS - 1000,
		});
	});

	it('returns 410 with { expired: true }', async () => {
		const res = await runPost('expired-tok', { applicationId: 'app-99' });
		if (res instanceof Response) {
			expect(res.status).toBe(410);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toMatchObject({ expired: true });
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('does NOT call createMember when expired', async () => {
		const res = await runPost('expired-tok', { applicationId: 'app-99' });
		if (res instanceof Response) {
			expect(mockCreateMember).not.toHaveBeenCalled();
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── already a member (idempotent) ─────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — already a member', () => {
	beforeEach(() => {
		mockFindActiveMember.mockResolvedValue({
			memberId: 'existing-55',
			personId: 'person-77',
			orgId: 'org-111',
			status: 'active',
		});
	});

	it('returns 200 { ok: true, orgId, alreadyMember: true } without calling createMember', async () => {
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toEqual({ ok: true, orgId: 'org-111', alreadyMember: true });
			expect(mockCreateMember).not.toHaveBeenCalled();
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('still cleans up invitation + application even when member already exists', async () => {
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			const deletedIds = mockDeleteEntity.mock.calls.map((c) => c[2]);
			expect(deletedIds).toContain('inv-42');
			expect(deletedIds).toContain('app-99');
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── identity-proof absent ─────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — missing identity proof', () => {
	it('returns 403 when application._parent is absent', async () => {
		mockReadEntity.mockResolvedValue({
			_id: 'app-bad',
			// _parent absent — no identity proof
			target_org: [{ reference: 'org-111' }],
			status: [{ string: 'active' }],
		});
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-bad' });
		if (res instanceof Response) {
			expect(res.status).toBe(403);
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── org mismatch ───────────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — org mismatch', () => {
	it('returns 403 when application.target_org !== invitation.orgId', async () => {
		mockReadEntity.mockResolvedValue(makeApplicationEntity({ targetOrg: 'org-DIFFERENT' }));
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-mismatch' });
		if (res instanceof Response) {
			expect(res.status).toBe(403);
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('does NOT call createMember on org mismatch', async () => {
		mockReadEntity.mockResolvedValue(makeApplicationEntity({ targetOrg: 'org-DIFFERENT' }));
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-mismatch' });
		if (res instanceof Response) {
			expect(mockCreateMember).not.toHaveBeenCalled();
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── delete failure (soft warning — member is durable) ─────────────────────────

describe('POST /api/invite/[token]/accept — delete fails (soft warning)', () => {
	it('returns 200 ok even when deleteEntity throws (member is the durable outcome)', async () => {
		mockDeleteEntity.mockRejectedValue(new Error('Entu delete 403'));
		const res = await runPost('uuid-tok-abc', { applicationId: 'app-99' });
		if (res instanceof Response) {
			// member was created; cleanup failed but we still return ok
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toMatchObject({ ok: true, orgId: 'org-111' });
			// member must still have been created
			expect(mockCreateMember).toHaveBeenCalled();
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── missing service key ────────────────────────────────────────────────────────

describe('POST /api/invite/[token]/accept — missing ENTU_SERVICE_KEY', () => {
	it('returns 500', async () => {
		// '' = absent/unset service key. (NOT undefined — makeEvent's `envKey` default
		// would otherwise fill in the present key and the 500 path would be unreachable.)
		const res = await runPost('tok', { applicationId: 'app-99' }, '');
		if (res instanceof Response) {
			expect(res.status).toBe(500);
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// (*MVOX:Tallis*)
