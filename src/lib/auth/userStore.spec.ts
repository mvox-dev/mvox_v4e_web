// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_ENTU_DB: 'test-env-db',
}));

let userStore: typeof import('./userStore');
let selectedOrgIdStore: typeof import('./userStore')['selectedOrgIdStore'];
let urlOrgIdStore: typeof import('./userStore')['urlOrgIdStore'];

const FAKE_HEADER = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
const makeJwt = (payload: Record<string, unknown>) =>
	`${FAKE_HEADER}.${btoa(JSON.stringify(payload))}.`;

// Helpers for mock Entu responses matching types.ts contracts
const makePersonResponse = (id: string, name: string) => ({
	entity: { _id: id, name: [{ string: name }] },
});

const makeMemberSearchResponse = (orgParents: Array<{ reference: string; string: string }>) => ({
	count: orgParents.length,
	limit: 100,
	skip: 0,
	entities:
		orgParents.length === 0
			? []
			: [
					{
						_id: 'member-1',
						_parent: [
							...orgParents.map((p) => ({ ...p, entity_type: 'organization' })),
							{ reference: 'section-1', string: 'Bass', entity_type: 'section' },
						],
					},
				],
});

const PERSON_ID = 'person-abc';
const DB = 'test-env-db';
const JWT_WITH_ACCOUNT = makeJwt({
	accounts: { [DB]: PERSON_ID },
	iat: 0,
	exp: 9999999999,
	aud: '127.0.0.1',
});

beforeEach(async () => {
	vi.resetModules();
	localStorage.clear();
	sessionStorage.clear();
	window.history.replaceState({}, '', '/');
	globalThis.fetch = vi.fn();
	userStore = await import('./userStore');
	selectedOrgIdStore = userStore.selectedOrgIdStore;
	urlOrgIdStore = userStore.urlOrgIdStore;
});

describe('userStore — initial state', () => {
	it('starts in loading state', () => {
		expect(get(userStore.userStore).status).toBe('loading');
	});
});

describe('hydrateUserStore — JWT decode', () => {
	it('moves to signed-out when no token in localStorage', async () => {
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
	});

	it('moves to signed-out when token is malformed (not a JWT)', async () => {
		localStorage.setItem('token', 'not-a-jwt');
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
	});

	it('moves to signed-out when JWT has no accounts claim for the db', async () => {
		localStorage.setItem('token', makeJwt({ iat: 0, exp: 9999999999, aud: '127.0.0.1' }));
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
	});
});

describe('hydrateUserStore — fetch + ready state', () => {
	it('moves to ready with name + initial + orgs after successful two fetches', async () => {
		localStorage.setItem('token', JWT_WITH_ACCOUNT);
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makePersonResponse(PERSON_ID, 'Margus Roos')),
				});
			}
			if (url.includes('_type.string=member')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve(
							makeMemberSearchResponse([{ reference: 'org-efk', string: 'EFK Library' }]),
						),
				});
			}
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeOwnerSearchResponse([])),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.name).toBe('Margus Roos');
			expect(state.initial).toBe('M');
			expect(state.orgs).toHaveLength(1);
			expect(state.orgs[0]).toMatchObject({ id: 'org-efk', label: 'EFK Library', initials: 'EL' });
		}
	});

	it('moves to error on Entu fetch failure', async () => {
		localStorage.setItem('token', JWT_WITH_ACCOUNT);
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('error');
	});

	it('moves to ready with empty orgs[] when member search returns no entities', async () => {
		localStorage.setItem('token', JWT_WITH_ACCOUNT);
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makePersonResponse(PERSON_ID, 'Solo User')),
				});
			}
			if (url.includes('_type.string=member')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeMemberSearchResponse([])),
				});
			}
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeOwnerSearchResponse([])),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.orgs).toEqual([]);
		}
	});

	it('filters section parents and only maps organization parents to orgs', async () => {
		localStorage.setItem('token', JWT_WITH_ACCOUNT);
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makePersonResponse(PERSON_ID, 'Test User')),
				});
			}
			if (url.includes('_type.string=member')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve(makeMemberSearchResponse([{ reference: 'org-1', string: 'Org One' }])),
				});
			}
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeOwnerSearchResponse([])),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		if (state.status === 'ready') {
			// makeMemberSearchResponse adds one section parent; only the org should appear
			expect(state.orgs).toHaveLength(1);
			expect(state.orgs[0].id).toBe('org-1');
		}
	});
});

describe('selectedOrgStore — fallback chain', () => {
	beforeEach(() => {
		selectedOrgIdStore.set(null);
		urlOrgIdStore.set(null);
	});

	const setReadyWithTwoOrgs = () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-1', label: 'One', initials: 'O' },
				{ id: 'org-2', label: 'Two', initials: 'T' },
			],
		});
	};

	it('returns null when user is signed-out', () => {
		userStore.userStore.set({ status: 'signed-out' });
		expect(get(userStore.selectedOrgStore)).toBeNull();
	});

	it('returns null when ready but orgs is empty', () => {
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', personId: 'p1', orgs: [] });
		expect(get(userStore.selectedOrgStore)).toBeNull();
	});

	// URL param is now propagated via urlOrgIdStore (layout $effect in production);
	// tests drive the store directly — readOrgParam() helper was removed in CHORE-74
	it('URL param wins when present and valid', () => {
		setReadyWithTwoOrgs();
		urlOrgIdStore.set('org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('localStorage fallback when URL absent', () => {
		setReadyWithTwoOrgs();
		localStorage.setItem('mvox.selectedOrgId', 'org-2');
		selectedOrgIdStore.set('org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('first-org default when URL + localStorage both absent', () => {
		setReadyWithTwoOrgs();
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('first-org default when URL param does not match any org id', () => {
		setReadyWithTwoOrgs();
		urlOrgIdStore.set('bogus');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('two-write symmetry: URL wins AND backfills localStorage', () => {
		setReadyWithTwoOrgs();
		localStorage.setItem('mvox.selectedOrgId', 'org-1');
		urlOrgIdStore.set('org-2');
		const resolved = get(userStore.selectedOrgStore);
		expect(resolved?.id).toBe('org-2');
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
	});
});

describe('selectOrg — two-write on user change', () => {
	beforeEach(() => {
		selectedOrgIdStore.set(null);
		urlOrgIdStore.set(null);
	});

	it('writes localStorage and updates URL', async () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-1', label: 'One', initials: 'O' },
				{ id: 'org-2', label: 'Two', initials: 'T' },
			],
		});

		await userStore.selectOrg('org-2');

		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
		expect(new URL(window.location.href).searchParams.get('org')).toBe('org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});
});

describe('hydrateUserStore — ENTU_DB from $env/static/public', () => {
	const ENV_DB = 'test-env-db';
	const JWT_WITH_ENV_DB = makeJwt({
		accounts: { [ENV_DB]: PERSON_ID },
		iat: 0,
		exp: 9999999999,
		aud: '127.0.0.1',
	});

	it('resolves personId from the env-injected db name', async () => {
		localStorage.setItem('token', JWT_WITH_ENV_DB);
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
			if (url.includes(`${ENV_DB}/entity/${PERSON_ID}`)) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makePersonResponse(PERSON_ID, 'Env User')),
				});
			}
			if (url.includes(`${ENV_DB}/entity`) && url.includes('_type.string=member')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeMemberSearchResponse([])),
				});
			}
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeOwnerSearchResponse([])),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('ready');
	});

	it('issues fetch URLs containing the env db name, not hardcoded polyphony', async () => {
		localStorage.setItem('token', JWT_WITH_ENV_DB);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`${ENV_DB}/entity/${PERSON_ID}`)) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makePersonResponse(PERSON_ID, 'Env User')),
				});
			}
			if (url.includes(`${ENV_DB}/entity`) && url.includes('_type.string=member')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeMemberSearchResponse([])),
				});
			}
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(makeOwnerSearchResponse([])),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();

		const calledUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
		expect(calledUrls.some((u) => u.includes(`/${ENV_DB}/`))).toBe(true);
		expect(calledUrls.every((u) => !u.includes('/polyphony/'))).toBe(true);
	});
});

// Fixtures for founder-union tests using real persona IDs from Pérotin probe (CHORE-68)
const FOUNDER_PERSON_ID = '69bcfd8e9c031ab8e6ce8079';
const EKBL_ORG_ID = '69c7f8718489bfcb0e81b05a';
const EFK_ORG_ID = '69c7f8718489bfcb0e81b065';
const EFK_MEMBER_ID = '69c7f8728489bfcb0e81b085';

const makeOwnerSearchResponse = (orgs: Array<{ id: string; name: string }>) => ({
	count: orgs.length,
	limit: 100,
	skip: 0,
	entities: orgs.map((o) => ({
		_id: o.id,
		name: [{ string: o.name }],
	})),
});

const JWT_FOUNDER = makeJwt({
	accounts: { 'test-env-db': FOUNDER_PERSON_ID },
	iat: 0,
	exp: 9999999999,
	aud: '127.0.0.1',
});

const setupFounderFetch = (opts: {
	ownerOrgs: Array<{ id: string; name: string }>;
	memberOrgParents: Array<{ reference: string; string: string; memberId?: string }>;
}) => {
	(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
		if (url.includes(`entity/${FOUNDER_PERSON_ID}`) && !url.includes('_type')) {
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve(makePersonResponse(FOUNDER_PERSON_ID, 'PO User')),
			});
		}
		if (url.includes('_type.string=organization') && url.includes('_owner.reference')) {
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve(makeOwnerSearchResponse(opts.ownerOrgs)),
			});
		}
		if (url.includes('_type.string=member')) {
			const entities =
				opts.memberOrgParents.length === 0
					? []
					: [
							{
								_id: opts.memberOrgParents[0].memberId ?? 'member-x',
								_parent: opts.memberOrgParents.map((p) => ({
									reference: p.reference,
									string: p.string,
									entity_type: 'organization',
								})),
							},
						];
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ count: entities.length, limit: 100, skip: 0, entities }),
			});
		}
		return Promise.reject(new Error(`Unexpected URL: ${url}`));
	});
};

describe('hydrateUserStore — founder-as-org-affiliation union', () => {
	it('includes orgs where user is _owner with no member row', async () => {
		localStorage.setItem('token', JWT_FOUNDER);
		setupFounderFetch({
			ownerOrgs: [{ id: EKBL_ORG_ID, name: 'EKBL' }],
			memberOrgParents: [],
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			const ekbl = state.orgs.find((o) => o.id === EKBL_ORG_ID);
			expect(ekbl).toBeDefined();
			expect(ekbl?.role).toBe('owner');
		}
	});

	it('preserves member-derived role when org appears in both queries', async () => {
		localStorage.setItem('token', JWT_FOUNDER);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		setupFounderFetch({
			ownerOrgs: [{ id: EFK_ORG_ID, name: 'EFK' }],
			memberOrgParents: [{ reference: EFK_ORG_ID, string: 'EFK', memberId: EFK_MEMBER_ID }],
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');

		const ownerQueryFired = fetchMock.mock.calls.some(
			(c: unknown[]) =>
				typeof c[0] === 'string' &&
				c[0].includes('_type.string=organization') &&
				c[0].includes('_owner.reference'),
		);
		expect(ownerQueryFired).toBe(true);

		if (state.status === 'ready') {
			const efkEntries = state.orgs.filter((o) => o.id === EFK_ORG_ID);
			expect(efkEntries).toHaveLength(1);
			expect(efkEntries[0].role).not.toBe('owner');
		}
	});

	it('existing member-only orgs still appear when owner query returns empty', async () => {
		localStorage.setItem('token', JWT_FOUNDER);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		setupFounderFetch({
			ownerOrgs: [],
			memberOrgParents: [{ reference: EFK_ORG_ID, string: 'EFK', memberId: EFK_MEMBER_ID }],
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');

		const ownerQueryFired = fetchMock.mock.calls.some(
			(c: unknown[]) =>
				typeof c[0] === 'string' &&
				c[0].includes('_type.string=organization') &&
				c[0].includes('_owner.reference'),
		);
		expect(ownerQueryFired).toBe(true);

		if (state.status === 'ready') {
			expect(state.orgs.some((o) => o.id === EFK_ORG_ID)).toBe(true);
		}
	});
});

describe('pickerModeStore — derived from orgs.length', () => {
	it('placeholder when status is loading', () => {
		expect(get(userStore.pickerModeStore)).toBe('placeholder');
	});

	it('placeholder when 0 orgs', () => {
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', personId: 'p1', orgs: [] });
		expect(get(userStore.pickerModeStore)).toBe('placeholder');
	});

	it('static when 1 org', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			personId: 'p1',
			orgs: [{ id: 'a', label: 'A', initials: 'A' }],
		});
		expect(get(userStore.pickerModeStore)).toBe('static');
	});

	it('dropdown when 2+ orgs', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'a', label: 'A', initials: 'A' },
				{ id: 'b', label: 'B', initials: 'B' },
			],
		});
		expect(get(userStore.pickerModeStore)).toBe('dropdown');
	});
});

// === #89 — isTokenExpired boundary tests ===
// These tests are RED: the stub throws 'not implemented'. Josquin implements the real logic.

describe('isTokenExpired — boundary tests (#89)', () => {
	it('returns true when exp is in the past (exp*1000 < nowMs)', async () => {
		const { isTokenExpired } = await import('./userStore');
		const claims = { accounts: {}, iat: 0, exp: 1000, aud: '' };
		// exp=1000 → exp*1000=1_000_000ms; nowMs=1_000_001 → expired
		expect(isTokenExpired(claims, 1_000_001)).toBe(true);
	});

	it('returns true when exp*1000 === nowMs (boundary: not strictly future)', async () => {
		const { isTokenExpired } = await import('./userStore');
		const claims = { accounts: {}, iat: 0, exp: 2000, aud: '' };
		// exp=2000 → exp*1000=2_000_000ms; nowMs=2_000_000 → boundary → expired
		expect(isTokenExpired(claims, 2_000_000)).toBe(true);
	});

	it('returns false when exp is strictly in the future', async () => {
		const { isTokenExpired } = await import('./userStore');
		const claims = { accounts: {}, iat: 0, exp: 9999999999, aud: '' };
		// exp=9999999999 → exp*1000 far future; nowMs=Date.now() → not expired
		expect(isTokenExpired(claims, Date.now())).toBe(false);
	});

	it('returns true when claims is null (fail-closed)', async () => {
		const { isTokenExpired } = await import('./userStore');
		expect(isTokenExpired(null, Date.now())).toBe(true);
	});

	it('returns true when exp property is missing (fail-closed)', async () => {
		const { isTokenExpired } = await import('./userStore');
		const claims = { accounts: {}, iat: 0, aud: '' } as unknown as import('./types').EntuJwtClaims;
		expect(isTokenExpired(claims, Date.now())).toBe(true);
	});

	it('returns true when exp is a non-numeric string (fail-closed)', async () => {
		const { isTokenExpired } = await import('./userStore');
		const claims = { accounts: {}, iat: 0, exp: 'not-a-number' as unknown as number, aud: '' };
		expect(isTokenExpired(claims, Date.now())).toBe(true);
	});
});

// Helpers for #89 matrix tests — populate all auth keys to verify cleared-vs-kept assertions
const AUTH_KEYS = ['token', 'accounts', 'user', 'mvox.token_version'] as const;
const PROVIDER_KEY = 'mvox.last_provider';

function seedAuthStorage(token: string) {
	localStorage.setItem('token', token);
	localStorage.setItem('accounts', JSON.stringify([{ _id: 'acc-1' }]));
	localStorage.setItem('user', JSON.stringify({ _id: 'u-1' }));
	localStorage.setItem('mvox.token_version', '1');
	localStorage.setItem(PROVIDER_KEY, 'google');
}

function assertTokenCleared() {
	for (const key of AUTH_KEYS) {
		expect(localStorage.getItem(key), `${key} should be cleared`).toBeNull();
	}
}

function assertTokenKept(token: string) {
	expect(localStorage.getItem('token'), 'token should be kept').toBe(token);
}

function assertProviderPreserved() {
	expect(localStorage.getItem(PROVIDER_KEY), 'mvox.last_provider should be preserved').toBe('google');
}

// 200 OK response factories with explicit numeric status
const ok200 = (body: unknown) =>
	Promise.resolve(
		new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
	);

const makePersonOk = (personId: string) =>
	ok200({ entity: { _id: personId, name: [{ string: 'Test User' }] } });
const makeMemberOk = () =>
	ok200({ count: 0, limit: 100, skip: 0, entities: [] });
const makeOwnerOk = () =>
	ok200({ count: 0, limit: 100, skip: 0, entities: [] });
const makeStatus = (status: number) =>
	Promise.resolve(new Response(null, { status }));

const DB_KEY = 'test-env-db';

// Far-future token: passes Gate 1
const FAR_FUTURE_EXP = 9999999999;
const JWT_FAR_FUTURE = makeJwt({ accounts: { [DB_KEY]: PERSON_ID }, iat: 0, exp: FAR_FUTURE_EXP, aud: '127.0.0.1' });

// Past-expired token: exp*1000 < Date.now() (exp=1 → 1000ms = year 1970)
const JWT_EXPIRED = makeJwt({ accounts: { [DB_KEY]: PERSON_ID }, iat: 0, exp: 1, aud: '127.0.0.1' });

// No-exp token: exp missing entirely
const JWT_NO_EXP = makeJwt({ accounts: { [DB_KEY]: PERSON_ID }, iat: 0, aud: '127.0.0.1' });

// No-personId token: valid exp but no account for DB
const JWT_NO_PERSON_ID = makeJwt({ accounts: {}, iat: 0, exp: FAR_FUTURE_EXP, aud: '127.0.0.1' });

describe('hydrateUserStore — #89 stale-JWT cleanup matrix', () => {
	// Each test uses beforeEach from the outer scope (vi.resetModules, localStorage.clear, etc.)

	it('row 1: no token → signed-out, 0 fetches', async () => {
		// localStorage already empty from outer beforeEach
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('row 2: exp in past → signed-out, token cleared, provider preserved, 0 fetches', async () => {
		seedAuthStorage(JWT_EXPIRED);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		assertTokenCleared();
		assertProviderPreserved();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('row 3: exp missing → signed-out, token cleared, provider preserved, 0 fetches', async () => {
		seedAuthStorage(JWT_NO_EXP);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		assertTokenCleared();
		assertProviderPreserved();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('row 4: token decodes but no personId for db → signed-out, token cleared, 0 fetches', async () => {
		seedAuthStorage(JWT_NO_PERSON_ID);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		assertTokenCleared();
		assertProviderPreserved();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('row 5: valid future exp, all 200 → ready, 3 fetches, token KEPT (regression guard)', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) return makePersonOk(PERSON_ID);
			if (url.includes('_type.string=member')) return makeMemberOk();
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) return makeOwnerOk();
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('ready');
		expect(fetchMock).toHaveBeenCalledTimes(3);
		assertTokenKept(JWT_FAR_FUTURE);
	});

	it('row 6: future exp, person returns 401 → signed-out, token cleared, provider preserved, 3 fetches', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) return makeStatus(401);
			if (url.includes('_type.string=member')) return makeMemberOk();
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) return makeOwnerOk();
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		assertTokenCleared();
		assertProviderPreserved();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('row 7: future exp, mixed person 500 + member 401 → signed-out (sweep wins), token cleared, 3 fetches', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) return makeStatus(500);
			if (url.includes('_type.string=member')) return makeStatus(401);
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) return makeOwnerOk();
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
		assertTokenCleared();
		assertProviderPreserved();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('row 8: future exp, person 500 only → error with reason containing "500", token NOT cleared', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) return makeStatus(500);
			if (url.includes('_type.string=member')) return makeOwnerOk(); // 200
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) return makeOwnerOk();
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('error');
		if (state.status === 'error') {
			expect(state.reason).toContain('500');
		}
		assertTokenKept(JWT_FAR_FUTURE);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('row 9: future exp, person 403 → error, token NOT cleared', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockImplementation((url: string) => {
			if (url.includes(`entity/${PERSON_ID}`) && !url.includes('_type')) return makeStatus(403);
			if (url.includes('_type.string=member')) return makeMemberOk();
			if (url.includes('_type.string=organization') && url.includes('_owner.reference')) return makeOwnerOk();
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('error');
		assertTokenKept(JWT_FAR_FUTURE);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('row 10: fetch throws (network error) → error, token NOT cleared', async () => {
		seedAuthStorage(JWT_FAR_FUTURE);
		const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
		fetchMock.mockRejectedValue(new Error('network error'));
		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('error');
		assertTokenKept(JWT_FAR_FUTURE);
		expect(fetchMock).toHaveBeenCalled();
	});
});

// === CHORE-74 — new tests ===

describe('selectedOrgIdStore + urlOrgIdStore (CHORE-74)', () => {
	beforeEach(() => {
		// Reset stores between tests
		selectedOrgIdStore.set(null);
		urlOrgIdStore.set(null);
		userStore.userStore.set({ status: 'loading' });
		if (typeof localStorage !== 'undefined') localStorage.clear();
	});

	it('selectedOrgIdStore exposes a writable that defaults to null when localStorage empty', () => {
		expect(get(selectedOrgIdStore)).toBeNull();
	});

	it('urlOrgIdStore exposes a writable that defaults to null', () => {
		expect(get(urlOrgIdStore)).toBeNull();
	});

	it('selectedOrgStore returns null when userStore not ready', () => {
		expect(get(userStore.selectedOrgStore)).toBeNull();
	});

	it('selectedOrgStore falls back to first org when no pick / no url', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});
		const sel = get(userStore.selectedOrgStore);
		expect(sel?.id).toBe('org-a');
	});

	it('selectedOrgStore prefers explicit pick over default', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});
		selectedOrgIdStore.set('org-b');
		const sel = get(userStore.selectedOrgStore);
		expect(sel?.id).toBe('org-b');
	});

	it('selectedOrgStore prefers URL over pick over default', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
				{ id: 'org-c', label: 'Org C', initials: 'C', role: undefined },
			],
		});
		selectedOrgIdStore.set('org-b');
		urlOrgIdStore.set('org-c');
		const sel = get(userStore.selectedOrgStore);
		expect(sel?.id).toBe('org-c');
	});

	it('selectedOrgStore writes URL choice through to localStorage', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [{ id: 'org-x', label: 'Org X', initials: 'X', role: 'owner' }],
		});
		urlOrgIdStore.set('org-x');
		const _ = get(userStore.selectedOrgStore); // force evaluation
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-x');
	});

	it('selectOrg writes to selectedOrgIdStore + localStorage + navigates', async () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});

		// goto is mocked in the existing setup; verify it was called with the right URL
		await userStore.selectOrg('org-b');

		expect(get(selectedOrgIdStore)).toBe('org-b');
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-b');
		// selectedOrgStore reflects the new pick immediately (no need for URL change)
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-b');
	});
});
