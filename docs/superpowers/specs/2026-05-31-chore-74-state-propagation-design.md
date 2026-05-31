# CHORE-74 — State propagation: login + org-change auto-update UI — Design Spec

**Date:** 2026-05-31
**Status:** spec ready for plan
**GH issue:** #74
**Predecessor:** CHORE-66 (userStore + selectedOrgStore) · CHORE-67 (librarySectionStore) · CHORE-72 (landing page)

## Goal

Eliminate the manual-page-refresh requirement after (a) successful login and (b) OrgPicker org change. Both symptoms share a root cause: Svelte stores aren't being notified of in-tab state mutations, so derived stores and `$effect` consumers don't re-run.

Fix both with a small, architecturally honest refactor that also satisfies the **URL-overrides-persisted** rule (`architecture-decisions.md` session 22) — making URL `?org=X` reactive without breaking the existing store contract.

## Non-goals

- Cross-tab state synchronization beyond what the existing `storage` event listener already covers
- Avatar drop-down user menu (CHORE-75 — depends on this CHORE landing first)
- E2E Playwright coverage of auth + org-switch flows (CHORE-C scope)
- Any visual or copy changes — this is plumbing only
- Migration to `@inlang/paraglide` newer locale API (already deferred separately)

## Bug taxonomy (recap)

| Tag | Symptom | Root cause |
|---|---|---|
| **B-1** | Login → still see signed-out UI; refresh required | `auth/callback/+page.svelte` writes localStorage + `goto()`s without calling `hydrateUserStore()`. `goto()` is SPA navigation; `+layout.svelte` `onMount` doesn't re-run. Same-tab `storage` events don't fire (spec). |
| **B-2** | Org change → UI shows old org; refresh required | `selectedOrgStore = derived(userStore, ...)` — listens only to `userStore`. `selectOrg()` writes localStorage + navigates with `?org=X`, but neither path notifies `userStore`, so the derive doesn't re-run. |
| **B-3** | URL `?org=X` navigations don't propagate (latent) | The derive reads `window.location.href` directly via `readOrgParam()` — not via the reactive `page` store from `$app/state`. URL changes are invisible to the derivation. Latent today because no feature deep-links to an org, but it'll bite the moment one does. |

B-2 and B-3 are the **same architectural bug** seen at different surfaces: the derive doesn't track the inputs that should drive it.

## Architecture

### Current state (pre-CHORE-74)

```
userStore : Writable<UserState>
selectedOrgStore : derived(userStore, ...)  ← only re-runs on userStore change
                                              reads window.location + localStorage
                                              non-reactively (closure side effects)
selectOrg(orgId) : write localStorage, goto(?org=X)  ← neither notifies userStore
```

### Target state (post-CHORE-74)

```
userStore : Writable<UserState>                          (unchanged)
selectedOrgIdStore : Writable<string | null>             (NEW — user's explicit pick)
urlOrgIdStore : Writable<string | null>                  (NEW — reactive shadow of ?org= param)

selectedOrgStore : derived(
  [userStore, urlOrgIdStore, selectedOrgIdStore],
  resolver
)                                                         (re-runs on ANY of the 3 changing)

selectOrg(orgId) : write localStorage + selectedOrgIdStore + goto(?org=X)
                                                          (all 3 channels updated)
```

Plus, in `+layout.svelte`:

```ts
$effect(() => {
  // page from $app/state is reactive; this effect re-runs on URL changes
  const orgFromUrl = page.url.searchParams.get('org');
  urlOrgIdStore.set(orgFromUrl);
});
```

And in `auth/callback/+page.svelte`:

```ts
setToken(result.token);
setAccounts(result.accounts);
setUser(result.user);
localStorage.removeItem(OAUTH_STATE_KEY);
setLastProvider(decoded.provider);

await hydrateUserStore();  // ← NEW: notify userStore before redirect

exchangeState = 'success';
goto(decoded.return_to || '/');
```

### Resolution precedence (preserved from current behaviour, per URL-overrides-persisted rule)

The derive resolver chooses the active org in this order:

1. **URL** — if `?org=<id>` matches an available org, use it. Also write-through to `selectedOrgIdStore` + localStorage to keep persisted state in sync (two-write symmetry from URL).
2. **Explicit pick** — if `selectedOrgIdStore` has a value matching an available org, use it.
3. **localStorage fallback** — read once at initialization of `selectedOrgIdStore`. Same resolution as today's `readStoredOrgId()`.
4. **First org** — default if user is `ready` and has at least one org.
5. **null** — if no orgs available.

## Component contracts

### `userStore.ts` — modifications

**New exports:**

```ts
export const selectedOrgIdStore: Writable<string | null> = writable(
  typeof localStorage !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null
);

export const urlOrgIdStore: Writable<string | null> = writable(null);
```

**`selectedOrgStore` — rewrite as multi-store derive:**

```ts
export const selectedOrgStore: Readable<Org | null> = derived(
  [userStore, urlOrgIdStore, selectedOrgIdStore],
  ([$user, $urlOrgId, $selectedOrgId]) => {
    if ($user.status !== 'ready' || $user.orgs.length === 0) return null;

    // 1. URL wins; write-through to persisted state
    const fromUrl = $urlOrgId ? $user.orgs.find((o) => o.id === $urlOrgId) : undefined;
    if (fromUrl) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SELECTED_ORG_KEY, fromUrl.id);
      }
      // Note: also update selectedOrgIdStore inside the derive to maintain two-write symmetry —
      // BUT writes inside derived() can cause re-derivation loops. Instead, push the
      // selectedOrgIdStore update via an $effect in +layout.svelte that watches the URL.
      return fromUrl;
    }

    // 2. Explicit pick
    const fromPick = $selectedOrgId ? $user.orgs.find((o) => o.id === $selectedOrgId) : undefined;
    if (fromPick) return fromPick;

    // 3. Default to first
    return $user.orgs[0];
  }
);
```

**`selectOrg` — write all 3 channels:**

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

**Helper kept:** `readOrgParam()` is removed (no longer used — URL reactivity now flows through `urlOrgIdStore`).

### `+layout.svelte` — modifications

Add two `$effect` blocks (kept inside the existing `onMount` is wrong because effects don't compose with onMount; use top-level `$effect` instead):

```ts
import { page } from '$app/state';
import {
  userStore, selectedOrgStore, pickerModeStore,
  hydrateUserStore, urlOrgIdStore, selectedOrgIdStore  // ← new imports
} from '$lib/auth/userStore';

// existing onMount stays:
onMount(() => {
  hydrateUserStore();
  mounted = true;
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'token' || e.key === null) hydrateUserStore();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
});

// NEW: reactive URL → urlOrgIdStore propagation
$effect(() => {
  if (!mounted) return;
  urlOrgIdStore.set(page.url.searchParams.get(ORG_URL_PARAM));
});

// NEW: URL precedence write-through to selectedOrgIdStore
//   (keeps two-write symmetry per URL-overrides-persisted rule
//   without causing re-derivation loops in selectedOrgStore)
$effect(() => {
  if (!mounted) return;
  const urlOrgId = page.url.searchParams.get(ORG_URL_PARAM);
  if (urlOrgId) selectedOrgIdStore.set(urlOrgId);
});
```

(`ORG_URL_PARAM` is exported from userStore.ts for layout use.)

### `auth/callback/+page.svelte` — modifications

One-line change inside `runExchange()`:

```ts
setToken(result.token);
setAccounts(result.accounts);
setUser(result.user);
localStorage.removeItem(OAUTH_STATE_KEY);
setLastProvider(decoded.provider);

await hydrateUserStore();  // ← NEW

exchangeState = 'success';
goto(decoded.return_to || '/');
```

### `LandingDashboardScatter.svelte` — modifications

Already wired to `librarySectionStore` (Task 11 of CHORE-72), which is updated via an `$effect` on `/library/+page.svelte`. But the dashboard scatter on `/` doesn't trigger that effect — it just reads `librarySectionStore`. After this CHORE, the dashboard scatter needs its OWN `$effect` to re-hydrate `librarySectionStore` when `selectedOrgStore` changes:

```ts
import { userStore, selectedOrgStore, decodeJwt } from '$lib/auth/userStore';
import { getToken } from '$lib/auth/storage';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { librarySectionStore, hydrateLibrarySection } from '$lib/library/libraryStore';

// existing props + meta logic unchanged

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

This is structurally identical to the `/library/+page.svelte` effect at line 44-53 — same pattern, same dependencies. Worth a small note: when more pages start consuming `librarySectionStore`, this effect logic should move into the store itself (`librarySectionStore` could subscribe to `selectedOrgStore` once at module init). Out of scope for this CHORE — flagged as a follow-up.

## Tests

### `userStore.spec.ts` — new test cases

Append to the existing spec:

- `selectedOrgIdStore` initializes from localStorage on module load
- `urlOrgIdStore` defaults to null
- `selectedOrgStore` resolves URL > pick > first when all three sources offer a candidate
- `selectedOrgStore` falls back through precedence when higher sources are null
- `selectOrg(id)` updates `selectedOrgIdStore` + localStorage + navigates (mock `goto`); verifies `selectedOrgStore` reflects the new value on the next read

### `+layout.spec.ts` — new file or extend existing

(Currently no layout spec exists.) Cover:

- `$effect` propagates URL `?org=` changes to `urlOrgIdStore`
- `$effect` write-through updates `selectedOrgIdStore` when URL changes

### `auth/callback/page.spec.ts` — extend existing

Add: `hydrateUserStore()` is called BEFORE `goto()` on success. Mock both; verify call order.

### `LandingDashboardScatter.spec.ts` — extend existing

Add: switching the mocked `selectedOrgStore` value re-fires `hydrateLibrarySection` with the new org ID. (May need to also mock `getToken` + `decodeJwt`.)

## Acceptance criteria (from GH #74)

1. AC1: After successful OAuth callback, `$userStore` transitions to `ready` before the user sees the destination page (no refresh required).
2. AC2: After OrgPicker selection, `$selectedOrgStore` reflects the new choice within the same tick (no refresh required).
3. AC3: Same OrgPicker selection updates `$librarySectionStore` on the dashboard (Library card meta refreshes).
4. AC4: URL `?org=X` navigations trigger `$selectedOrgStore` re-evaluation per URL-overrides-persisted rule.
5. AC5: Existing 545 unit tests still pass.
6. AC6: New unit specs cover: post-login auto-hydration; selectOrg → selectedOrgStore update; URL change → selectedOrgStore update.
7. AC7: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm build` clean.
8. AC8: Bentham review GREEN.

## Files touched

| Status | File | Why |
|---|---|---|
| Modify | `src/lib/auth/userStore.ts` | Add `selectedOrgIdStore` + `urlOrgIdStore`; rewrite `selectedOrgStore` as multi-store derive; update `selectOrg`; export `ORG_URL_PARAM`; remove `readOrgParam` |
| Modify | `src/lib/auth/userStore.spec.ts` | New cases for the multi-store derive + selectOrg three-write |
| Modify | `src/routes/+layout.svelte` | Add 2 `$effect` blocks for URL → urlOrgIdStore + selectedOrgIdStore propagation |
| New | `src/tests/routes/landing/layout.spec.ts` (or colocated alongside layout.svelte if convention allows) | Cover URL→store effects. Note: per CHORE-72 Task 14 lesson, route-spec files outside `src/routes/` |
| Modify | `src/routes/auth/callback/+page.svelte` | Add `await hydrateUserStore()` before `goto()` |
| Modify | `src/routes/auth/callback/page.spec.ts` | Cover the new call-order assertion |
| Modify | `src/lib/components/landing/LandingDashboardScatter.svelte` | Add `$effect` to re-hydrate librarySectionStore on selectedOrgStore change |
| Modify | `src/lib/components/landing/LandingDashboardScatter.spec.ts` | Cover the new effect (mock librarySectionStore + selectedOrgStore) |

**Total: ~8 files** (some are spec extensions to existing files).

## Schema impact

None. No new entity types, no new properties, no rights changes.

## Architecture decisions referenced

- **URL-overrides-persisted** (session 22, settled): satisfied by step 2 of the fix
- **Vertical-skin neutrality** (2026-05-31, settled): no impact

## Open questions / deferred

- **librarySectionStore as a self-subscribing store** (subscribes to `selectedOrgStore` internally instead of relying on consumer `$effect`s): cleaner design once 3+ pages consume it. Out of scope; file as a follow-up if more consumers land.
- **Cross-tab login propagation refinement** — the `storage` event listener catches cross-tab `token` changes today. Behavior preserved; no scope change.
- **Test coverage of `selectedOrgStore` precedence in edge cases** (URL points at an org the user no longer has access to, etc.) — covered by existing fall-through logic; new specs cover the happy path only.

## Related

- `feedback_mvox_visual_personality` — no impact (no UI changes)
- `architecture-decisions.md` "URL parameters override persisted state" (session 22) — this CHORE makes that rule actually enforceable in code
- CHORE-66 (`9266e2e`) — original userStore + selectedOrgStore landing
- CHORE-67 (`386ea87`) — librarySectionStore landing
- CHORE-72 (`29de0d2`) — LandingDashboardScatter consumer

(*MVOX:Palestrina*)
