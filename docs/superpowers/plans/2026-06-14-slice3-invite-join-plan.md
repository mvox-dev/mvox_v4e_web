# Slice 3 — Invite & Join — Implementation Plan (finalized)

**Date:** 2026-06-14 (session 35) · **Author:** (*MVOX:Palestrina*)
**Spec:** `docs/superpowers/specs/2026-06-12-mvp-rehearsal-attendance-loop-design.md` §4 slice 3 + §6 (elevated BFF op)
**Issues:** #21 (admin invite) + #11 (singer accept)
**Branch:** `feat/invite-join` (single-tree protocol; one branch at a time)

This finalizes the PO-handed slice-3 plan with the Phase-0 resolutions. Slice 3 is the last MVP piece: the way a singer actually gets *into* an org through the app.

---

## Phase 0 results (DONE — gating, now green)

- **All three entity types exist live** in polyphony (Pérotin, `docs/migration/findings/slice3-invite-join-probes-2026-06-14.md`, commit `f2679c8`). The S32 fear that `application` was absent is **resolved**.
- **No v4E schema mutation** — we create instances of existing types. ⇒ **No `Schema-Change:` / `PO-Approved:` trailers required.** Bentham must NOT RED for schema.
- **cf-worker-jwt-binding** (7/7 green, `docs/migration/findings/cf-worker-jwt-binding-2026-06-12.md`): a CF function can mint an Entu JWT from a service API key and use it **same-invocation** (shared egress IP satisfies Entu's `aud=IP`). This is the mechanism for the elevated endpoints.

### Live entity shapes (Pérotin)

| Entity | Type ID | Parent | `_sharing` | Props |
|---|---|---|---|---|
| `invitation` | `6a0d2e8290c8df7a1cc7de3e` | **org** | private (does NOT inherit org domain) | `email`(str,M), `token`(str,M), `expires_at`(date,M), `sections`(ref,list), `inviter`(ref), `message`(text) |
| `application` | `6a0d2e8390c8df7a1cc7de81` | **person** | private | `target_org`(ref,M), `status`(str,M), `expires_at`(date,M), `message`(text) — **no `person` prop; `_parent` IS the person** |
| `member` | `69c7ea4a8489bfcb0e819edd` | **org (+ sections, multi-parent)** | domain | `name`(str,**M**), `person`(ref), `section`(ref,list), `current_section`(ref), `status`(str,M,domain) |

### Identity model — Path A (confirmed conclusively)

`application._parent` is the accepter's person entity. Entu rights guarantee only that person's own JWT can create a child under their person entity ⇒ **`application._parent` is cryptographic proof of identity**, no server-trusts-client-claim. The elevated accept endpoint reads `application._parent` as the verified accepter.

**Accept flow = Option 1 (forced).** Browser creates the `application` browser-direct under its own person with its own JWT (browser IP matches `aud`). It then calls the BFF accept endpoint, which uses the **service key only**. Option 2 (BFF forwards the user's JWT server-side) is **non-viable**: the user's JWT is IP-bound to the browser; used from the CF server it 401s (the documented `project_entu_jwt_ip_bound` wall, reconfirmed by the probe's stale-JWT 401 contrast).

### Service-key rights (min spec)

- **`_editor` on each org** (NOT `_owner`). Grants: create child entities (invitation, member), read org subtree. Creator auto-gets `_owner` on what it creates ⇒ can read/delete its own invitations + members.
- **CF secret name: `ENTU_SERVICE_KEY`** (distinct from the data-manager key). **Provisioning is PO-gated** — create a service-account person entity, add `entu_api_key` prop, grant `_editor` on each org, store raw key as `ENTU_SERVICE_KEY` CF secret on **preview** first. Not done; not blocking the build (build is unit-tested against mocks).

---

## Finn corrections to the original plan (folded in)

- **`CopyChip` is the wrong component** — it's an attendance checkbox cell. No clipboard component exists. Create **`src/lib/components/CopyLink.svelte`** (`navigator.clipboard.writeText`).
- **`createEntity` + `EntuProp` are NOT exported** from `entuSeasons.ts`. Follow the **`rsvpData.ts` precedent**: new module imports `resolveTypeId`, declares its own local `authHeaders`, inlines the prop-array POST to `${ENTU_API_BASE}${cfg.db}/entity`. Do not export internals.
- `EntuCfg {db, token}` is exported (`entuSeasons.ts`). `ENTU_API_BASE = 'https://api.entu.app/'` from `src/lib/entu-config.ts`. Auth exchange = `${ENTU_API_BASE}auth?db=${db}` (query-form).
- `safeRedirectTarget` → client-safe at `$lib/auth/redirect` (post-#80). The `/auth/login?redirect=…` round-trip works with **no code change** (login reads `redirect`||`return_to` → OAuth state → callback `goto`).
- `userStore` is **legacy `svelte/store`** (not runes) — consume via `$userStore` / `$selectedOrgStore`. Owner gate: `$selectedOrgStore?.role === 'owner'`.
- `listOrgMembers(cfg, orgId) → Array<{personId, name}>` exported. `DeskSurface{children}`, `PaperCard{rotate?, width?, children}`.
- `MvoxNav`: add `'members'` to `Tab` type + `TABS` as a **real route** (no `SoonMarker`), mirroring `'seasons'`; the page passes `currentTab="members"`.

---

## Architecture / data flow (unchanged from PO plan; Option 1)

```
Admin (owner JWT, client) --POST invitation (own JWT, native owner rights)--> Entu
  /members page shows copyable /invite/<token> link (CopyLink)

Singer opens /invite/<token>  (UNAUTHED, public route)
  page --GET /api/invite/<token>--> CF fn: mint service JWT + resolve token (same invocation) --> minimal projection {valid,expired,orgName,email,sections,message}
  page: "«Org» invites you" + Sign in to accept
  Sign in -> /auth/login?redirect=/invite/<token> -> OAuth -> back AUTHED
  Accept:
    page --POST application under singer's OWN person (own JWT)--> Entu   [identity proof]
    page --POST /api/invite/<token>/accept {applicationId}--> CF fn:
        mint service JWT; verify invitation valid+unexpired; read application(by id) -> personId = application._parent; verify application.target_org === invite.org;
        resolve person.name; create member(org[+sections], person, name, status:active); delete invitation + application (best-effort)
    page: "You've joined «Org»" -> goto('/agenda')
```

---

## Endpoint & data contracts (for Tallis RED + Josquin GREEN)

### `GET /api/invite/[token]` (public — resolve)
- Mint service JWT → `resolveInvitationByToken(jwt, token)`.
- Not found → 404-shaped `{ valid: false }` (do not distinguish existence vs expiry beyond `valid`/`expired`).
- `expired = expires_at < now`. Resolve `orgName` via one service GET on `invitation._parent` (the org).
- Return **minimal** `{ valid: true, expired, orgName, email, sections, message }`. NEVER return `token`, `inviter`, the full entity, or other invitations.
- Cases: valid, expired, unknown, malformed, missing-key (500).

### `POST /api/invite/[token]/accept` (public route, internal identity-proof — accept)
- Body: `{ applicationId }`. Mint service JWT.
- Re-verify invitation valid + not expired (recheck between resolve and accept).
- Read `application` by id → `personId = application._parent`; verify `application.target_org === invitation.org` else 403; person-parent absent → 403.
- **Idempotency:** if an active `member` for (personId, orgId) already exists → success, skip create, still clean up, return `{ ok, orgId, alreadyMember: true }`.
- Resolve `person.name` (service GET) for `member.name`.
- Create `member` (multi-parent org [+ invitation.sections]; `person`, `name`, `status:'active'`; `section[]`/`current_section` per live member shape — Josquin confirms exact shape against live instances, Pérotin advises).
- Delete `invitation` + `application` (best-effort; member is the durable outcome — if a delete fails, return ok + soft warning, mirror `deleteSeriesCascade`).
- Cases: happy path, expired-on-accept (410/expired shape), already-a-member (idempotent), missing application / identity-proof absent (403), org mismatch (403), missing-key (500).

### Client `src/lib/invite/inviteData.ts`
- `createInvitation(cfg, {orgId, email, sections?, message?, inviterPersonId})` — admin's own JWT; `token = crypto.randomUUID()`; `expires_at = now + 30d`; `resolveTypeId('invitation')` + inline prop-array POST. Returns `{ invitationId, token }`.
- `buildInviteUrl(origin, token) → ${origin}/invite/${token}`.
- `listOrgInvitations(cfg, orgId)` — pending invites for /members (`_type=invitation, _parent.reference=orgId`).
- `resolveInvite(token)` — client `fetch('/api/invite/'+token)` → projection.
- `createApplication(cfg, {personId, orgId, message?})` — singer's own JWT; `resolveTypeId('application')` + POST `[{_type},{_parent:personId},{target_org:orgId},{status:'active'},{expires_at}]`. Mirrors `createRsvp`. Returns `applicationId`.
- `acceptInvite(token, {applicationId})` — `fetch('/api/invite/'+token+'/accept', {method:'POST', ...})`.
- Reuse `EntuCfg`, local `authHeaders`, `ENTU_API_BASE`, `resolveTypeId`.

### Server helper `src/lib/server/entu/elevated.ts` (Josquin — pure, no SvelteKit deps, unit-testable via mocked `fetch`)
- `mintJwt(apiKey): Promise<string>` — `GET ${ENTU_API_BASE}auth?db=${db}` with `Bearer apiKey`; verify `accounts` non-empty; return `token`.
- `elevatedFetch(jwt, path, init?)` — authed Entu call against `${ENTU_API_BASE}${db}/…`.
- `resolveInvitationByToken(jwt, token)` → invitation | null.
- `readEntity(jwt, id)`, `resolvePersonName(jwt, personId)`, `createMember(jwt, {orgId, sections, personId, name})`, `findActiveMember(jwt, {personId, orgId})`, `deleteEntity(jwt, id)`.
- **Secret access:** `App.Platform.env.ENTU_SERVICE_KEY` (add to `src/app.d.ts`); read in endpoints via `event.platform?.env.ENTU_SERVICE_KEY`, dev fallback `$env/dynamic/private` (`process.env.ENTU_SERVICE_KEY`) so `pnpm dev`/tests work. `db` from `$env/static/public` `PUBLIC_ENTU_DB` (or `event.platform.env.PUBLIC_ENTU_DB`).

### Guard allowlist `src/lib/server/auth/session-cookie.ts`
- `isProtectedPath`: add `if (pathname.startsWith('/invite/')) return false;` and `if (pathname.startsWith('/api/invite/')) return false;`. Update `session-cookie.spec.ts`.

### Elevated-ops registry (Bentham — `architecture-decisions.md`)
- Add the two endpoints to the enumerated elevated-ops list with rationale (pre-approved by spec §6). **Must land before Bentham review** or he REDs the elevated-mode routes.

---

## TDD chain (single branch `feat/invite-join`, single-tree)

| Phase | Owner | Scope |
|---|---|---|
| RED | **Tallis** | `*.spec.ts` for: `elevated.ts`, resolve `+server.ts`, accept `+server.ts`, `session-cookie` allowlist, `inviteData.ts`, `CopyLink.svelte`, `InviteForm.svelte`, `/members` page, `/invite/[token]` page, `MvoxNav` members tab. Full-shape `toEqual` against realistic Entu wire shapes (per `feedback_partial_assertions_hide_bugs`). |
| GREEN | **Josquin** | server: `elevated.ts`, both endpoints, `app.d.ts` typing, `session-cookie` allowlist. Confirm exact `member` multi-parent POST shape against live instances. Then "API ready" → Byrd. |
| GREEN | **Byrd** | `inviteData.ts`, `CopyLink.svelte`, `InviteForm.svelte`, `/members/+page.svelte`, `/invite/[token]/+page.svelte`, `InviteLanding.svelte`, `MvoxNav` members tab. |
| i18n | **Comenius** | new keys ×4 locales (`members_*`, `nav_tab_members`, `invite_*`). |
| REVIEW | **Bentham** | RED/YELLOW/GREEN. Security focus: identity-proof logic, projection minimalism, no user-JWT server-side, elevated-ops registry entry present. |
| MERGE | **Josquin** | after Bentham GREEN + Palestrina approval. Squash, `Closes #21`, `Closes #11`. |

## Files at a glance

| New | Modified |
|---|---|
| `src/lib/server/entu/elevated.ts` (+spec) | `src/lib/server/auth/session-cookie.ts` (+spec) — allowlist |
| `src/routes/api/invite/[token]/+server.ts` (+spec) | `src/app.d.ts` — `App.Platform.env.ENTU_SERVICE_KEY` |
| `src/routes/api/invite/[token]/accept/+server.ts` (+spec) | `src/lib/components/MvoxNav.svelte` (+spec) — Members tab |
| `src/lib/invite/inviteData.ts` (+spec) | `messages/{en,et,lv,uk}.json` — new keys |
| `src/lib/components/CopyLink.svelte` (+spec) | `teams/.../architecture-decisions.md` — elevated-ops registry |
| `src/lib/components/members/InviteForm.svelte` (+spec) | `docs/operations/deploy.md` — `ENTU_SERVICE_KEY` secret step |
| `src/routes/members/+page.svelte` (+spec) | |
| `src/routes/invite/[token]/+page.svelte` (+spec) | |
| `src/lib/components/invite/InviteLanding.svelte` (+spec) | |

## Verification (the part that needs PO)

1. **Unit:** `pnpm test` all green; `pnpm check` 0. (Autonomous.)
2. **Preview smoke** (after PO provisions `ENTU_SERVICE_KEY`): `GET /api/invite/<seeded-token>` on preview → 200 projection; expired/unknown → expected error shapes.
3. **Live E2E (PO, preview):** owner creates invite on `/members` → copy link → open unauthed/incognito → "«EFK» invites you" → sign in → accept → land `/agenda` → confirm new `member` exists + invitation gone → RSVP to close the MVP loop.
4. **Negative live:** expired token → clear error; already-accepted link → graceful (idempotent).
5. Prod `mvox.eu` untouched until PO sign-off. (Note: every push to main auto-deploys — keep slice on the branch until verified; merge is the prod release.)

## Risks / open items

- **`ENTU_SERVICE_KEY` provisioning is the one PO-gated dependency** — nothing live-tests until it exists as a CF preview secret with `_editor` per org. Build proceeds without it (mocked).
- **`member.name`** mandatory on live db → BFF supplies `person.name`. Whether schema.ts should retire `member.name` is a deferred cleanup, not this slice.
- **No email** (copy-link only; #6 blocked on PO SPF/DKIM).
- After ship: close #21 + #11; audit accumulating opens per `feedback_closes_n_pattern`.
