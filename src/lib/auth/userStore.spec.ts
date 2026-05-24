// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

let userStore: typeof import('./userStore');

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
const DB = 'polyphony';
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
			if (url.includes(`entity/${PERSON_ID}`)) {
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
			if (url.includes(`entity/${PERSON_ID}`)) {
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
			if (url.includes(`entity/${PERSON_ID}`)) {
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
	const setReadyWithTwoOrgs = () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
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
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', orgs: [] });
		expect(get(userStore.selectedOrgStore)).toBeNull();
	});

	it('URL param wins when present and valid', () => {
		setReadyWithTwoOrgs();
		window.history.replaceState({}, '', '/?org=org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('localStorage fallback when URL absent', () => {
		setReadyWithTwoOrgs();
		localStorage.setItem('mvox.selectedOrgId', 'org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('first-org default when URL + localStorage both absent', () => {
		setReadyWithTwoOrgs();
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('first-org default when URL param does not match any org id', () => {
		setReadyWithTwoOrgs();
		window.history.replaceState({}, '', '/?org=bogus');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('two-write symmetry: URL wins AND backfills localStorage', () => {
		setReadyWithTwoOrgs();
		localStorage.setItem('mvox.selectedOrgId', 'org-1');
		window.history.replaceState({}, '', '/?org=org-2');
		const resolved = get(userStore.selectedOrgStore);
		expect(resolved?.id).toBe('org-2');
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
	});
});

describe('selectOrg — two-write on user change', () => {
	it('writes localStorage and updates URL', async () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
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

describe('pickerModeStore — derived from orgs.length', () => {
	it('placeholder when status is loading', () => {
		expect(get(userStore.pickerModeStore)).toBe('placeholder');
	});

	it('placeholder when 0 orgs', () => {
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', orgs: [] });
		expect(get(userStore.pickerModeStore)).toBe('placeholder');
	});

	it('static when 1 org', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			orgs: [{ id: 'a', label: 'A', initials: 'A' }],
		});
		expect(get(userStore.pickerModeStore)).toBe('static');
	});

	it('dropdown when 2+ orgs', () => {
		userStore.userStore.set({
			status: 'ready',
			name: 'T',
			initial: 'T',
			orgs: [
				{ id: 'a', label: 'A', initials: 'A' },
				{ id: 'b', label: 'B', initials: 'B' },
			],
		});
		expect(get(userStore.pickerModeStore)).toBe('dropdown');
	});
});
