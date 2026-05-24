# CHORE-66 — Navbar Auth Wiring Design

**Date:** 2026-05-24 (session 22)
**Author:** Palestrina (team-lead)
**Status:** Design (awaiting PO review → implementation plan)
**Lineage:** Sibling to CHORE-60 (UI kit), CHORE-62 (i18n wiring). First step of the "UI parallels with seed" working-mode commitment ([[feedback_ui_parallels_with_seed]]).

## Purpose

Wire the MvoxNav navbar to real authenticated state — user identity and organization picker — replacing the hardcoded prop values currently passed in by the layout. This is the smallest meaningful step out of skin-only territory: the navbar starts reflecting who is logged in and which organization they're viewing.

This CHORE is intentionally **skin-wiring only**, not feature-page wiring. /library still renders fixtures after this CHORE ships. The org change has no visible effect on /library yet (CHORE-67 territory). The win is: navbar is real, deep-linking is real, and the auth → data path through Path C has its first end-to-end exercise.

## Scope

In scope:
- Decode the localStorage Entu JWT (Path C) for user identity.
- Fire one Entu fetch on mount to hydrate user display name + the user's organization memberships.
- Populate a Svelte store with the resolved user + org state.
- Resolve the selected organization via URL `?org=<id>` (source of truth when present) → localStorage `mvox.selectedOrgId` (fallback) → first-org-in-list (final default).
- MvoxNav: derive picker mode from org cardinality — placeholder (0 orgs) / static chip (1 org) / dropdown (multi-org).
- New `OrgPicker.svelte` component: the dropdown UI, rendered only in dropdown mode.
- Persistence: switching organization writes URL via soft-nav `goto` AND localStorage; reload preserves selection.

Out of scope (explicit):
- LIBRARIAN chip remains as wired in CHORE-62 — a hardcoded label per the librarian persona. Role-derived chip text (CONDUCTOR / ADMIN / MEMBER per selected org) is a follow-up CHORE.
- /library and other pages continue to render fixtures. Org change does not refetch any page data yet. CHORE-67+ wires individual feature pages.
- Onboarding flow for 0-org users. Placeholder copy only; no link to a (non-existent) onboarding route.
- Sign-out UX. Existing CHORE-60 wiring (`m.nav_sign_in()` / sign-out link) stays.
- Multi-account / account-switch UX (one Entu person at a time).

## Architecture

Path C is browser-direct: the JWT lives in localStorage, the SvelteKit server holds no session, and Entu queries happen from the browser. The navbar fits cleanly into that model — its hydration is a single client-side mount-time fetch.

### Data flow

1. **Mount-time hydration** (root layout):
   - Read JWT from localStorage at the established key (per Path C). Missing → user signed out → render existing CHORE-60 sign-in affordance; skip everything else.
   - Decode JWT for `sub` (Entu person ID) and any inline display fields.
   - Fire one Entu fetch to resolve the person entity + organization memberships. The exact v4E query is for Josquin to finalize; conceptually it returns `{ name, orgs: [{ id, label, initials, role }, ...] }`. The role field is captured here for future use but the chip stays hardcoded LIBRARIAN this CHORE.
   - Populate the Svelte store. Treat this fetch as authoritative for the session; refetch only on explicit re-auth.

2. **Selected-org resolution** (Svelte store, derived) — follows the project-wide URL-overrides-persisted rule (`architecture-decisions.md`, lifted in `3a37e42`). Two-write symmetry per Bentham's extension: when URL and localStorage disagree at read time, URL wins AND we backfill localStorage so the next no-params nav inherits the deep-linked value:
   - Read `$page.url.searchParams.get('org')`. If present AND the value matches an ID in `userStore.orgs` → use it.
   - Else read `localStorage.getItem('mvox.selectedOrgId')`. If present AND in `userStore.orgs` → use it.
   - Else use `userStore.orgs[0]` if any orgs exist; otherwise null.
   - On every page navigation, re-evaluate the URL param (since the user may have arrived via a deep link that carries `?org=`).
   - URL absent from everyday internal navigation; deep-links + shares carry it; persisted store handles the silent default. Two-write on user-initiated change (URL + localStorage) keeps both in sync.

3. **Picker action** (multi-org case):
   - Click picker chip → dropdown opens listing `userStore.orgs`.
   - Click an org →
     1. Write `localStorage.setItem('mvox.selectedOrgId', <new-id>)` directly (no event indirection).
     2. Soft-nav via `goto` to the current path with `?org=<new-id>` appended/replaced (Byrd picks the exact goto options; default behavior is fine).
   - URL change triggers a derived-store recompute → MvoxNav re-renders with new chip content.
   - On any subsequent page mount, the URL `?org=` wins over localStorage; reload preserves selection regardless of source.

4. **Cardinality presentation**:
   - 0 orgs → MvoxNav receives `orgPickerMode: 'placeholder'`; chip slot renders placeholder copy (Comenius supplies the localized string).
   - 1 org → `orgPickerMode: 'static'`; chip is non-interactive, shows the org's label + initials.
   - Multi-org → `orgPickerMode: 'dropdown'`; chip is a button; clicking it mounts the OrgPicker dropdown.

## Components

| File | Owner | Status | Purpose |
|---|---|---|---|
| `src/lib/auth/userStore.ts` | Byrd | NEW | Writable Svelte store + derived `selectedOrgStore`; hosts mount-time hydration + persistence logic |
| `src/routes/+layout.svelte` (or `+layout.ts`) | Byrd | UPDATE | Invokes userStore hydration on first mount; passes resolved props into MvoxNav |
| `src/lib/components/MvoxNav.svelte` | Byrd | UPDATE | Add `orgPickerMode` prop; gate dropdown UI on multi-org mode; preserve existing prop interface for static + placeholder |
| `src/lib/components/OrgPicker.svelte` | Byrd | NEW | Dropdown menu; renders only in dropdown mode |
| `src/lib/auth/userStore.spec.ts` | Tallis | NEW | Hydration, fallback chain, edge cases |
| `src/lib/components/MvoxNav.spec.ts` | Tallis | UPDATE | Existing assertions + three picker modes |
| `src/lib/components/OrgPicker.spec.ts` | Tallis | NEW | Open / close / select / URL update / localStorage write |
| `messages/{en,et,lv,uk}.json` | Comenius | UPDATE | 1–2 new keys: `nav_org_picker_placeholder`, possibly `nav_org_picker_switch_to` |

Server-side files: none. Path C means this CHORE adds zero BFF routes. Josquin's role here is finalizing the v4E query shape for the on-mount fetch — a thin contract definition, not BFF implementation.

## Data shapes

The store's exported shape:

```ts
type Org = { id: string; label: string; initials: string };

type UserState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; name: string; initial: string; orgs: Org[] }
  | { status: 'error'; reason: string };
```

The selected-org derived store resolves to `Org | null`; null means signed-out OR 0-org user.

The v4E query result needs to map to `Org[]`. Per the polyphony schema ([[project_polyphony_roles_as_rights]]), a Person has Member children that link to Org parents. The simplest query is one round trip that returns the person entity with its members + the members' parent orgs. Josquin finalizes the exact `?props=` shape; the contract for Byrd is just "the resolved store has `orgs[]` with id + display label + initials."

## Testing

Unit tests cover:
- JWT decode happy path + missing-JWT + expired-JWT
- Hydration fetch → ready vs error transitions
- Fallback chain: URL → localStorage → first-org → null
- localStorage write on picker selection
- URL param respected when present even if localStorage disagrees
- Picker mode derivation from `orgs.length`
- Dropdown open/close + escape + outside-click

Integration:
- Playwright smoke for "sign in → land on / → see name + chip → switch org → URL updates → reload preserves selection." Likely deferred to CHORE-C harness (no MSW + Entu mock layer yet); include here only if Tallis can wire it without lift.

## Working-mode note

This CHORE is the first concrete enactment of [[feedback_ui_parallels_with_seed]]. Even though it's skin-wiring (no feature-page data), Pérotin participates from kickoff: he confirms which seeded member in the polyphony bundle is the "test librarian" we develop against, and he flags any schema gaps the on-mount query reveals (e.g. if Person entities don't currently carry display name, that's a v4E schema discovery for entu/research).

## Open follow-ups (filed by team-lead post-merge)

- CHORE-67 (proposed): wire /library to the EFK Library catalog using the same userStore + selected-org context. Aggregate-by-work top-level + drill-down (modal or route, TBD in its own brainstorm).
- Role-derived navbar chip (CONDUCTOR / ADMIN / MEMBER per selected org's rights).
- Onboarding flow for 0-org users.
- Sign-out + multi-account UX revisit.

## References

- Path C arch decision: `Decisions/mvox/bff-user-rights-default`, `Decisions/mvox/path-c-browser-direct` (Brilliant)
- Roles as rights: [[project_polyphony_roles_as_rights]]
- UI aesthetic: [[feedback_mvox_hybrid_aesthetic]]
- UI + seed parallel: [[feedback_ui_parallels_with_seed]]
- CHORE-60 design spec: `docs/superpowers/specs/2026-05-23-library-page-ui-kit-design.md`
- CHORE-62 squash (current MvoxNav state): `9637eee`

(*MVOX:Palestrina*)
