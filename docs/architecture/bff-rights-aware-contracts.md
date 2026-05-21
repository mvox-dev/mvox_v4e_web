# BFF rights-aware contracts — design proposal

**Status:** APPROVED — pending entu/research schema rename for Q5; mvox implementation queued behind upstream
**Author:** Josquin (BFF/API)
**Branch:** `docs/bff-rights-design` from main `6e8c0f4`
**Date:** 2026-05-21 (session 11 draft, session 12 PO-approved)

---

## Context

Phase C closed the migration that retired polyphony's `role` properties. The v4E rights model — `_owner` / `_editor` / `_viewer` with cascade, and `_inheritrights: false` at `organization` boundaries — is now the sole access primitive. See `architecture-decisions.md` ("BFF user-rights default", session 2) and case study Section B for the underlying principles.

The mvox BFF skeleton landed at `src/lib/server/entu/client.ts` + `src/routes/auth/+server.ts` (CHORE-5, #16/#17) and proxies Entu via the user's JWT today, but it does not yet **encode** the rights model as part of its contract surface. The hooks layer (`src/hooks.server.ts`) only reads the cookie and stashes the JWT on `event.locals.entuJwt`; nothing else inspects rights, nothing enforces invariants, nothing translates 403s into a frontend-friendly shape.

This doc proposes the contract shape. **Implementation is gated on the entu/research file-property rename PR (see §0 + §10).** No `src/` edits in this PR.

---

## 0. PO decisions (session 12)

PO walked Q1–Q5 from §7 in session 12 and locked the answers below. The relevant sections have been folded to match.

| Q | Decision | One-line rationale |
|---|---|---|
| **Q1 — Orgs-list scope** | **Rights-driven.** Return everything Entu's server-side rights filter shows. | Trust the rights gate; orphan cascades = data-cleanup task, not query-time filter. |
| **Q2 — Empty-state distinction** | **Generic empty state.** 0 results → `200 { entities: [] }` regardless of cause; no `rights_state` hint. | Distinguishing requires elevation → violates §1 user-rights default; preserves existence-hiding. |
| **Q3 — Pagination** | **Defaults locked:** `limit=50` default, `limit=200` hard max, offset-based `?limit=N&skip=M` (1:1 with Entu). | No Finn probe needed; thin pass-through is honest. |
| **Q4 — Shape** | **Narrow / typed per-endpoint extraction.** | BFF-as-contract; each endpoint's response is a deliberate UI contract, not a leaky multi-valued bag. |
| **Q5 — File URLs** | **Rename `organization.logo` → `organization.photo`** AND **`person.avatar` → `person.photo`** to unlock Entu's native `_thumbnail` mechanism. | `_thumbnail` is hardcoded to look for a property named exactly `photo`; renaming gets us one-hop signed-URL resolution for free. **Requires entu/research schema-change PR first.** |

(*MVOX:Josquin*)

---

## 1. Default posture — user-rights mode for every BFF call

**Decision:** Every BFF route handler runs under the authenticated user's Entu rights. The SvelteKit server forwards `event.locals.entuJwt` to every outbound Entu call. There is no shared service account, no "BFF identity," no default elevation.

**Why this is load-bearing:**

- **Case study B4 / F3** — the rights model is the authoritative API contract. If the BFF has magic capabilities beyond what the user can do directly against Entu, alternative clients (Entu's own UI, a 3rd-party frontend, a research script) become second-class. Open-platform stance: the BFF is a UX convenience layer, not a privilege gate.
- **Membership-rights invariant (B2)** — "any explicit `_owner`/`_editor`/`_viewer` grant on an entity in an org subtree MUST be paired with an active `member` for that person in that org." Native Entu does not enforce this — the application does. Running BFF under user rights means a routine read/write naturally respects what the user is allowed to see/touch; we only need to enforce the invariant on mutations that grant/revoke rights (where Entu has no equivalent check).
- **F3 heuristic** — "if a frequent user operation needs elevation, the role model is probably wrong." Polyphony hit this on the admin role (originally `_editor`, required elevation for every member-add); reformulated to `_owner` and the operation became native. We inherit that lesson.

**Mechanism (read-only ops, implementation-next-session):**

```ts
// src/routes/api/organizations/+server.ts (illustrative)
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.entuJwt) throw error(401, 'auth_required');
  const client = new EntuClient(locals.entuJwt);
  const orgs = await client.search({ '_type.string': 'organization' });
  // Entu has already filtered by user-rights server-side. No app-side filter needed.
  return json({ entities: orgs });
};
```

The Entu server-side filter is the rights gate. The BFF does not re-check; it just shapes the response.

---

## 2. Elevated operations list — seeded empty

**Decision:** mvox's elevated-ops list is seeded **empty**. Polyphony's analogous list (cron cleanup, federation reports, self-link of additional verified emails — see `architecture-decisions.md` "BFF user-rights default") is documented for reference but **not auto-inherited**. Each elevated op gets added only when a real feature requires it, with explicit team-lead approval and a documented rationale.

**Rationale:** No cron jobs yet. No federation reports yet. The "additional verified email" self-link is deferred behind [entu/api#39](https://github.com/entu/api/issues/39). Pre-seeding capabilities that don't have a caller invites them being used as a shortcut later.

**Future candidates (NOT pre-approved — listed only to be on the record):**

| Candidate | Trigger | Likely shape |
|---|---|---|
| Cron: archive expired invitations | When invitation TTL feature lands | Scheduled Worker, runs as a configured BFF service-account JWT |
| Cron: cleanup orphan persons | When person-cleanup policy lands | Same |
| Federation aggregate reports | When cross-org public directory lands | Read-only; aggregates only (per case study C5: formulas bypass rights but only for aggregates, never raw projection) |
| Self-link of additional verified email | When entu/api#39 lands | Specific to invite-acceptance flow; never reused for general elevation |

**Gate on adding to the list:** new elevated op requires (a) PO approval, (b) entry in `architecture-decisions.md` under "BFF user-rights default" with rationale + bounded scope, (c) named env-var for the service-account JWT if one is needed (so it's not a literal in code). Bentham REDs any PR that ships an elevated op without the trailer convention.

---

## 3. Membership-rights invariant — enforcement layer

**The rule (case study B2):** any explicit `_owner` / `_editor` / `_viewer` grant on an entity in org X's subtree MUST be paired with an active `member` entity for that person in org X. Inversely, archiving a member MUST first revoke all their explicit grants in that org subtree.

This invariant only fires on **mutations** — read paths can't violate it. The proposal's MVP surface (Section 5) is read-only, so the invariant is documented here but **NOT** implemented in the first phase. The implementation lands with the first mutation route.

**Proposed enforcement layer: client lib helper (not middleware).**

```ts
// src/lib/server/entu/membership-invariant.ts (illustrative, future)
export async function assertMembershipForGrant(
  client: EntuClient,
  personId: string,
  orgId: string
): Promise<void> {
  const members = await client.search({
    '_type.string': 'member',
    'person.reference': personId,
    '_parent.reference': orgId,
    'status.string': 'active'
  });
  if (members.length === 0) {
    throw new RightsInvariantError(
      'no_active_membership',
      `Person ${personId} has no active member in org ${orgId}. Invite first, then grant.`
    );
  }
}

export async function assertNoGrantsBeforeArchive(
  client: EntuClient,
  personId: string,
  orgId: string
): Promise<void> {
  // Search org-subtree for any _owner/_editor/_viewer grants to personId
  // (excluding `inherited: true` cascade entries — those clear automatically when member archives)
  const explicitGrants = await client.searchExplicitGrants(personId, orgId);
  if (explicitGrants.length > 0) {
    throw new RightsInvariantError(
      'grants_outstanding',
      `Revoke ${explicitGrants.length} grant(s) before archiving membership.`
    );
  }
}
```

**Why client-lib helper, not middleware:**

- The invariant is context-specific (need to know which org and which person) — not derivable from the request alone, so a route-agnostic middleware can't apply it.
- The check piggy-backs on the same EntuClient instance the route is already using (one JWT, one connection-equivalent). Pulling it into middleware would mean opening a second client.
- Route handlers stay readable: the assertion is right next to the mutation it gates.

**Cascade-vs-explicit distinction (gotcha):** when admin has `_owner` on org via cascade, that's an implicit grant — archiving their membership doesn't strip the cascade (it strips the explicit grant only). The `assertNoGrantsBeforeArchive` check therefore filters to `inherited: true` to exclude cascade entries (per case study B1's "filtered to inherited != true" pattern).

---

## 4. Rights-boundary error surface

**Problem:** Entu returns 403 for "user lacks rights" and an empty result set for "user has rights but no matching data." These look different on the wire but feel similar to a frontend. The BFF should translate them into a consistent response shape that the UI can render meaningfully.

**Proposed status mapping:**

| Entu signal | BFF HTTP status | Body shape |
|---|---|---|
| 200 with non-empty `entities[]` | `200` | `{ entities: [...] }` — normal success |
| 200 with empty `entities[]` (user has rights, no data) | `200` | `{ entities: [] }` — empty success; frontend renders empty state |
| 403 on a specific entity (user lacks `_viewer`) | `403` | `{ error: 'forbidden', reason: 'rights_missing' }` |
| 401 (no JWT / expired) | `401` | `{ error: 'auth_required' }` — frontend redirects to `/auth/login` |
| 404 (entity gone or never existed) | `404` | `{ error: 'not_found' }` |
| 5xx (Entu unreachable) | `502` | `{ error: 'upstream_unavailable' }` |
| Membership-rights invariant violation | `409` | `{ error: 'invariant_violation', code: '<code>', message: '<human-readable>' }` |

**Specific decision — empty-result handling:** the BFF does **not** distinguish "0 results because rights-empty" from "0 results because no data." Both return `200` with `entities: []`. Rationale: Entu's rights-filter happens server-side; from the BFF's perspective these are indistinguishable (we don't get a "you were filtered" header). Trying to distinguish would require a second elevated-mode query to see if there's ANY matching entity — which (a) violates the user-rights default, (b) leaks existence to unauthorized users.

**Frontend implication (Byrd's territory, mentioned for completeness):** the empty state has to be designed to be neutral — "No organizations yet" or "Nothing here yet" rather than "You don't have permission to see these orgs." This aligns with the test-data-strategy decision (session 3 — "empty-state UI first").

**Error envelope shape:**

```ts
interface BffErrorResponse {
  error: 'auth_required' | 'forbidden' | 'not_found' | 'upstream_unavailable' | 'invariant_violation';
  reason?: string;    // sub-categorization, machine-readable
  code?: string;      // specifically for invariant_violation
  message?: string;   // human-readable, NEVER includes Entu IDs (PII leak risk)
}
```

**No raw Entu error pass-through.** Entu's error JSON may include entity IDs the user shouldn't see. BFF always translates to the envelope above; logs the original on the server side for debugging.

---

## 5. Minimum viable surface — first implementation scope

**Two endpoints, both GET, both read-only.** Bound for the first implementation phase:

### 5.1 `GET /api/organizations`

**Purpose:** list every organization the authenticated user has `_viewer` or higher on.

**Request:** `?limit=N&skip=M` (offset pagination, 1:1 with Entu). Default `limit=50`, max `limit=200`. Per Q3.

**Response:**

```ts
{
  entities: Array<{
    _id: string;
    name: string;
    description?: string;
    location?: string;
    photo?: string;       // pre-signed S3 URL via Entu `_thumbnail` (60s TTL)
    member_count_per_section?: number;
  }>;
}
```

**Mechanics:**

```ts
const orgs = await client.search({
  '_type.string': 'organization',
  props: '_id,name,description,location,_thumbnail,member_count_per_section',
  limit, skip
});
return json({
  entities: orgs.map(o => ({
    _id: o._id,
    name: extractStringProp(o, 'name'),
    description: extractTextProp(o, 'description'),
    location: extractStringProp(o, 'location'),
    photo: o._thumbnail,  // pre-signed URL, resolved server-side from `photo` property
    member_count_per_section: extractNumberProp(o, 'member_count_per_section')
  }))
});
```

**File-URL strategy (per Q5 decision):** Entu hardcodes the `_thumbnail` derived field to look for a property named exactly `photo` on the entity (see Finn's session-12 research; `entu/api/utils/entity.js` `cleanupEntity` is the resolver). Requesting `?props=_thumbnail` populates `_thumbnail` inline as a 60s pre-signed S3 URL — no second property fetch needed. **This requires renaming `organization.logo` → `organization.photo` in v4E first.** Until that lands, the BFF must either return `photo: undefined` or fall back to the two-hop `GET /property/{logoPropertyId}` path. See §10 for the dependency status.

**Rights behaviour:** Entu's search applies rights filtering server-side. The user sees only orgs they can `_viewer` (or higher). Per Q1, no application-side filter on top — anything Entu's filter shows is returned. Per case study C5, the public-sharing flag on `organization` (`sharing: 'public'`) also makes orgs visible to anonymous users — but this endpoint requires a JWT (`event.locals.entuJwt`), so anonymous discovery happens elsewhere (likely `/public/orgs` later; out of scope for this pass).

**Why this endpoint first:** it's the canonical "what can I see" call. Drives the post-login landing page. Naturally tests user-rights default + empty-state envelope + property extraction shape + `_thumbnail` resolution.

### 5.2 `GET /api/organizations/[id]/sections`

**Purpose:** list sections under one organization. Recursive trees (section-of-section per schema.ts L238–242) flattened at one level — frontend handles further drilling via separate calls.

**Request:** path param `id` = org `_id`. Optional `?limit=N&skip=M` (defaults `limit=50`, max `200`; per Q3).

**Response:**

```ts
{
  entities: Array<{
    _id: string;
    name: string;
    voice?: { _id: string; name: string };
    description?: string;
    display_order?: number;
    member_count?: number;
    parent_section?: string;  // _id of parent section, if section-of-section
  }>;
}
```

*(Section has no `photo`/file property in v4E; no `_thumbnail` consideration here.)*

**Mechanics:**

```ts
const sections = await client.search({
  '_type.string': 'section',
  '_parent.reference': params.id
});
// Note: this returns DIRECT children only (section-of-org).
// Section-of-section recursion: client navigates by calling
// `/api/organizations/[id]/sections?parent=<sectionId>` (deferred to phase 2).
```

**Rights behaviour:** sections have `inheritsRights: true` (schema.ts L227) so cascade from the parent org applies. A user with `_viewer` on the org sees all sections. A section-leader with explicit `_editor` on one section sees their section even without org membership — that's why we don't pre-filter by membership.

**Cross-cutting concern — 404 distinguishability:** if the user lacks rights to the org AND it exists, we want `403` not `404` (so the UI doesn't say "no such org" when really "you can't see this one"). Implementation:

```ts
const org = await client.get(params.id).catch(() => null);
if (!org) throw error(404, 'not_found');  // doesn't exist OR rights say nothing
// At this point user has at least _viewer on org — proceed with section query.
```

The catch-all collapses 404 and 403 into a single 404 (Entu returns 403 for rights-denied on a specific GET). This is the standard "hide existence from unauthorized users" pattern — matches case study C4 (per-property sharing) intent: anonymous users see only what's publicly shared, authenticated users see only what their rights permit, no leakage of unknown-existence.

---

## 6. Interaction with #19 — CSRF gate

**The open YELLOW from session 7:** Bentham flagged that the first BFF cookie-authed mutation route MUST ship with CSRF protection (Origin check, token-pair, or equivalent). The current `POST /auth` endpoint dodges the check because it requires an `Authorization` header (not the cookie) — but any future POST/PUT/PATCH/DELETE that reads `event.locals.entuJwt` from the cookie is in scope.

**This proposal's MVP surface (Section 5) is read-only**, so the design proposal does NOT trigger #19. Both endpoints are GETs and GETs are not in scope for CSRF (safe methods, no side effects). The first implementation phase can land without addressing #19.

**HOWEVER** — and this is the load-bearing point — the **second implementation phase** (which adds any mutation endpoint: org creation, member invite, section edit, etc.) MUST address #19 before merging. The recommended path:

1. Before the first mutation route is implemented, open a separate task (or sub-PR) for the CSRF middleware
2. Land CSRF support as a hook in `src/hooks.server.ts` (e.g., Origin-header check for state-changing methods, or a CSRF token issued on read and verified on write)
3. Then implement the mutation route, which auto-inherits the gate

**This proposal flags #19 as the explicit blocker on the next phase.** Bentham should RED any mutation route that lands without it.

**SvelteKit-specific note:** SvelteKit has built-in CSRF protection (`config.kit.csrf.checkOrigin`, default `true`) that rejects POSTs with a mismatched Origin header. This is the cheapest path — verify it's enabled (it is, by default) and document the dependency in the implementation PR. Token-pair only becomes necessary if we ever ship a cross-origin embed.

---

## 7. Q1-Q5 — RESOLVED (session 12)

All five gating questions answered in session 12. Decisions are summarised in §0; this section retains the original question text and adds the resolution underneath each, for review-history continuity.

### Q1. Orgs-list scope: rights vs. membership — **RESOLVED: rights-driven**

The `GET /api/organizations` endpoint as proposed returns every org the user has **any rights** on (cascading or explicit). Alternative was: return only orgs where the user is an **active `member`**.

**Resolution:** rights-driven. Return everything Entu's server-side filter shows. Don't over-engineer at the BFF layer. Invitation case (user has `_viewer` via accepted invitation, not yet `member`) is real and needs to be surfaced. Orphan-cascade case (archived member with stale `_viewer`) is a data-cleanup task, not a query-time filter. (Folded into §5.1 mechanics.)

### Q2. Section-lookup empty result — "no rights" vs. "no data" — **RESOLVED: generic empty state**

Section 4 proposed treating 0 results as a generic empty state. Alternative was to expose a `rights_state: 'data_empty' | 'rights_empty' | 'mixed'` hint.

**Resolution:** generic empty state. Distinguishing the two would require an elevated-mode query to see if there's ANY matching entity — which violates §1's user-rights default AND leaks existence to unauthorized users. (§4 already conformant.)

### Q3. Pagination policy — **RESOLVED: defaults locked**

Section 5 ducked pagination.

**Resolution:**
- **Default page size:** `limit=50`
- **Maximum page size:** `limit=200` (hard cap; BFF clamps)
- **Cursor or offset?** Offset, 1:1 with Entu's `?limit=N&skip=M`. Thin pass-through.

No Finn probe needed; PO call closed this directly. Folded into §5.1 + §5.2 request shapes.

### Q4. Property extraction shape — wide vs. narrow — **RESOLVED: narrow / typed**

Section 5.1 returned a narrow shape (5–6 properties on org). Entu returns the full entity with all properties as multi-valued arrays. Two extraction strategies were considered (narrow vs. passthrough).

**Resolution:** narrow / typed per-endpoint extraction. BFF picks the properties the UI needs and shapes them into a flat TS-friendly object. Aligns with the BFF-as-contract posture. Refactor cost when UI needs a new property is acceptable — that refactor is exactly the visible API change we want to gate at review. (§5.1 conformant.)

### Q5. Logo/file URL strategy — **RESOLVED: rename to `photo` for `_thumbnail` benefit**

Original framing was BFF-proxied URL vs. fresh signed URL per response. Finn's session-12 research surfaced a third path that PO selected:

**Resolution:** **Rename `organization.logo` → `organization.photo`** AND **`person.avatar` → `person.photo`** in v4E. This unlocks Entu's native `_thumbnail` derived field, which is **hardcoded to look for a property named exactly `photo`** on the entity (see `entu/api/utils/entity.js` `cleanupEntity` + `entu/api/utils/file.js`). With the rename:

- Client requests `?props=_thumbnail` on the entity/search call
- Entu resolves the entity's `photo` property server-side and returns a 60s pre-signed S3 URL inline in `_thumbnail`
- One hop. No second property fetch. Anonymous access works for `sharing: 'public'` properties.

**The decision is gated on the entu/research schema PR landing first.** See §10 for the dependency status; until that lands, the BFF either returns `photo: undefined` or falls back to two-hop `GET /property/{logoPropertyId}`. (§5.1 mechanics already encode the post-rename shape.)

**Other v4E file properties not in scope of this rename:** `edition.file` (line 455 in schema.ts) is `list: true` and represents PDFs/audio/video collections — `_thumbnail` only resolves a single `photo` property, so the rename neither benefits nor breaks `edition.file`. Stays as-is.

(*MVOX:Josquin*)

---

## 8. Out of scope (explicit)

- **Code.** Zero `src/` edits in this PR. Implementation lands next session.
- **Auth flow.** Already settled — OAuth → Entu JWT in httpOnly cookie → BFF proxy. See `src/routes/auth/+server.ts` + `src/hooks.server.ts`.
- **Frontend consumption patterns.** Byrd's territory. The contracts above are designed to be consumable by `+page.ts` loads and `fetch()` from `.svelte` files. Byrd designs the consumption.
- **v4E schema changes.** None required for this proposal. The relevant entity types (`organization`, `section`, `member`) are already in `schema.ts`. The membership-rights invariant is an app-level rule, not a schema rule.
- **Mutation endpoints.** Out of scope for THIS proposal. The second proposal (or implementation-phase-2 design note) covers them, gated on #19.
- **Federation / cross-org discovery.** Anonymous endpoints (e.g., `/public/orgs`) and federation reports defer to a future doc.

---

## 9. References

- `architecture-decisions.md` — "BFF user-rights default" (session 2), "Stack" (session 2), "v4E schema mutation gate" (session 2)
- Case study `2026-05-polyphony-on-entu.md` — Sections B (principles), C (patterns), D6 (formula leak), F3 (user-rights vs elevation)
- v4E schema `entu/research/docs/schema/v4E/schema.ts` — `person.avatar` L114, `organization` L151, `organization.logo` L178, `section` L223, `member` L277, `edition.file` L455
- mvox BFF skeleton: `src/lib/server/entu/client.ts`, `src/routes/auth/+server.ts`, `src/hooks.server.ts`
- Open issues: #19 (CSRF gate, session 7 YELLOW-1), #20 (DRY base URL, session 10 — addressed)
- Finn's session-12 Entu file-URL research (cited in §5.1 + §7 Q5):
  - `entu/api/routes/[db]/property/[_id]/index.get.js` — direct property GET returns signed S3 URL (60s TTL); `?download=true` makes it a 302
  - `entu/api/utils/file.js` — S3 pre-signed URL generation
  - `entu/api/utils/entity.js` `cleanupEntity` — `_thumbnail` resolver, hardcoded to look up the property named `photo`
  - `entu/api/routes/[db]/entity/[_id]/index.get.js` — entity GET path that exposes `_thumbnail` when `?props=_thumbnail` is requested
- Migration finding: `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` — entu/research PR draft for the §0 Q5 rename

---

## 10. Upstream dependency — entu/research rename PR

**This proposal is gated on a v4E schema-change PR landing in `entu/research`** before any mvox `src/` implementation:

1. **`entu/research` PR (PO submits):** rename `person.avatar` → `person.photo` AND `organization.logo` → `organization.photo` in `docs/schema/v4E/schema.ts`. Draft material is in `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` — designed to be pasted directly into the entu/research GitHub UI.
2. **Polyphony data migration (Pérotin task, separate session):** rename existing live property values on the 2 persons with `avatar` and the 6 orgs with `logo` (Pérotin's session-11 manifest-first migration patterns cover this class).
3. **mvox BFF implementation PR (this design realized):** consumes the post-rename shape. **Commit must carry both trailers** per `architecture-decisions.md` "v4E schema mutation gate":
   ```
   Schema-Change: entu/research@<sha> "rename avatar+logo to photo for _thumbnail support"
   PO-Approved: <date> verbal in session, logged by team-lead
   ```
   Bentham REDs the implementation PR without both trailers (and without the upstream PR landed).

Until step 1 lands, this design is APPROVED-but-blocked. The doc itself is mergeable as a design artefact (it doesn't change schema or code); implementation only proceeds after step 1.

---

(*MVOX:Josquin*)
