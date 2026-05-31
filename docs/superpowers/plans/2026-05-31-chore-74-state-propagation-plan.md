# CHORE-74 — State propagation — Implementation Plan

> **For team agents:** Team-driven plan; tasks owned by named roles (Tallis RED → Byrd GREEN → Bentham REVIEW → Josquin MERGE). Per `feedback_plan_execution_mode_baked_in`: do NOT offer a mode fork after this plan ships. Per `feedback_atomic_git_chaining`: chain commits inside single Bash calls. Per `feedback_no_parallel_branches` Level 1 + Level 2: strictly sequential, one branch + one active task at a time.

> **SEQUENCING DISCIPLINE** (same shape as CHORE-72): only `chore/state-propagation` is active; only one task is dispatched at a time; each task fully closes (commit pushed + gates green + handoff received) before the next dispatches; no pre-spawning; team-lead is the serializer.

**Goal:** Fix the manual-refresh-required behavior after (a) successful login and (b) org change, by making in-tab state mutations propagate to UI via properly-notified Svelte stores.

**Architecture:** Introduce two new writable stores (`selectedOrgIdStore`, `urlOrgIdStore`); rewrite `selectedOrgStore` as a multi-store derive over `[userStore, urlOrgIdStore, selectedOrgIdStore]`; wire URL `?org=X` reactively to `urlOrgIdStore` via a `+layout.svelte` `$effect`; add `await hydrateUserStore()` in the auth/callback flow before the redirect; mirror the `/library` re-hydration `$effect` into `LandingDashboardScatter`.

**Tech Stack:** SvelteKit 2 · Svelte 5 (Runes only) · TypeScript strict · Vitest (happy-dom).

**Spec:** `docs/superpowers/specs/2026-05-31-chore-74-state-propagation-design.md` (committed at `57285b6`).

**Branch:** `chore/state-propagation` (created in Task 1).

**Total tasks:** 7. Estimated wall-clock: ~3-4 hours.

---

## Branch + setup

### Task 1: Create feature branch

**Owner:** team-lead.

- [ ] **Step 1: Verify clean state on main**

```bash
cd /home/michelek/workspace
git checkout main
git pull --ff-only
git status --short
```

- [ ] **Step 2: Create + push branch**

```bash
git checkout -b chore/state-propagation
git push -u origin chore/state-propagation
git branch --show-current  # expect chore/state-propagation
```

- [ ] **Step 3: Hand off to Tallis for Task 2 RED.**

---

## Store refactor

### Task 2: userStore — `selectedOrgIdStore` + `urlOrgIdStore` + multi-store `selectedOrgStore` + `selectOrg` three-write

**Files:**
- Modify: `src/lib/auth/userStore.ts`
- Modify: `src/lib/auth/userStore.spec.ts`

This task introduces the new stores AND rewrites `selectedOrgStore` AND updates `selectOrg`. All coupled — one task.

- [ ] **Step 1: Tallis RED** — append the following test block to `src/lib/auth/userStore.spec.ts` (do NOT remove existing tests). Read the existing file first to find the right insertion point + matching imports:

```ts
// === CHORE-74 — new tests ===

import { get } from 'svelte/store';

describe('selectedOrgIdStore + urlOrgIdStore (CHORE-74)', () => {
	beforeEach(() => {
		// Reset stores between tests
		selectedOrgIdStore.set(null);
		urlOrgIdStore.set(null);
		userStore.set({ status: 'loading' });
		if (typeof localStorage !== 'undefined') localStorage.clear();
	});

	it('selectedOrgIdStore exposes a writable that defaults to null when localStorage empty', () => {
		expect(get(selectedOrgIdStore)).toBeNull();
	});

	it('urlOrgIdStore exposes a writable that defaults to null', () => {
		expect(get(urlOrgIdStore)).toBeNull();
	});

	it('selectedOrgStore returns null when userStore not ready', () => {
		expect(get(selectedOrgStore)).toBeNull();
	});

	it('selectedOrgStore falls back to first org when no pick / no url', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});
		const sel = get(selectedOrgStore);
		expect(sel?.id).toBe('org-a');
	});

	it('selectedOrgStore prefers explicit pick over default', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});
		selectedOrgIdStore.set('org-b');
		const sel = get(selectedOrgStore);
		expect(sel?.id).toBe('org-b');
	});

	it('selectedOrgStore prefers URL over pick over default', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
				{ id: 'org-c', label: 'Org C', initials: 'C', role: undefined },
			],
		});
		selectedOrgIdStore.set('org-b');
		urlOrgIdStore.set('org-c');
		const sel = get(selectedOrgStore);
		expect(sel?.id).toBe('org-c');
	});

	it('selectedOrgStore writes URL choice through to localStorage', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [{ id: 'org-x', label: 'Org X', initials: 'X', role: 'owner' }],
		});
		urlOrgIdStore.set('org-x');
		const _ = get(selectedOrgStore); // force evaluation
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-x');
	});

	it('selectOrg writes to selectedOrgIdStore + localStorage + navigates', async () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			orgs: [
				{ id: 'org-a', label: 'Org A', initials: 'A', role: 'owner' },
				{ id: 'org-b', label: 'Org B', initials: 'B', role: undefined },
			],
		});

		// goto is mocked in the existing setup; verify it was called with the right URL
		await selectOrg('org-b');

		expect(get(selectedOrgIdStore)).toBe('org-b');
		expect(localStorage.getItem('mvox.selectedOrgId')).toBe('org-b');
		// selectedOrgStore reflects the new pick immediately (no need for URL change)
		expect(get(selectedOrgStore)?.id).toBe('org-b');
	});
});
```

**Note:** the spec ALSO needs `selectedOrgIdStore` + `urlOrgIdStore` imported at the top (alongside the existing `selectedOrgStore`, `userStore`, `selectOrg`). Add them to the import line at the top of the spec.

Pre-format with `pnpm biome format --write src/lib/auth/userStore.spec.ts` before handing off.

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/auth/userStore.spec.ts 2>&1 | tail -25
```

Expect: FAIL — `selectedOrgIdStore` + `urlOrgIdStore` not exported yet. Hand off to Byrd — no commit.

- [ ] **Step 3: Byrd GREEN — modify userStore.ts**

Read the existing `src/lib/auth/userStore.ts`. Apply these changes:

**3a.** Below the existing `userStore` declaration (currently around line 21), add the two new writables:

```ts
export const selectedOrgIdStore: Writable<string | null> = writable(
	typeof localStorage !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null,
);

export const urlOrgIdStore: Writable<string | null> = writable(null);
```

**3b.** Export the URL param key for layout use (add to the file header section near the constants):

```ts
export const ORG_URL_PARAM_NAME = ORG_URL_PARAM;
```

(Alternative: export `ORG_URL_PARAM` directly. Use whichever doesn't break existing imports — check via `grep -rn "ORG_URL_PARAM" src/` first.)

**3c.** Delete the existing `selectedOrgStore` declaration. Replace with the multi-store derive:

```ts
export const selectedOrgStore: Readable<Org | null> = derived(
	[userStore, urlOrgIdStore, selectedOrgIdStore],
	([$user, $urlOrgId, $selectedOrgId]) => {
		if ($user.status !== 'ready' || $user.orgs.length === 0) return null;

		// 1. URL wins; write-through to localStorage
		const fromUrl = $urlOrgId ? $user.orgs.find((o) => o.id === $urlOrgId) : undefined;
		if (fromUrl) {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(SELECTED_ORG_KEY, fromUrl.id);
			}
			return fromUrl;
		}

		// 2. Explicit pick
		const fromPick = $selectedOrgId ? $user.orgs.find((o) => o.id === $selectedOrgId) : undefined;
		if (fromPick) return fromPick;

		// 3. Default to first org
		return $user.orgs[0];
	},
);
```

**3d.** Delete the now-unused `readOrgParam()` helper (the URL is now propagated via the layout effect, not read from window directly).

**3e.** Replace `selectOrg` with the three-write version:

```ts
export async function selectOrg(orgId: string): Promise<void> {
	const state = get(userStore);
	if (state.status !== 'ready') return;
	if (!state.orgs.find((o) => o.id === orgId)) return;

	selectedOrgIdStore.set(orgId);
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

- [ ] **Step 4: Byrd — run gates**

```bash
pnpm test src/lib/auth/userStore.spec.ts -- --run
pnpm check && pnpm lint
```

Expect: all userStore.spec.ts tests pass (existing + 7 new); check + lint clean.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/state-propagation
git add src/lib/auth/userStore.ts src/lib/auth/userStore.spec.ts
git commit -m "$(cat <<'EOF'
feat(#74): selectedOrgIdStore + urlOrgIdStore + multi-store selectedOrgStore

Introduce two new writables (`selectedOrgIdStore`, `urlOrgIdStore`)
and rewrite `selectedOrgStore` as a derive over [userStore,
urlOrgIdStore, selectedOrgIdStore]. `selectOrg` now writes all three
channels (localStorage + selectedOrgIdStore + URL navigation).

This is the foundation for B-2/B-3 fix; layout wires URL into
urlOrgIdStore in Task 3. After this commit, picking an org via
OrgPicker propagates to selectedOrgStore reactively (no refresh).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

## Layout URL propagation

### Task 3: `+layout.svelte` `$effect` — URL → `urlOrgIdStore`

**Files:**
- Modify: `src/routes/+layout.svelte`

No spec for this task — the effects are simple plumbing exercisable indirectly through the userStore tests. Manual verification post-CHORE.

- [ ] **Step 1: Byrd — modify `+layout.svelte`**

Read the existing file. Apply these changes inside the existing `<script>`:

**1a.** Update the import line to include the new stores + URL param constant:

```ts
import {
	userStore,
	selectedOrgStore,
	pickerModeStore,
	hydrateUserStore,
	urlOrgIdStore,
	selectedOrgIdStore,
} from '$lib/auth/userStore';
```

(If `ORG_URL_PARAM_NAME` was the export chosen in Task 2, import it too. Otherwise hardcode `'org'` — choose the cleaner option.)

**1b.** Add two `$effect` blocks AFTER the existing `onMount(...)` call but BEFORE the `$derived` declarations:

```ts
// CHORE-74: reactive URL → urlOrgIdStore propagation
$effect(() => {
	if (!mounted) return;
	urlOrgIdStore.set(page.url.searchParams.get('org'));
});

// CHORE-74: URL precedence write-through to selectedOrgIdStore
// (keeps two-write symmetry per URL-overrides-persisted rule)
$effect(() => {
	if (!mounted) return;
	const urlOrgId = page.url.searchParams.get('org');
	if (urlOrgId) selectedOrgIdStore.set(urlOrgId);
});
```

- [ ] **Step 2: Byrd — run gates**

```bash
pnpm check && pnpm test:unit && pnpm lint
```

Expect: 0 errors, all tests pass, lint clean.

- [ ] **Step 3: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/state-propagation
git add src/routes/+layout.svelte
git commit -m "$(cat <<'EOF'
feat(#74): +layout.svelte $effect — URL ?org= → urlOrgIdStore (+ write-through)

Layout watches page.url reactively via $app/state's `page`; pushes
URL changes to urlOrgIdStore + maintains write-through to
selectedOrgIdStore for URL-overrides-persisted two-write symmetry.

This is the wire that makes B-3 (URL ?org= reactivity) work and
also catches direct navigations to ?org=X from any source.
EOF
)"
git push
```

---

## Login flow fix

### Task 4: `auth/callback` — `await hydrateUserStore()` before redirect

**Files:**
- Modify: `src/routes/auth/callback/+page.svelte`
- Modify: `src/routes/auth/callback/page.spec.ts`

- [ ] **Step 1: Tallis RED**

Read existing `src/routes/auth/callback/page.spec.ts`. Append a new test case (inside the same `describe` block, or in its own describe — match existing style):

```ts
import * as userStoreModule from '$lib/auth/userStore';

// existing tests stay

it('calls hydrateUserStore() before goto() on successful exchange (CHORE-74)', async () => {
	const callOrder: string[] = [];

	vi.spyOn(userStoreModule, 'hydrateUserStore').mockImplementation(async () => {
		callOrder.push('hydrate');
	});
	const gotoMock = vi.fn(async () => {
		callOrder.push('goto');
	});
	// goto is already mocked in existing setup — verify the mock instance is the same
	// or override the mock for this test

	// ... existing happy-path setup that lands at exchangeState === 'success' ...

	// After the exchange completes:
	expect(callOrder).toEqual(['hydrate', 'goto']);
});
```

**Note:** the existing spec may not have a clean way to assert call order. If not, the simplest approach is to mock `hydrateUserStore` (verify it was called) AND mock `goto` (verify it was called AFTER hydrate — using `vi.fn()` with `mock.invocationCallOrder`). Use whichever vitest API is idiomatic for the existing spec.

Pre-format. Hand off — no commit.

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/routes/auth/callback/page.spec.ts 2>&1 | tail -15
```

Expect FAIL — `hydrateUserStore` is not called by the current callback page.

- [ ] **Step 3: Byrd GREEN — modify callback page**

Read `src/routes/auth/callback/+page.svelte`. Locate `runExchange()`. Add `await hydrateUserStore()` between `setLastProvider(...)` and `exchangeState = 'success'`:

```ts
// in the existing imports, add:
import { hydrateUserStore } from '$lib/auth/userStore';

// in runExchange(), insert before exchangeState = 'success':
await hydrateUserStore();

exchangeState = 'success';
goto(decoded.return_to || '/');
```

- [ ] **Step 4: Byrd — gates**

```bash
pnpm test src/routes/auth/callback/page.spec.ts -- --run
pnpm check && pnpm lint
```

Expect: new test passes; all existing callback tests still pass.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/state-propagation
git add src/routes/auth/callback/+page.svelte src/routes/auth/callback/page.spec.ts
git commit -m "$(cat <<'EOF'
fix(#74): auth/callback awaits hydrateUserStore() before redirect (B-1)

After successful OAuth exchange, the callback wrote token+accounts+
user to localStorage and `goto`'d to the destination. But `goto()` is
SPA navigation — it doesn't re-mount the layout, so the layout's
onMount hydrateUserStore() doesn't re-run. The user landed on the
destination page with $userStore stuck on signed-out until manual
page reload.

Fix: await hydrateUserStore() inline before goto(). Token is already
in localStorage at that point; hydrate reads it + updates $userStore
to ready before navigation.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

## Dashboard scatter re-hydration

### Task 5: `LandingDashboardScatter` — `$effect` mirrors `/library` re-hydration

**Files:**
- Modify: `src/lib/components/landing/LandingDashboardScatter.svelte`
- Modify: `src/lib/components/landing/LandingDashboardScatter.spec.ts`

- [ ] **Step 1: Tallis RED**

Read existing spec. Append a new test that drives an org change through the mocked `selectedOrgStore` + asserts `hydrateLibrarySection` was called with the new org id. May need to mock `getToken`, `decodeJwt`, and `hydrateLibrarySection` directly:

```ts
import { vi } from 'vitest';

const hydrateLibrarySectionSpy = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return {
		librarySectionStore: store,
		hydrateLibrarySection: hydrateLibrarySectionSpy,
	};
});

vi.mock('$lib/auth/storage', () => ({
	getToken: () => 'fake.jwt.token',
}));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable({ status: 'ready', name: 'Test', initial: 'T', orgs: [] });
	const selectedOrgStore = writable({ id: 'org-a', label: 'A', initials: 'A' });
	return {
		userStore,
		selectedOrgStore,
		decodeJwt: () => ({ accounts: { 'test-db': 'person-id' } }),
	};
});

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-db' }));

// existing tests stay

import { selectedOrgStore } from '$lib/auth/userStore';

it('re-hydrates librarySectionStore when selectedOrgStore changes (CHORE-74)', async () => {
	hydrateLibrarySectionSpy.mockClear();
	const { container } = render(LandingDashboardScatter, { orgInitials: 'A' });

	// Initial render fires the effect once
	await new Promise((r) => setTimeout(r, 0));
	expect(hydrateLibrarySectionSpy).toHaveBeenCalledWith({ orgId: 'org-a', personId: 'person-id' });

	// Switch org
	hydrateLibrarySectionSpy.mockClear();
	selectedOrgStore.set({ id: 'org-b', label: 'B', initials: 'B' });
	await new Promise((r) => setTimeout(r, 0));
	expect(hydrateLibrarySectionSpy).toHaveBeenCalledWith({ orgId: 'org-b', personId: 'person-id' });
});
```

(Note: `selectedOrgStore` is mocked as a writable; the test sets it directly. The mock pattern needs care to ensure the component subscribes to the writable; verify by checking existing tests in this file.)

Pre-format. Hand off — no commit.

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/landing/LandingDashboardScatter.spec.ts 2>&1 | tail -15
```

Expect FAIL — component doesn't have the `$effect` yet, so `hydrateLibrarySection` is never called.

- [ ] **Step 3: Byrd GREEN — modify `LandingDashboardScatter.svelte`**

Read current file. Add to the `<script>`:

```ts
import { getToken } from '$lib/auth/storage';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { userStore, decodeJwt } from '$lib/auth/userStore';
import { hydrateLibrarySection } from '$lib/library/libraryStore';

// after existing $derived declarations, add:
$effect(() => {
	const org = $selectedOrgStore;
	const user = $userStore;
	if (!org || user.status !== 'ready') return;
	const token = getToken();
	if (!token) return;
	const claims = decodeJwt(token);
	const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
	if (!personId) return;
	hydrateLibrarySection({ orgId: org.id, personId });
});
```

Note: the import for `selectedOrgStore` may already exist in the file (used by the existing `$derived.by` block for the library meta). Verify before adding a duplicate import.

- [ ] **Step 4: Byrd — gates**

```bash
pnpm test src/lib/components/landing/LandingDashboardScatter.spec.ts -- --run
pnpm check && pnpm test:unit && pnpm lint
```

Expect: spec test passes; full suite passes (this is the integration moment for the dashboard flow).

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/state-propagation
git add src/lib/components/landing/LandingDashboardScatter.svelte src/lib/components/landing/LandingDashboardScatter.spec.ts
git commit -m "$(cat <<'EOF'
fix(#74): LandingDashboardScatter $effect re-hydrates libraryStore on org change

Mirror the pattern from /library/+page.svelte (line 44-53): when
selectedOrgStore changes, fire hydrateLibrarySection(...) so the
dashboard's Library card meta refreshes for the new org without a
page reload.

Future refactor: lift this $effect into librarySectionStore itself
(subscribe to selectedOrgStore once at module init) once a 3rd+
consumer page lands. Out of scope today.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

## Review

### Task 6: Bentham — branch review

**Owner:** Bentham (review-only).

- [ ] **Step 1: Read every commit** — `git log --oneline main..HEAD`; `git diff --stat main...HEAD`.

- [ ] **Step 2: Discrete gate calls per CALIBRATION-PNPM-CHECK-FRESH-RUN:**
   - `pnpm check`
   - `pnpm test:unit`
   - `pnpm lint`
   - `pnpm build`
   Quote verbatim COMPLETED / Tests passed lines.

- [ ] **Step 3: Spec-vs-impl audit on the 8 ACs from #74.**

- [ ] **Step 4: Verify URL-overrides-persisted rule is satisfied** by the new wiring (URL beats selectedOrgIdStore in the derive; layout effect propagates URL changes; selectOrg writes URL last so navigation triggers the effect).

- [ ] **Step 5: Spot-check per-commit-GREEN.** Each commit on the branch should pass `pnpm check` independently.

- [ ] **Step 6: Verify no regression in existing `library/+page.svelte` $effect** — that page should still re-hydrate on org change (it has its own equivalent effect; the new layout effects shouldn't conflict).

- [ ] **Step 7: Write review report** — verdict GREEN / YELLOW-74.N / RED-74.N. SendMessage to team-lead.

---

## Merge

### Task 7: Josquin — merge + deploy + close #74 + delete branch

**Owner:** Josquin.

- [ ] **Step 1: Merge main into chore branch** (per CHORE-72 lesson: merge-shape integrity):

```bash
git checkout chore/state-propagation
git pull
git fetch origin
git merge origin/main
```

If conflicts surface (likely zero — this CHORE touches different files than what's on main since last merge), surface-and-stop.

- [ ] **Step 2: Re-run gates on merged tip** (discrete bash calls):
   - `pnpm build`
   - `pnpm check`
   - `pnpm test:unit`
   - `pnpm lint`
   - `pnpm build` (final)

- [ ] **Step 3: Squash to main:**

```bash
git checkout main && git pull
MVOX_EXPECTED_BRANCH=main git merge --squash chore/state-propagation
MVOX_EXPECTED_BRANCH=main git commit -m "$(cat <<'EOF'
fix(#74): state propagation — login + org-change auto-update UI

Eliminate the manual-page-refresh requirement after (a) successful
login and (b) OrgPicker org change. Both symptoms shared a root
cause: Svelte stores weren't being notified of in-tab state
mutations, so derived stores and $effect consumers didn't re-run.

Changes:
- userStore exports two new writables (selectedOrgIdStore,
  urlOrgIdStore) — separate "what's selected" from "what's
  available"
- selectedOrgStore rewritten as multi-store derive over
  [userStore, urlOrgIdStore, selectedOrgIdStore] with resolution
  precedence URL > pick > first-org
- selectOrg writes all three channels (localStorage + new store +
  URL navigation)
- +layout.svelte adds two $effect blocks watching page.url
  reactively; one pushes URL ?org= to urlOrgIdStore, one
  write-through to selectedOrgIdStore (two-write symmetry per
  URL-overrides-persisted rule)
- auth/callback awaits hydrateUserStore() before goto(); the
  destination page now sees $userStore = ready immediately
- LandingDashboardScatter mirrors the /library re-hydration
  $effect so dashboard Library card meta refreshes on org change

Architecturally also enforces the URL-overrides-persisted rule
(architecture-decisions.md session 22) in code — previously
asserted by precedence but not propagated reactively.

No schema impact. No copy/i18n changes.

Closes #74

Reviewed-by: Bentham
Contributors: Tallis, Byrd
EOF
)"
```

**L104 reminder:** NO `Co-authored-by:` lines in body — hook adds PO trailer.

- [ ] **Step 4: Push** — `MVOX_EXPECTED_BRANCH=main git push`

- [ ] **Step 5: Wrangler deploy:**

```bash
source ~/.config/mvox/credentials.env
pnpm build
pnpm wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox
```

- [ ] **Step 6: Probe production:**

```bash
curl -sI https://mvox.eu/ | head -6
curl -sI https://multivox.pages.dev/ | head -6
```

Expect 200 + `x-sveltekit-page: true` + new chunk hashes.

- [ ] **Step 7: Close GH #74:**

```bash
gh issue close 74 -c "Closed by squash <SHA>. Deployed at <per-build URL>. PO should verify the two flows (login + org-switch) work without manual refresh."
```

- [ ] **Step 8: Delete branch:**

```bash
git branch -D chore/state-propagation
git push origin --delete chore/state-propagation
```

- [ ] **Step 9: Report to team-lead** with squash SHA, per-build URL, new chunk hashes, GH #74 closure link, gate output quoted.

---

## Self-review checklist (run by team-lead)

- [x] **Spec coverage:** all 8 ACs from #74 map to tasks. AC1-B-1 = Task 4; AC2-B-2 = Task 2; AC3 = Task 5; AC4-B-3 = Tasks 2+3; AC5-7 = full-suite gates; AC8 = Task 6.
- [x] **No placeholders.** Every step has actual code blocks + verifiable commands.
- [x] **Type consistency:** `Writable<string | null>` for both new stores; `derived(...)` with 3-tuple input + 3-tuple destructuring in resolver; `selectOrg` async returns Promise<void>.
- [x] **Plan execution mode:** team-driven only.
- [x] **Sequencing discipline:** explicit at the top.

(*MVOX:Palestrina*)
