// RED phase — GET /api/invite/[token] resolve endpoint tests.
// Route spec lives under src/tests/ (not colocated) per GOTCHA:
// SvelteKit crashes on +server.spec.ts inside src/routes/ during sync.
// Imports the handler by relative path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$env/dynamic/private', () => ({ env: { ENTU_SERVICE_KEY: 'svc-api-key' } }));

// Mock the elevated helper module so tests control service-JWT behaviour
vi.mock('../../../../../lib/server/entu/elevated', () => ({
	mintJwt: vi.fn(),
	resolveInvitationByToken: vi.fn(),
	readEntity: vi.fn(),
}));

import {
	mintJwt,
	readEntity,
	resolveInvitationByToken,
} from '../../../../../lib/server/entu/elevated';

const mockMintJwt = vi.mocked(mintJwt);
const mockResolveInvitation = vi.mocked(resolveInvitationByToken);
const mockReadEntity = vi.mocked(readEntity);

const NOW_MS = Date.now();
const FUTURE_MS = NOW_MS + 30 * 24 * 60 * 60 * 1000;

/** Build a minimal mock RequestEvent for GET /api/invite/[token] */
function makeEvent(token: string, envKey: string | undefined = 'svc-api-key') {
	return {
		params: { token },
		platform: { env: { ENTU_SERVICE_KEY: envKey, PUBLIC_ENTU_DB: 'testdb' } },
		request: new Request(`http://localhost/api/invite/${token}`),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockMintJwt.mockResolvedValue('service-jwt-abc');
	mockReadEntity.mockResolvedValue({
		_id: 'org-111',
		name: [{ string: 'Estonian Philharmonic Chamber Choir' }],
	});
});

afterEach(() => {
	vi.resetModules();
});

// ── valid invitation ──────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — valid (not expired)', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue({
			invitationId: 'inv-42',
			orgId: 'org-111',
			email: 'singer@example.com',
			expiresAt: FUTURE_MS,
			sections: ['sec-soprano', 'sec-alto'],
			message: 'Welcome to EFK!',
			token: 'uuid-tok-abc',
		});
	});

	it('returns 200 with { valid:true, expired:false, orgName, email, sections, message }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('uuid-tok-abc');
		const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
		// RED: stub throws Error('not implemented') — res is an Error
		// GREEN: res is a Response with status 200
		if (res instanceof Response) {
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toEqual({
				valid: true,
				expired: false,
				orgId: 'org-111', // required: client reads this for createApplication identity-proof
				orgName: 'Estonian Philharmonic Chamber Choir',
				email: 'singer@example.com',
				sections: ['sec-soprano', 'sec-alto'],
				message: 'Welcome to EFK!',
			});
		} else {
			// RED: stub throws — assert the Error is "not implemented" (verifies we're testing the stub)
			expect((res as Error).message).toContain('not implemented');
		}
	});

	it('response body does NOT contain token, inviter, invitationId, or full entity', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('uuid-tok-abc');
		const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
		if (res instanceof Response) {
			const body = (await res.json()) as Record<string, unknown>;
			// Security: projection must be minimal
			expect(body).not.toHaveProperty('token');
			expect(body).not.toHaveProperty('inviter');
			expect(body).not.toHaveProperty('invitationId');
			expect(body).not.toHaveProperty('_id');
			expect(body).not.toHaveProperty('entity');
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── expired invitation ────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — expired', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue({
			invitationId: 'inv-old',
			orgId: 'org-111',
			email: 'late@example.com',
			expiresAt: NOW_MS - 1000, // expired 1s ago
			sections: [],
			message: '',
			token: 'expired-tok',
		});
	});

	it('returns 200 with { valid:true, expired:true, orgName, email, sections, message }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('expired-tok');
		const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
		if (res instanceof Response) {
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toMatchObject({ valid: true, expired: true });
			expect(body).not.toHaveProperty('token'); // still minimal projection
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── unknown token ─────────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — not found', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue(null);
	});

	it('returns 404-shaped response with { valid: false }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('no-such-token');
		const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
		if (res instanceof Response) {
			expect(res.status).toBe(404);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toEqual({ valid: false });
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// ── missing service key ───────────────────────────────────────────────────────

describe('GET /api/invite/[token] — missing ENTU_SERVICE_KEY', () => {
	it('returns 500', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		// '' = absent/unset service key. (NOT undefined — makeEvent's `envKey` default
		// would otherwise fill in the present key and the 500 path would be unreachable.)
		const event = makeEvent('tok', '');
		const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
		if (res instanceof Response) {
			expect(res.status).toBe(500);
		} else {
			expect((res as Error).message).toContain('not implemented');
		}
	});
});

// (*MVOX:Tallis*)
