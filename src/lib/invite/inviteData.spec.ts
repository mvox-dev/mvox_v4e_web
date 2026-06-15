// RED phase — inviteData: createInvitation, createApplication, grantEditorToAdmin,
// listPendingApplications, approveApplication.
//
// Convention (per plan corrections C1–C5):
//   - Entu calls use raw `fetch` (vi.stubGlobal); NOT a client object.
//   - POST body is a flat ARRAY of prop objects: [{ type, reference|string|date }, ...]
//   - GET URL assertions use .toContain() on fetchMock.mock.calls[i][0]
//   - POST body: JSON.parse(call[1].body) then toEqual / toContainEqual per prop
//   - expires_at type is 'date', value 'YYYY-MM-DD' (C3)
//   - application MUST POST { type:'_sharing', string:'private' } (C4)
//   - application status MUST be 'pending', NOT 'active' (OD-4 / plan locked decision)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createInvitation,
	createApplication,
	grantEditorToAdmin,
	listPendingApplications,
	approveApplication,
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

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a fetch mock that handles type-resolution GETs + entity create POST.
 *  Type-resolution: GET …?_type.string=entity&name.string=<type>… → { entities: [{ _id }] }
 *  Entity create POST → { _id: createdId }
 */
function makeFetchMock(typeId = 'resolved-type-id', createdId = 'created-entity-id') {
	return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
		if ((init?.method ?? 'GET') === 'GET' && url.includes('_type.string=entity')) {
			return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: typeId }] }) });
		}
		return Promise.resolve({ ok: true, json: async () => ({ _id: createdId }) });
	});
}

/** Extract the entity-create POST call from a fetchMock's call list. */
function findPostCall(
	fetchMock: ReturnType<typeof vi.fn>,
): [string, { body: string; method: string }] {
	const call = (fetchMock.mock.calls as Array<[string, { body: string; method: string }]>).find(
		([, init]) => init?.method === 'POST',
	);
	if (!call) throw new Error('No POST call found in fetchMock');
	return call;
}

// ── createInvitation ──────────────────────────────────────────────────────────

describe('createInvitation', () => {
	it('POST body is a flat array with _type reference, _parent=orgId, inviter, email, sections', async () => {
		const fetchMock = makeFetchMock('inv-type-42', 'inv-new-1');
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, {
			orgId: 'org123',
			email: 'a@b.ee',
			sections: ['sopr1'],
			inviterPersonId: 'p456',
			message: 'welcome',
		});
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		expect(body).toContainEqual({ type: '_type', reference: 'inv-type-42' });
		expect(body).toContainEqual({ type: '_parent', reference: 'org123' });
		expect(body).toContainEqual({ type: 'inviter', reference: 'p456' });
		expect(body).toContainEqual({ type: 'email', string: 'a@b.ee' });
		expect(body).toContainEqual({ type: 'sections', reference: 'sopr1' });
	});

	it('POST body contains a token string prop (non-empty)', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, { orgId: 'org1', email: 'e@t.ee', inviterPersonId: 'p1' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		const tokenProp = body.find((p) => p.type === 'token');
		expect(tokenProp).toBeDefined();
		expect(typeof tokenProp?.string).toBe('string');
		expect(tokenProp!.string.length).toBeGreaterThan(0);
	});

	it('POST body contains expires_at as type=date with a YYYY-MM-DD value', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createInvitation(cfg, { orgId: 'org1', email: 'e@t.ee', inviterPersonId: 'p1' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		const expProp = body.find((p) => p.type === 'expires_at');
		expect(expProp).toBeDefined();
		// C3: type is 'date', value is YYYY-MM-DD (NOT datetime)
		expect(expProp).not.toHaveProperty('datetime');
		expect(expProp!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('expires_at is approximately now + 30 days', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		const beforeMs = Date.now();
		await createInvitation(cfg, { orgId: 'org1', email: 'e@t.ee', inviterPersonId: 'p1' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		const expProp = body.find((p) => p.type === 'expires_at');
		const expiresMs = new Date(expProp!.date).getTime();
		const expected30d = beforeMs + 30 * 24 * 60 * 60 * 1000;
		// Within ±1 day tolerance
		expect(Math.abs(expiresMs - expected30d)).toBeLessThan(24 * 60 * 60 * 1000);
	});

	it('returns { invitationId, token } with the created _id and a non-empty token', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'inv-created-99'));
		const result = await createInvitation(cfg, {
			orgId: 'org1',
			email: 'e@t.ee',
			inviterPersonId: 'p1',
		});
		expect(result.invitationId).toBe('inv-created-99');
		expect(typeof result.token).toBe('string');
		expect(result.token.length).toBeGreaterThan(0);
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: RequestInit) => {
				if ((init?.method ?? 'GET') === 'GET' && url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(
			createInvitation(cfg, { orgId: 'org1', email: 'e@t.ee', inviterPersonId: 'p1' }),
		).rejects.toThrow('403');
	});
});

// ── createApplication ─────────────────────────────────────────────────────────

describe('createApplication', () => {
	it('POST body has _type reference, _parent=personId, target_org, status=pending, _sharing=private', async () => {
		const fetchMock = makeFetchMock('app-type-42', 'app-new-1');
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'p789', orgId: 'org123' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		// Full-shape assertions per C2 + OD-4 + C4
		expect(body).toContainEqual({ type: '_type', reference: 'app-type-42' });
		expect(body).toContainEqual({ type: '_parent', reference: 'p789' });
		expect(body).toContainEqual({ type: 'target_org', reference: 'org123' });
		// OD-4: status MUST be 'pending', NOT 'active'
		expect(body).toContainEqual({ type: 'status', string: 'pending' });
		// C4: MUST set _sharing=private (person entity is public; child materialises that without override)
		expect(body).toContainEqual({ type: '_sharing', string: 'private' });
	});

	it('status is "pending" — never "active" (OD-4 locked decision)', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'p', orgId: 'o' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		const statusProp = body.find((p) => p.type === 'status');
		expect(statusProp?.string).toBe('pending');
		expect(statusProp?.string).not.toBe('active');
	});

	it('_sharing is explicitly "private" — not absent (C4: person parent is public, must override)', async () => {
		const fetchMock = makeFetchMock();
		vi.stubGlobal('fetch', fetchMock);
		await createApplication(cfg, { personId: 'p', orgId: 'o' });
		const [, init] = findPostCall(fetchMock);
		const body = JSON.parse(init.body) as Array<Record<string, string>>;
		const sharingProp = body.find((p) => p.type === '_sharing');
		expect(sharingProp).toBeDefined();
		expect(sharingProp?.string).toBe('private');
	});

	it('returns { applicationId } with the created _id', async () => {
		vi.stubGlobal('fetch', makeFetchMock('type-id', 'app-created-77'));
		const result = await createApplication(cfg, { personId: 'p', orgId: 'o' });
		expect(result).toEqual({ applicationId: 'app-created-77' });
	});

	it('throws on !ok create response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: RequestInit) => {
				if ((init?.method ?? 'GET') === 'GET' && url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(createApplication(cfg, { personId: 'p', orgId: 'o' })).rejects.toThrow('403');
	});
});

// ── grantEditorToAdmin ────────────────────────────────────────────────────────

describe('grantEditorToAdmin', () => {
	it('POSTs a single _editor grant to entity/<applicationId> for the admin person', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
		await grantEditorToAdmin(cfg, { applicationId: 'app1', adminPersonId: 'p456' });
		const postCall = (fetchMock.mock.calls as Array<[string, { method: string; body: string }]>).find(
			([, init]) => init?.method === 'POST',
		);
		expect(postCall).toBeDefined();
		// URL must target the application entity specifically
		expect(postCall![0]).toContain('app1');
		// Body: a flat array with a single _editor grant for the admin person
		const body = JSON.parse(postCall![1].body) as Array<Record<string, string>>;
		expect(body).toEqual([{ type: '_editor', reference: 'p456' }]);
	});

	it('POSTs to entity/<applicationId> path (mirror of assignConductor grant pattern)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
		await grantEditorToAdmin(cfg, { applicationId: 'app-xyz', adminPersonId: 'admin-person' });
		const postCall = (fetchMock.mock.calls as Array<[string, { method: string }]>).find(
			([, init]) => init?.method === 'POST',
		);
		// Must NOT POST to /entity (create), must POST to /entity/app-xyz (rights grant)
		expect(postCall![0]).toMatch(/entity\/app-xyz/);
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(
			grantEditorToAdmin(cfg, { applicationId: 'app1', adminPersonId: 'p' }),
		).rejects.toThrow('403');
	});
});

// ── listPendingApplications ───────────────────────────────────────────────────

describe('listPendingApplications', () => {
	it('GET URL contains _type.string=application, target_org.reference=<orgId>, status.string=pending', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('_parent.reference=p789') || url.includes('/entity/p789')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'p789', name: [{ string: 'Mari Maa' }] } }),
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({
					entities: [
						{ _id: 'app1', _parent: [{ reference: 'p789' }], message: [{ string: 'hi' }] },
					],
				}),
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		await listPendingApplications(cfg, 'org123');
		const listCall = (fetchMock.mock.calls as Array<[string]>).find(
			([url]) => url.includes('_type.string=application'),
		);
		expect(listCall).toBeDefined();
		const url = listCall![0];
		expect(url).toContain('_type.string=application');
		expect(url).toContain('target_org.reference=org123');
		expect(url).toContain('status.string=pending');
	});

	it('resolves applicant name via a second GET on the person entity', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('entity/p789')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entity: { _id: 'p789', name: [{ string: 'Mari Maa' }] } }),
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({
					entities: [
						{ _id: 'app1', _parent: [{ reference: 'p789' }], message: [{ string: 'hi' }] },
					],
				}),
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		const res = await listPendingApplications(cfg, 'org123');
		expect(res).toEqual([
			{
				applicationId: 'app1',
				personId: 'p789',
				applicantName: 'Mari Maa',
				message: 'hi',
				sections: undefined,
			},
		]);
	});

	it('returns [] when no pending applications exist', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }),
		);
		const res = await listPendingApplications(cfg, 'org123');
		expect(res).toEqual([]);
	});

	it('throws on !ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		await expect(listPendingApplications(cfg, 'org123')).rejects.toThrow('403');
	});
});

// ── approveApplication ────────────────────────────────────────────────────────

describe('approveApplication', () => {
	/** Build fetch mock that handles type resolution + all the approve-flow calls.
	 *  Handles:
	 *  - type-resolution GETs (_type.string=entity)
	 *  - status-prop GETs (entity/<appId>?props=status) → returns status prop with _id
	 *  - DELETE /property/<id> (soft-close: remove pending value)
	 *  - POSTs (member create, org _viewer grant, status update)
	 */
	function makeApproveMock(memberTypeId = 'member-type-id', statusPropId = 'status-prop-id') {
		return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
			const method = init?.method ?? 'GET';
			if (method === 'GET' && url.includes('_type.string=entity')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ entities: [{ _id: memberTypeId }] }),
				});
			}
			// Status-prop fetch: GET /entity/<appId>?props=status
			if (method === 'GET' && url.includes('?props=status')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						entity: { status: [{ _id: statusPropId, string: 'pending' }] },
					}),
				});
			}
			if (method === 'DELETE') {
				return Promise.resolve({ ok: true, json: async () => ({}) });
			}
			// POST (member create + org _viewer sync + status update)
			return Promise.resolve({ ok: true, json: async () => ({ _id: 'mem1' }) });
		});
	}

	it('creates a member with _type resolved, org + section parents, person ref, status=active', async () => {
		const fetchMock = makeApproveMock('mem-type-42');
		vi.stubGlobal('fetch', fetchMock);
		await approveApplication(cfg, {
			applicationId: 'app1',
			invitationId: 'inv1',
			orgId: 'org123',
			personId: 'p789',
			sections: ['sopr1'],
		});
		// Find the member-create POST (to /entity, not /entity/<id>)
		const memberCreate = (
			fetchMock.mock.calls as Array<[string, { method: string; body: string }]>
		).find(
			([url, init]) =>
				init?.method === 'POST' && !url.match(/entity\/(?:org|app|inv|p)/),
		);
		expect(memberCreate).toBeDefined();
		const body = JSON.parse(memberCreate![1].body) as Array<Record<string, string>>;
		expect(body).toContainEqual({ type: '_type', reference: 'mem-type-42' });
		expect(body).toContainEqual({ type: '_parent', reference: 'org123' });
		expect(body).toContainEqual({ type: '_parent', reference: 'sopr1' });
		expect(body).toContainEqual({ type: 'person', reference: 'p789' });
		expect(body).toContainEqual({ type: 'status', string: 'active' });
	});

	it('member POST body has NO name property (OD-4: member has no name prop)', async () => {
		const fetchMock = makeApproveMock();
		vi.stubGlobal('fetch', fetchMock);
		await approveApplication(cfg, {
			applicationId: 'app1',
			invitationId: 'inv1',
			orgId: 'org123',
			personId: 'p789',
			sections: [],
		});
		const memberCreate = (
			fetchMock.mock.calls as Array<[string, { method: string; body: string }]>
		).find(
			([url, init]) =>
				init?.method === 'POST' && !url.match(/entity\/(?:org|app|inv|p)/),
		);
		const body = JSON.parse(memberCreate![1].body) as Array<{ type: string }>;
		expect(body.some((p) => p.type === 'name')).toBe(false);
	});

	it('POSTs _viewer grant on the org entity for the new member person', async () => {
		const fetchMock = makeApproveMock();
		vi.stubGlobal('fetch', fetchMock);
		await approveApplication(cfg, {
			applicationId: 'app1',
			invitationId: 'inv1',
			orgId: 'org123',
			personId: 'p789',
			sections: [],
		});
		// The org _viewer sync: POST to entity/org123
		const viewerGrant = (
			fetchMock.mock.calls as Array<[string, { method: string; body: string }]>
		).find(
			([url, init]) => init?.method === 'POST' && url.includes('entity/org123'),
		);
		expect(viewerGrant).toBeDefined();
		const body = JSON.parse(viewerGrant![1].body) as Array<Record<string, string>>;
		expect(body).toEqual([{ type: '_viewer', reference: 'p789' }]);
	});

	it('soft-closes the application: GET status prop id, DELETE /property/<id>, POST status=approved', async () => {
		// Pérotin-confirmed 3-step sequence (_editor-sufficient, no entity delete):
		// 1. GET /{db}/entity/<appId>?props=status → read existing status prop _id(s)
		// 2. DELETE /{db}/property/<pendingStatusPropValueId> → clear 'pending' value
		// 3. POST /{db}/entity/<appId> [{ type:'status', string:'approved' }]
		const fetchMock = makeApproveMock('mem-type-id', 'pending-status-prop-99');
		vi.stubGlobal('fetch', fetchMock);
		await approveApplication(cfg, {
			applicationId: 'app1',
			invitationId: 'inv1',
			orgId: 'org123',
			personId: 'p789',
			sections: [],
		});
		const calls = fetchMock.mock.calls as Array<[string, { method?: string; body?: string }]>;

		// Step 1: GET the status prop id for the application
		const statusGet = calls.find(
			([url, init]) => (init?.method ?? 'GET') === 'GET' && url.includes('app1') && url.includes('props=status'),
		);
		expect(statusGet).toBeDefined();

		// Step 2: DELETE /property/<pendingStatusPropValueId> — removes the 'pending' value
		const propDelete = calls.find(
			([url, init]) => init?.method === 'DELETE' && url.includes('property/pending-status-prop-99'),
		);
		expect(propDelete).toBeDefined();

		// Step 3: POST status:'approved' to the application entity
		const statusUpdate = calls.find(
			([url, init]) => init?.method === 'POST' && url.includes('entity/app1'),
		);
		expect(statusUpdate).toBeDefined();
		const statusBody = JSON.parse(statusUpdate![1].body!) as Array<Record<string, string>>;
		expect(statusBody).toContainEqual({ type: 'status', string: 'approved' });
	});

	it('does NOT DELETE /entity/<applicationId> (admin has only _editor — entity delete would 403)', async () => {
		const fetchMock = makeApproveMock();
		vi.stubGlobal('fetch', fetchMock);
		await approveApplication(cfg, {
			applicationId: 'app1',
			invitationId: 'inv1',
			orgId: 'org123',
			personId: 'p789',
			sections: [],
		});
		const entityDeletes = (fetchMock.mock.calls as Array<[string, { method?: string }]>)
			.filter(([url, init]) => init?.method === 'DELETE' && url.includes('entity/app1'));
		expect(entityDeletes).toHaveLength(0);
	});

	it('throws on !ok member create response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: RequestInit) => {
				const method = init?.method ?? 'GET';
				if (method === 'GET' && url.includes('_type.string=entity')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ entities: [{ _id: 'type-id' }] }),
					});
				}
				return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
			}),
		);
		await expect(
			approveApplication(cfg, {
				applicationId: 'app1',
				invitationId: 'inv1',
				orgId: 'org123',
				personId: 'p789',
				sections: [],
			}),
		).rejects.toThrow('403');
	});
});

// (*MVOX:Tallis*)
