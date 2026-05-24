# CHORE-66 — Navbar Auth Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire MvoxNav to real authenticated state — user identity from the localStorage JWT (Path C) + organization picker driven by URL `?org=` ↔ localStorage ↔ first-org default — replacing the hardcoded prop values CHORE-60 left in place.

**Architecture:** Browser-direct (Path C). A new client-side Svelte store (`userStore`) hydrates once on app mount via a single Entu fetch, then derives selected-org from the URL-overrides-persisted rule (`architecture-decisions.md` `3a37e42`). MvoxNav grows an `orgPickerMode` prop (placeholder / static / dropdown) derived from `orgs.length`; a new `OrgPicker.svelte` renders only in dropdown mode. Zero new BFF routes.

**Tech Stack:** SvelteKit 2, Svelte 5 (Runes), TypeScript strict, Tailwind v4, Paraglide, Vitest, pnpm. Per-commit-GREEN discipline (`architecture-decisions.md` 2026-05-23 entry). Co-authored-by trailers stay out of commit bodies; the prepare-commit-msg hook adds the PO trailer (2026-05-24 entry).

**Spec:** `docs/superpowers/specs/2026-05-24-navbar-auth-wiring-design.md`

---

## File structure

| Path | Status | Owner | Responsibility |
|---|---|---|---|
| `src/lib/auth/types.ts` | NEW | Josquin | Shared types: `Org`, `UserState`, `EntuPersonResponse`. The v4E query contract lives here as TSDoc on `EntuPersonResponse`. |
| `src/lib/auth/userStore.ts` | NEW | Byrd | `userStore` (writable) + `selectedOrgStore` (derived). Exports `hydrateUserStore()` + `selectOrg(orgId)`. Handles JWT decode, Entu fetch, URL-overrides-persisted resolution, two-write on change. |
| `src/lib/auth/userStore.spec.ts` | NEW | Tallis | Unit tests for hydration, fallback chain, edge cases, two-write symmetry. |
| `src/lib/components/OrgPicker.svelte` | NEW | Byrd | Dropdown menu component, rendered only in dropdown mode. Click handler calls `selectOrg`. |
| `src/lib/components/OrgPicker.spec.ts` | NEW | Tallis | Open / close / select / URL update / localStorage write / escape / outside-click. |
| `src/lib/components/MvoxNav.svelte` | UPDATE | Byrd | Add `orgPickerMode` prop, mount OrgPicker conditionally. Existing `orgLabel`/`orgInitials` props preserved. |
| `src/lib/components/MvoxNav.spec.ts` | UPDATE | Tallis | Existing assertions + three mode-rendering tests. |
| `src/routes/+layout.svelte` | UPDATE | Byrd | Invoke `hydrateUserStore()` on mount; resolve selected-org via store; pass props to MvoxNav. |
| `messages/{en,et,lv,uk}.json` | UPDATE | Comenius | New keys: `nav_org_picker_placeholder`, `nav_org_picker_switch_to`. |

---

## Task 1: Create branch + v4E query contract

**Owner:** Josquin
**Files:**
- Create: `src/lib/auth/types.ts`

- [ ] **Step 1: Create the branch from main**

```bash
git checkout main && git pull && git checkout -b chore/navbar-auth-wiring
```

- [ ] **Step 2: Create `src/lib/auth/types.ts`**

Create the directory if it doesn't exist (`mkdir -p src/lib/auth`), then write:

```ts
/**
 * Auth types — Path C client-side identity + org-membership state.
 *
 * The userStore hydrates from the localStorage Entu JWT (decode for sub +
 * any inline fields) + one Entu fetch per session.
 */

/**
 * A single organisation the user has membership in.
 *
 * `role` is captured here for future use (role-derived navbar chip CHORE)
 * but is not consumed by CHORE-66.
 */
export type Org = {
	/** Entu org entity ID. */
	id: string;
	/** Display name for chip + dropdown. */
	label: string;
	/** 1-3 character initials derived from label. */
	initials: string;
	/** Future use: 'librarian' | 'conductor' | 'admin' | 'member'. Omitted in CHORE-66. */
	role?: string;
};

/**
 * The resolved user state. The store moves through these tagged variants:
 *   loading → (signed-out | ready | error)
 *
 * `signed-out` is the terminal state when no JWT is present on mount.
 * `error` is reserved for fetch failure (JWT decode succeeded but Entu fetch failed).
 */
export type UserState =
	| { status: 'loading' }
	| { status: 'signed-out' }
	| { status: 'ready'; name: string; initial: string; orgs: Org[] }
	| { status: 'error'; reason: string };

/**
 * v4E query contract — Person + members + parent orgs.
 *
 * Endpoint: GET https://api.entu.app/{db}/entity/{personId}?props=name,members,members._parent
 *   - {db} = polyphony (dev) | mvox (future prod)
 *   - Base URL form is the unified `api.entu.app/<db>/` per CHORE-50 — NOT per-db subdomains (architecture-decisions.md, ENTU_API_BASE).
 *   - Production callers should consume `src/lib/entu-config.ts` rather than hardcoding the base.
 *   - Authorization header: Bearer <JWT from localStorage>
 *
 * Response mapping → Org[]:
 *   For each `members[i]`:
 *     - Read `_parent[0].reference` → org entity id
 *     - Fetch the org entity name (single-hop via `?props=name` on /entity/{orgId})
 *     - Map to Org: { id, label: org.name[0].string, initials: derive(label), role: undefined }
 *
 * For CHORE-66 the simplest path is: hydrate person → for each member, do one
 * concurrent fetch for the org name. Polyphony seed has 8 members under EFK
 * Library so worst-case is 8 small concurrent fetches per hydration.
 *
 * Optimisation deferred: a single batched query via `?expand=members._parent`
 * (Entu API supports nested prop expansion). Confirm shape during impl; if it
 * works, use it instead of N+1.
 */
export type EntuPersonResponse = {
	_id: string;
	name?: Array<{ string: string }>;
	members?: Array<{
		_id: string;
		_parent?: Array<{ reference: string }>;
	}>;
};

/**
 * Helper for chip/dropdown initials. 1-3 chars, uppercase, ASCII-fallback friendly.
 * Examples: "EFK Library" → "EL"; "Tartu Akadeemiline Meeskoor" → "TAM"; "Õla" → "Õ".
 */
export function deriveInitials(label: string): string {
	const words = label.trim().split(/\s+/).slice(0, 3);
	return words.map((w) => w[0]?.toLocaleUpperCase() ?? '').join('').slice(0, 3);
}
```

- [ ] **Step 3: Verify check + lint + build**

```bash
pnpm check && pnpm lint && pnpm build
```
Expected: 0 errors, clean lint, clean build (the file is consumed by nothing yet so types stand on their own).

- [ ] **Step 4: Probe Entu to verify the contract**

Run a one-shot probe against polyphony to verify the response shape matches `EntuPersonResponse`. Use a fresh sign-in or a stashed token (`~/.config/mvox/credentials.env` if it carries an Entu JWT; otherwise sign in via the dev server).

Pérotin's session-19 seed put 8 person+member pairs under EFK Library. Ask him for the test-librarian person ID via SendMessage if not documented. Then:

```bash
# Replace <PERSON_ID> + <JWT> with real values
curl -s -H "Authorization: Bearer <JWT>" \
  "https://api.entu.app/polyphony/entity/<PERSON_ID>?props=name,members,members._parent" | jq .
```

Expected shape: `{ _id, name: [{string}], members: [{ _id, _parent: [{reference}] }] }`. If the actual shape differs (e.g., property names case-sensitive, extra envelope), adjust `EntuPersonResponse` + the userStore mapping accordingly before commit.

Optional: probe `?expand=members._parent` to see if it returns the parent org name inline (would avoid N+1):

```bash
curl -s -H "Authorization: Bearer <JWT>" \
  "https://api.entu.app/polyphony/entity/<PERSON_ID>?props=name,members,members._parent&expand=members._parent" | jq .
```

If `expand` works, update the TSDoc to recommend the single-query path and note that the userStore impl in Task 3 should batch via expand rather than N+1 concurrent fetches.

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/auth/types.ts
git commit -m "chore(#66): add auth types + v4E query contract"
git push -u origin chore/navbar-auth-wiring
```

Verify after push:
```bash
git log -1 --format='%(trailers)'
```
Expected: `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` (no other Co-authored-by lines).

Hand off to Comenius (Task 2) — branch ready for i18n keys.

---

## Task 2: Add 2 paraglide keys for org picker

**Owner:** Comenius
**Files:**
- Modify: `messages/en.json`, `messages/et.json`, `messages/lv.json`, `messages/uk.json`

- [ ] **Step 1: Pull the branch**

```bash
git fetch && git checkout chore/navbar-auth-wiring && git pull
```

- [ ] **Step 2: Add two keys to `messages/en.json` (alphabetical position)**

Insert in alphabetical order alongside existing `nav_*` keys:

```json
"nav_org_picker_placeholder": "No organizations",
"nav_org_picker_switch_to": "Switch to {orgName}",
```

`{orgName}` is the parameterized form so the dropdown can announce "Switch to EFK Library" etc. for accessibility (aria-label on each org button).

- [ ] **Step 3: Add the same keys to et / lv / uk**

| Key | et | lv | uk |
|---|---|---|---|
| `nav_org_picker_placeholder` | "Organisatsioone pole" | "Nav organizāciju" | "Немає організацій" |
| `nav_org_picker_switch_to` | "Lülitu: {orgName}" | "Pārslēgt uz {orgName}" | "Перейти до {orgName}" |

(Log to `teams/mvox-dev/memory/i18n-conventions.md` if any translation choice feels non-obvious.)

- [ ] **Step 4: Verify gates**

```bash
pnpm check && pnpm test:unit && pnpm lint && pnpm build
```
Expected: 0 errors; 436/436 tests (no test changes, keys are additive); clean lint; clean build (paraglide regenerates `src/lib/paraglide/messages.js`).

- [ ] **Step 5: Commit + push**

```bash
git add messages/en.json messages/et.json messages/lv.json messages/uk.json
git commit -m "chore(#66): add 2 paraglide keys for org picker"
git push
```

Verify trailer per Task 1 Step 5. Hand off to Byrd + Tallis (Task 3).

---

## Task 3: userStore + spec (atomic)

**Owner:** Byrd + Tallis (atomic commit — coordinate locally; one commit lands both files)
**Files:**
- Create: `src/lib/auth/userStore.ts`
- Create: `src/lib/auth/userStore.spec.ts`

- [ ] **Step 1: Pull**

```bash
git fetch && git checkout chore/navbar-auth-wiring && git pull
```

- [ ] **Step 2: Tallis — write `src/lib/auth/userStore.spec.ts`**

Use Vitest with happy-dom (existing convention). Cover: JWT decode (happy + missing + malformed), hydrate (success + Entu fetch error), URL → localStorage → first-org → null fallback chain, two-write symmetry (URL wins on read AND backfills localStorage), `selectOrg()` writes both URL + localStorage, picker mode derivation (orgs.length 0/1/multi).

```ts
/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// $app/navigation isn't a real module under vitest; mock goto to mutate location
vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

// Module under test (imported in each test after env setup)
let userStore: typeof import('./userStore');

const FAKE_JWT_HEADER = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
const FAKE_JWT_SIG = '';
const makeJwt = (payload: Record<string, unknown>) =>
	`${FAKE_JWT_HEADER}.${btoa(JSON.stringify(payload))}.${FAKE_JWT_SIG}`;

beforeEach(async () => {
	vi.resetModules();
	localStorage.clear();
	// Reset URL to a clean state
	window.history.replaceState({}, '', '/');
	// Stub fetch — each test sets its own behavior
	globalThis.fetch = vi.fn();
	userStore = await import('./userStore');
});

describe('userStore — initial state', () => {
	it('starts in loading state', () => {
		expect(get(userStore.userStore).status).toBe('loading');
	});
});

describe('hydrateUserStore — JWT decode', () => {
	it('moves to signed-out when no JWT in localStorage', async () => {
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
	});

	it('moves to signed-out when JWT is malformed', async () => {
		localStorage.setItem('mvox.entu_token', 'not-a-jwt');
		await userStore.hydrateUserStore();
		expect(get(userStore.userStore).status).toBe('signed-out');
	});
});

describe('hydrateUserStore — fetch + ready state', () => {
	it('moves to ready with name + orgs after successful fetch', async () => {
		localStorage.setItem('mvox.entu_token', makeJwt({ sub: 'person-1' }));
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
			if (url.includes('person-1')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({
						_id: 'person-1',
						name: [{ string: 'Test Librarian' }],
						members: [
							{ _id: 'm-1', _parent: [{ reference: 'org-efk' }] },
							{ _id: 'm-2', _parent: [{ reference: 'org-other' }] },
						],
					}),
				});
			}
			if (url.includes('org-efk')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ _id: 'org-efk', name: [{ string: 'EFK Library' }] }),
				});
			}
			if (url.includes('org-other')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ _id: 'org-other', name: [{ string: 'Other Org' }] }),
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});

		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.name).toBe('Test Librarian');
			expect(state.initial).toBe('T');
			expect(state.orgs).toHaveLength(2);
			expect(state.orgs[0]).toEqual({ id: 'org-efk', label: 'EFK Library', initials: 'EL', role: undefined });
		}
	});

	it('moves to error on fetch failure', async () => {
		localStorage.setItem('mvox.entu_token', makeJwt({ sub: 'person-1' }));
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('error');
	});

	it('moves to ready with empty orgs[] for person with no members', async () => {
		localStorage.setItem('mvox.entu_token', makeJwt({ sub: 'person-1' }));
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ _id: 'person-1', name: [{ string: 'Solo' }], members: [] }),
		});
		await userStore.hydrateUserStore();
		const state = get(userStore.userStore);
		expect(state.status).toBe('ready');
		if (state.status === 'ready') {
			expect(state.orgs).toEqual([]);
		}
	});
});

describe('selectedOrgStore — fallback chain', () => {
	const setReadyState = () => {
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
		setReadyState();
		window.history.replaceState({}, '', '/?org=org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('localStorage fallback when URL absent', () => {
		setReadyState();
		localStorage.setItem('mvox.selectedOrgId', 'org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});

	it('first-org default when URL + localStorage both absent', () => {
		setReadyState();
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('first-org default when URL param does not match any org id', () => {
		setReadyState();
		window.history.replaceState({}, '', '/?org=bogus');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-1');
	});

	it('two-write symmetry: URL wins AND backfills localStorage', () => {
		setReadyState();
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
			orgs: [{ id: 'org-1', label: 'One', initials: 'O' }, { id: 'org-2', label: 'Two', initials: 'T' }],
		});

		await userStore.selectOrg('org-2');

		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
		expect(new URL(window.location.href).searchParams.get('org')).toBe('org-2');
		expect(get(userStore.selectedOrgStore)?.id).toBe('org-2');
	});
});

describe('pickerMode — derived from orgs.length', () => {
	it('placeholder when 0 orgs', () => {
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', orgs: [] });
		expect(get(userStore.pickerModeStore)).toBe('placeholder');
	});
	it('static when 1 org', () => {
		userStore.userStore.set({ status: 'ready', name: 'T', initial: 'T', orgs: [{ id: 'a', label: 'A', initials: 'A' }] });
		expect(get(userStore.pickerModeStore)).toBe('static');
	});
	it('dropdown when multi-org', () => {
		userStore.userStore.set({
			status: 'ready', name: 'T', initial: 'T',
			orgs: [{ id: 'a', label: 'A', initials: 'A' }, { id: 'b', label: 'B', initials: 'B' }],
		});
		expect(get(userStore.pickerModeStore)).toBe('dropdown');
	});
});
```

- [ ] **Step 3: Byrd — write `src/lib/auth/userStore.ts`**

```ts
import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { ENTU_API_BASE } from '$lib/entu-config';
import type { EntuPersonResponse, Org, UserState } from './types';
import { deriveInitials } from './types';

const TOKEN_KEY = 'mvox.entu_token';
const SELECTED_ORG_KEY = 'mvox.selectedOrgId';
const ORG_URL_PARAM = 'org';

/** The authoritative user state. */
export const userStore: Writable<UserState> = writable({ status: 'loading' });

/**
 * Decode a JWT payload without verifying signature. JWTs are trusted here
 * because they came from Entu via our own auth callback; signature
 * verification happens server-side when the JWT is used as bearer.
 */
function decodeJwt(token: string): Record<string, unknown> | null {
	try {
		const [, payload] = token.split('.');
		if (!payload) return null;
		return JSON.parse(atob(payload));
	} catch {
		return null;
	}
}

/** Read the current URL `?org=` param without coupling to $app/stores. */
function readOrgParam(): string | null {
	if (typeof window === 'undefined') return null;
	return new URL(window.location.href).searchParams.get(ORG_URL_PARAM);
}

/**
 * Hydrate the userStore — one-shot mount-time fetch.
 *
 * 1. Read JWT from localStorage; missing or malformed → signed-out (terminal).
 * 2. Decode JWT for `sub` (Entu person ID).
 * 3. Fetch person entity + members; for each member, fetch parent org name.
 * 4. Map to UserState.ready; failure → UserState.error.
 *
 * Idempotent: safe to call multiple times; later calls overwrite earlier state.
 */
export async function hydrateUserStore(): Promise<void> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
	if (!token) {
		userStore.set({ status: 'signed-out' });
		return;
	}

	const claims = decodeJwt(token);
	if (!claims || typeof claims.sub !== 'string') {
		userStore.set({ status: 'signed-out' });
		return;
	}

	const personId = claims.sub;
	const db = 'polyphony'; // TODO: derive from env when prod is wired

	try {
		const personRes = await fetch(`${ENTU_API_BASE}/${db}/entity/${personId}?props=name,members,members._parent`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!personRes.ok) {
			userStore.set({ status: 'error', reason: `person fetch ${personRes.status}` });
			return;
		}
		const person = (await personRes.json()) as EntuPersonResponse;
		const name = person.name?.[0]?.string ?? '';
		const initial = name ? name[0].toLocaleUpperCase() : '';

		const memberOrgIds = (person.members ?? [])
			.map((m) => m._parent?.[0]?.reference)
			.filter((id): id is string => typeof id === 'string');

		const orgs: Org[] = await Promise.all(
			memberOrgIds.map(async (orgId) => {
				const res = await fetch(`${ENTU_API_BASE}/${db}/entity/${orgId}?props=name`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!res.ok) throw new Error(`org ${orgId} fetch ${res.status}`);
				const org = (await res.json()) as { _id: string; name?: Array<{ string: string }> };
				const label = org.name?.[0]?.string ?? orgId;
				return { id: orgId, label, initials: deriveInitials(label), role: undefined };
			}),
		);

		userStore.set({ status: 'ready', name, initial, orgs });
	} catch (err) {
		userStore.set({ status: 'error', reason: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * Derived store: the currently-selected Org per the URL-overrides-persisted rule.
 *
 * Resolution order:
 *   1. URL `?org=<id>` when present AND id matches an org in orgs[]
 *   2. localStorage `mvox.selectedOrgId` when present AND in orgs[]
 *   3. orgs[0] when any orgs exist
 *   4. null otherwise
 *
 * Two-write symmetry: when URL wins on read AND localStorage value differs,
 * backfill localStorage to the URL value so subsequent no-param navigations
 * inherit the deep-linked selection.
 */
export const selectedOrgStore: Readable<Org | null> = derived(userStore, ($user) => {
	if ($user.status !== 'ready' || $user.orgs.length === 0) return null;

	const urlOrgId = readOrgParam();
	const storedOrgId = typeof localStorage !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null;

	const fromUrl = urlOrgId ? $user.orgs.find((o) => o.id === urlOrgId) : undefined;
	if (fromUrl) {
		if (storedOrgId !== fromUrl.id && typeof localStorage !== 'undefined') {
			localStorage.setItem(SELECTED_ORG_KEY, fromUrl.id);
		}
		return fromUrl;
	}

	const fromStorage = storedOrgId ? $user.orgs.find((o) => o.id === storedOrgId) : undefined;
	if (fromStorage) return fromStorage;

	return $user.orgs[0];
});

/** Picker mode derived from orgs cardinality (exported for prop typing). */
export type OrgPickerMode = 'placeholder' | 'static' | 'dropdown';

/** Derived: picker mode based on orgs cardinality. */
export const pickerModeStore: Readable<OrgPickerMode> = derived(userStore, ($user) => {
	if ($user.status !== 'ready') return 'placeholder';
	if ($user.orgs.length === 0) return 'placeholder';
	if ($user.orgs.length === 1) return 'static';
	return 'dropdown';
});

/**
 * User-initiated org selection. Two-write: localStorage first (sync), then
 * URL via goto (async soft-nav). UI re-renders from selectedOrgStore.
 */
export async function selectOrg(orgId: string): Promise<void> {
	const state = get(userStore);
	if (state.status !== 'ready') return;
	const org = state.orgs.find((o) => o.id === orgId);
	if (!org) return;

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(SELECTED_ORG_KEY, orgId);
	}

	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		url.searchParams.set(ORG_URL_PARAM, orgId);
		await goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
	}
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test:unit src/lib/auth/userStore.spec.ts
```
Expected: all spec cases PASS. If any fail, debug — the impl + spec must align before commit.

- [ ] **Step 5: Verify full gates**

```bash
pnpm check && pnpm test:unit && pnpm lint && pnpm build
```
Expected: 0 errors; total test count = 436 + N new tests in the spec (≈14 new = 450); clean lint; clean build.

- [ ] **Step 6: Stage both files; commit; push**

Atomic commit (test + impl together per per-commit-GREEN):

```bash
git add src/lib/auth/userStore.ts src/lib/auth/userStore.spec.ts
git commit -m "feat(#66): userStore + selectedOrgStore + pickerModeStore"
git push
```

Verify trailer per Task 1 Step 5. Hand off to Task 4 (OrgPicker).

---

## Task 4: OrgPicker.svelte + spec (atomic)

**Owner:** Byrd + Tallis (atomic commit)
**Files:**
- Create: `src/lib/components/OrgPicker.svelte`
- Create: `src/lib/components/OrgPicker.spec.ts`

- [ ] **Step 1: Tallis — write `src/lib/components/OrgPicker.spec.ts`**

```ts
/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

import { userStore } from '$lib/auth/userStore';
import OrgPicker from './OrgPicker.svelte';

beforeEach(() => {
	localStorage.clear();
	window.history.replaceState({}, '', '/');
	userStore.set({
		status: 'ready',
		name: 'Test',
		initial: 'T',
		orgs: [
			{ id: 'org-1', label: 'EFK Library', initials: 'EL' },
			{ id: 'org-2', label: 'Other Org', initials: 'OO' },
		],
	});
});

describe('OrgPicker — rendering', () => {
	it('renders the chip closed by default', () => {
		const { container, queryByRole } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]');
		expect(chip).not.toBeNull();
		expect(queryByRole('menu')).toBeNull();
	});
});

describe('OrgPicker — open/close', () => {
	it('opens the dropdown when chip is clicked', async () => {
		const { container, findByRole } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		const menu = await findByRole('menu');
		expect(menu).not.toBeNull();
	});

	it('closes on Escape', async () => {
		const { container, findByRole, queryByRole } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		await findByRole('menu');
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(queryByRole('menu')).toBeNull();
	});
});

describe('OrgPicker — selection', () => {
	it('clicking an org writes URL + localStorage + closes menu', async () => {
		const { container, findByRole, queryByRole, findByText } = render(OrgPicker);
		const chip = container.querySelector('[data-testid="org-picker-chip"]') as HTMLElement;
		await fireEvent.click(chip);
		await findByRole('menu');
		const otherOrgBtn = await findByText('Other Org');
		await fireEvent.click(otherOrgBtn);

		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-2');
		expect(new URL(window.location.href).searchParams.get('org')).toBe('org-2');
		expect(queryByRole('menu')).toBeNull();
	});
});
```

- [ ] **Step 2: Byrd — write `src/lib/components/OrgPicker.svelte`**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { selectedOrgStore, selectOrg, userStore } from '$lib/auth/userStore';

	let open = $state(false);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	async function handleSelect(orgId: string) {
		await selectOrg(orgId);
		close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}

	$effect(() => {
		if (open) {
			window.addEventListener('keydown', handleKeyDown);
			return () => window.removeEventListener('keydown', handleKeyDown);
		}
	});

	const orgs = $derived($userStore.status === 'ready' ? $userStore.orgs : []);
	const selected = $derived($selectedOrgStore);
</script>

<div class="relative inline-block">
	<button
		type="button"
		data-testid="org-picker-chip"
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		class="inline-flex items-center gap-2 rounded px-2 py-1 text-sm font-medium hover:bg-stone-100"
	>
		<span class="font-sans">{selected?.initials ?? ''}</span>
		<span class="font-sans">{selected?.label ?? ''}</span>
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-md border border-stone-200 bg-white shadow-lg"
		>
			{#each orgs as org (org.id)}
				<button
					type="button"
					role="menuitem"
					aria-label={m.nav_org_picker_switch_to({ orgName: org.label })}
					onclick={() => handleSelect(org.id)}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 {selected?.id === org.id ? 'font-semibold' : ''}"
				>
					<span class="font-mono text-xs text-stone-500">{org.initials}</span>
					<span>{org.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:unit src/lib/components/OrgPicker.spec.ts
```
Expected: all PASS.

- [ ] **Step 4: Verify full gates**

```bash
pnpm check && pnpm test:unit && pnpm lint && pnpm build
```

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/components/OrgPicker.svelte src/lib/components/OrgPicker.spec.ts
git commit -m "feat(#66): OrgPicker dropdown component"
git push
```

Verify trailer. Hand off to Task 5 (MvoxNav).

---

## Task 5: MvoxNav — add orgPickerMode + conditional OrgPicker (atomic)

**Owner:** Byrd + Tallis (atomic commit)
**Files:**
- Modify: `src/lib/components/MvoxNav.svelte`
- Modify: `src/lib/components/MvoxNav.spec.ts`

- [ ] **Step 1: Tallis — update `src/lib/components/MvoxNav.spec.ts`**

Add three new test cases for picker modes. Existing tests stay; the new cases use the new `orgPickerMode` prop:

```ts
// Add to existing describe block; keep all current tests intact.

describe('MvoxNav — orgPickerMode', () => {
	it('placeholder mode renders placeholder copy and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: '',
				userInitial: '',
				orgLabel: '',
				orgInitials: '',
				orgPickerMode: 'placeholder',
			},
		});
		expect(container.textContent).toContain('No organizations');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('static mode renders orgLabel non-interactively and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'EFK Library',
				orgInitials: 'EL',
				orgPickerMode: 'static',
			},
		});
		expect(container.textContent).toContain('EFK Library');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('dropdown mode mounts the OrgPicker', () => {
		// userStore must be in ready+multi-org state for OrgPicker to render fully
		userStore.set({
			status: 'ready', name: 'Test', initial: 'T',
			orgs: [
				{ id: 'a', label: 'A', initials: 'A' },
				{ id: 'b', label: 'B', initials: 'B' },
			],
		});
		const { getByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'A',
				orgInitials: 'A',
				orgPickerMode: 'dropdown',
			},
		});
		expect(getByTestId('org-picker-chip')).not.toBeNull();
	});
});
```

(The existing spec file has a setup block; add the `import { userStore } from '$lib/auth/userStore'` and import `OrgPicker` if not already there.)

- [ ] **Step 2: Byrd — update `src/lib/components/MvoxNav.svelte`**

Add the `orgPickerMode` prop and conditional rendering. Preserve all existing slots/props/i18n calls from CHORE-62.

Replace the existing org-chip render with this pattern (exact line depends on current file; conceptually):

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import OrgPicker from './OrgPicker.svelte';
	import type { OrgPickerMode } from '$lib/auth/userStore';

	const {
		userName = '',
		userInitial = '',
		orgLabel = '',
		orgInitials = '',
		orgPickerMode = 'placeholder' as OrgPickerMode,
	}: {
		userName?: string;
		userInitial?: string;
		orgLabel?: string;
		orgInitials?: string;
		orgPickerMode?: OrgPickerMode;
	} = $props();

	// ... existing TAB_LABELS map + tab rendering stays ...
</script>

<!-- ... existing tab row ... -->

<!-- Replace existing static org chip with conditional render: -->
{#if orgPickerMode === 'placeholder'}
	<span class="text-sm text-stone-500">{m.nav_org_picker_placeholder()}</span>
{:else if orgPickerMode === 'static'}
	<span class="inline-flex items-center gap-2 rounded px-2 py-1 text-sm font-medium">
		<span class="font-sans">{orgInitials}</span>
		<span class="font-sans">{orgLabel}</span>
	</span>
{:else}
	<OrgPicker />
{/if}

<!-- ... existing user name + initial + LIBRARIAN chip + sign-in remain unchanged ... -->
```

Note: `orgPickerMode === 'dropdown'` mounts `<OrgPicker />` which reads `userStore` + `selectedOrgStore` directly — it does NOT need `orgLabel`/`orgInitials` props (it derives them from the store). Those props remain on MvoxNav for placeholder/static modes only.

- [ ] **Step 3: Run tests — verify all pass**

```bash
pnpm test:unit src/lib/components/MvoxNav.spec.ts
```
Expected: existing assertions PASS + 3 new mode tests PASS.

- [ ] **Step 4: Verify full gates**

```bash
pnpm check && pnpm test:unit && pnpm lint && pnpm build
```

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/components/MvoxNav.svelte src/lib/components/MvoxNav.spec.ts
git commit -m "feat(#66): MvoxNav orgPickerMode prop + conditional OrgPicker mount"
git push
```

Verify trailer. Hand off to Task 6 (+layout wiring).

---

## Task 6: +layout.svelte wiring

**Owner:** Byrd
**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Update `src/routes/+layout.svelte`**

Wire hydration on mount; derive props for MvoxNav from the store + selectedOrgStore + pickerModeStore:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore, selectedOrgStore, pickerModeStore, hydrateUserStore } from '$lib/auth/userStore';
	import MvoxNav from '$lib/components/MvoxNav.svelte';
	// ... existing imports stay ...

	const { children } = $props();

	onMount(() => {
		hydrateUserStore();
	});

	const userName = $derived($userStore.status === 'ready' ? $userStore.name : '');
	const userInitial = $derived($userStore.status === 'ready' ? $userStore.initial : '');
	const orgLabel = $derived($selectedOrgStore?.label ?? '');
	const orgInitials = $derived($selectedOrgStore?.initials ?? '');
	const orgPickerMode = $derived($pickerModeStore);
</script>

<!-- ... existing layout structure ... -->
<MvoxNav
	{userName}
	{userInitial}
	{orgLabel}
	{orgInitials}
	{orgPickerMode}
/>
<!-- ... rest of layout ... -->

{@render children()}
```

Preserve everything else in the existing +layout.svelte (CSS imports, paraglide setup, sign-in vs signed-in branching, etc.). The change is: replace whatever hardcoded MvoxNav prop values exist today with the derived stores.

- [ ] **Step 2: Verify gates**

```bash
pnpm check && pnpm test:unit && pnpm lint && pnpm build
```
Expected: 0 errors, all tests pass, clean lint + build.

- [ ] **Step 3: Manual smoke (local dev server)**

```bash
pnpm dev
```

In another terminal / browser:
- Open `http://localhost:5173/` → expect MvoxNav to render with placeholder chip (no JWT in localStorage initially).
- Sign in via the existing OAuth flow against polyphony.
- After sign-in, the navbar should show: user name + initial; org chip (static if librarian member is single-org, dropdown if multi-org).
- Switch org via the dropdown (if visible) → URL gains `?org=<id>`; reload → selection preserved.
- Hit `http://localhost:5173/?org=<some-other-org-id>` → on load, that org is selected even if a different one was stored.

If any flow misbehaves, debug and re-run gates before commit.

- [ ] **Step 4: Commit + push**

```bash
git add src/routes/+layout.svelte
git commit -m "feat(#66): wire MvoxNav to userStore + selectedOrgStore in +layout"
git push
```

Verify trailer. Hand off to Task 7 (Bentham review).

---

## Task 7: Branch review

**Owner:** Bentham
**Files:** read-only — review the branch end-to-end

- [ ] **Step 1: Pull + read the commit log**

```bash
git fetch && git checkout chore/navbar-auth-wiring && git pull
git log --oneline main..HEAD
```
Expected: 6 commits (Tasks 1-6) plus any tiny touch-ups.

- [ ] **Step 2: Spot-check per-commit-GREEN on at least one non-tip commit**

```bash
git checkout <SHA-of-Task-2-or-Task-3>
pnpm check && pnpm test:unit
git checkout chore/navbar-auth-wiring
```
Expected: each spot-checked commit passes both gates cleanly. If any commit fails, branch is YELLOW pending re-sequence (per per-commit-GREEN enforcement rule).

- [ ] **Step 3: Read each touched file end-to-end**

Files to read:
- `src/lib/auth/types.ts`
- `src/lib/auth/userStore.ts`
- `src/lib/auth/userStore.spec.ts`
- `src/lib/components/OrgPicker.svelte`
- `src/lib/components/OrgPicker.spec.ts`
- `src/lib/components/MvoxNav.svelte`
- `src/lib/components/MvoxNav.spec.ts`
- `src/routes/+layout.svelte`
- `messages/{en,et,lv,uk}.json` (diff only)

Review against:
- URL-overrides-persisted rule (your own `3a37e42` entry) — two-write symmetry preserved? Localstorage key convention `mvox.<scope>Id`?
- Per-commit-GREEN — each commit GREEN independently?
- Path C invariants — no new BFF routes? No direct `entu.app` calls from non-store code (the userStore is the one authorized client; OrgPicker / MvoxNav / +layout read from store only)?
- Svelte 5 Runes — no legacy `export let` / `$:`?
- L101 hardcoded-English heuristic — new .svelte files use `m.*()` for user-facing copy?
- L96 — any agent dispatched with `isolation: "worktree" + team_name`? (Probably not relevant here — solo branch, shared-tree fine.)

- [ ] **Step 4: Issue verdict**

RED / YELLOW / GREEN with rationale. Suggested squash-commit body sketch if GREEN. Hand off to Task 8 (Josquin) on GREEN.

---

## Task 8: Squash-merge + close #66

**Owner:** Josquin
**Files:** none — git ops

- [ ] **Step 1: Squash-merge to main**

```bash
git checkout main && git pull
git merge --squash chore/navbar-auth-wiring
```

- [ ] **Step 2: Commit (do NOT include Co-authored-by in body)**

```bash
git commit -m "$(cat <<'EOF'
feat(#66): navbar auth wiring — userStore + OrgPicker + layout integration

Closes #66 — wire MvoxNav to real authenticated state. Adds userStore
(Path C, localStorage JWT decode + one-shot Entu fetch hydrating user
identity + org memberships), selectedOrgStore (URL-overrides-persisted
rule per architecture-decisions 3a37e42, with two-write symmetry on
read-time divergence), pickerModeStore (placeholder/static/dropdown
derived from orgs cardinality). New OrgPicker.svelte renders only in
dropdown mode. MvoxNav gains orgPickerMode prop; +layout invokes
hydration on mount and threads derived props.

First enactment of feedback_ui_parallels_with_seed — Pérotin confirmed
the test-librarian member during impl; no schema gaps surfaced.

Out of scope: role-derived chip (CONDUCTOR/ADMIN/MEMBER), /library
data wiring (CHORE-67), 0-org onboarding flow.
EOF
)"
```

(Body free of `Co-authored-by:` so the prepare-commit-msg hook adds the PO trailer cleanly.)

- [ ] **Step 3: Push + verify trailer**

```bash
git push
git log -1 --format='%(trailers)'
```
Expected: `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` present.

- [ ] **Step 4: Delete branch (local + remote)**

```bash
git push origin --delete chore/navbar-auth-wiring
git branch -D chore/navbar-auth-wiring
```

- [ ] **Step 5: Verify GH #66 auto-closed**

```bash
gh issue view 66 --json state,closedAt
```
Expected: state `CLOSED`, closedAt within seconds of push.

- [ ] **Step 6: Report squash SHA to Palestrina**

Palestrina handles: closure comment on #66 + any follow-up issues (role-derived chip, 0-org onboarding) + CHORE-67 brainstorm/file (wire /library to real data, the natural next step).

---

## Cross-cutting reminders

- **Per-commit-GREEN**: every commit on this branch passes `pnpm check && pnpm test:unit && pnpm lint && pnpm build` independently. Surface-and-stop and re-sequence if a planned commit would leave a transient broken intermediate.
- **No `Co-authored-by:` in dispatch templates or commit bodies**: the prepare-commit-msg hook adds the PO trailer; manually-written `Co-authored-by:` lines short-circuit the hook (`9637eee` exemplar).
- **Atomic git chaining**: when running `git checkout && git commit && git push`, chain them in one Bash call where possible (defends against shared-tree branch flips).
- **No parallel branches**: this is the only feature branch active during CHORE-66.
- **Co-author trailer verification**: after every commit, run `git log -1 --format='%(trailers)'` and confirm the PO trailer is present.
