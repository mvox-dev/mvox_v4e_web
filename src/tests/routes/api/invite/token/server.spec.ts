// RED phase — GET /api/invite/[token] resolve endpoint tests.
// Route spec lives under src/tests/ (not colocated) per GOTCHA:
// SvelteKit crashes on +server.spec.ts inside src/routes/ during sync.
// Imports the handler by relative path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$env/dynamic/private', () => ({ ENTU_SERVICE_KEY: 'svc-api-key' }));

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
		entity: {
			_id: 'org-111',
			name: [{ string: 'Estonian Philharmonic Chamber Choir' }],
		},
	});
});

afterEach(() => {
	vi.resetModules();
});

// ── valid invitation ──────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — valid (not expired)', () => {
	const NOW_MS = Date.now();
	const FUTURE_MS = NOW_MS + 30 * 24 * 60 * 60 * 1000; // +30 days

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

	it('returns { valid: true, expired: false, orgName, email, sections, message }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('uuid-tok-abc');
		await expect(GET(event as never)).rejects.toThrow('not implemented');
		// After GREEN: response body must equal:
		// { valid: true, expired: false, orgName: 'Estonian Philharmonic Chamber Choir',
		//   email: 'singer@example.com', sections: ['sec-soprano','sec-alto'],
		//   message: 'Welcome to EFK!' }
	});

	it('does NOT leak token, inviter, invitationId, or full entity', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('uuid-tok-abc');
		// RED: throws not-implemented.
		// After GREEN: parse JSON body and assert none of: token, inviter, invitationId, _id
		await expect(GET(event as never)).rejects.toThrow('not implemented');
	});
});

// ── expired invitation ────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — expired', () => {
	const PAST_MS = Date.now() - 1000; // expired 1 second ago

	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue({
			invitationId: 'inv-old',
			orgId: 'org-111',
			email: 'late@example.com',
			expiresAt: PAST_MS,
			sections: [],
			message: '',
			token: 'expired-tok',
		});
	});

	it('returns { valid: true, expired: true, orgName, email, sections, message }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('expired-tok');
		// After GREEN: { valid: true, expired: true, orgName: '...', email: 'late@example.com', ... }
		await expect(GET(event as never)).rejects.toThrow('not implemented');
	});
});

// ── unknown token ─────────────────────────────────────────────────────────────

describe('GET /api/invite/[token] — not found', () => {
	beforeEach(() => {
		mockResolveInvitation.mockResolvedValue(null);
	});

	it('returns 404-shaped { valid: false }', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('no-such-token');
		// After GREEN: Response with status 404 and body { valid: false }
		await expect(GET(event as never)).rejects.toThrow('not implemented');
	});
});

// ── missing service key ───────────────────────────────────────────────────────

describe('GET /api/invite/[token] — missing ENTU_SERVICE_KEY', () => {
	it('returns 500', async () => {
		const { GET } = await import('../../../../../routes/api/invite/[token]/+server');
		const event = makeEvent('tok', undefined);
		// After GREEN: Response with status 500
		await expect(GET(event as never)).rejects.toThrow('not implemented');
	});
});

// (*MVOX:Tallis*)
