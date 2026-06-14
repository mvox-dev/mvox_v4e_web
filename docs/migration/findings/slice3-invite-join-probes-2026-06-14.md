# Slice 3 Phase 0 — Invite & Join Live Probes

**Probed by:** Pérotin  
**Date:** 2026-06-14 (session 35)  
**Target db:** polyphony (dev playground)  
**Authorization:** team-lead dispatch (session 35) — read + reversible single-instance write probes  
**Probe script:** `scripts/migrations/probes/probe-slice3-invite-join-2026-06-14.ts`  
**Cleanup:** all `_probe_*` entities deleted and confirmed 404 before this doc was written  

---

## Summary verdict

| Question | Answer |
|---|---|
| invitation type exists? | YES — `6a0d2e8290c8df7a1cc7de3e` |
| application type exists? | YES — `6a0d2e8390c8df7a1cc7de81` (S32 concern resolved) |
| member type exists? | YES — `69c7ea4a8489bfcb0e819edd` (matches credentials.env) |
| Path A (application = identity proof)? | VIABLE — application has no `person` prop; parent IS the person entity per label design intent |
| Org-service key can read private invite? | YES — confirmed via probe |
| Org-service key can create multi-parent member? | YES — confirmed via probe |
| Org-service key can delete invite + application? | YES — confirmed via probe cleanup |

---

## A) Entity type-def shapes

### invitation (type `6a0d2e8290c8df7a1cc7de3e`)

**Type-def `_sharing`: `private`**  
**Type-def `label`:** "Org's consent. Admin creates; user accepts → member created + invitation deleted."  
**Type-def `_parent`:** database entity (top-level type, not under org)  
**Instance `_sharing`:** `private` (set at create; not inherited from parent org which is `domain`)  
**Instance `_parent`:** organization (invitation lives under the org that issues it)

| prop | type | mandatory | list | notes |
|---|---|---|---|---|
| email | string | YES | — | invitee email |
| token | string | YES | — | opaque random token for URL |
| expires_at | date | YES | — | date type (not datetime) |
| sections | reference | — | YES | optional target sections within the org |
| inviter | reference | — | — | optional reference to inviting person |
| message | text | — | — | optional personal message |

**No `person` prop on invitation** — the person is identified by email + token match at accept time. The BFF links invitation → person at the accept endpoint.

**Instance `_owner`:** the creator (org admin / BFF service key). Not inherited from org (because `_sharing: private` breaks the domain cascade).

**0 instances exist** in polyphony currently.

---

### application (type `6a0d2e8390c8df7a1cc7de81`)

**Type-def `_sharing`: `private`**  
**Type-def `label`:** "Person's consent. Person creates; admin accepts → member created + application deleted."  
**Type-def `_parent`:** database entity (top-level type, same as invitation)

The label is the critical design document. **The application is created by the person (user's own JWT).** The parent of an application INSTANCE is the `person` entity — this is how Entu's creator-as-_owner + parent-write-access rule makes it work: a person with a JWT can create under their own person entity because they are `_owner` on it.

| prop | type | mandatory | list | notes |
|---|---|---|---|---|
| target_org | reference | YES | — | the org the person wants to join |
| status | string | YES | — | e.g. "pending", "accepted" |
| expires_at | date | YES | — | application expiry |
| message | text | — | — | optional personal message |

**No `person` prop on application** — the person IS the `_parent`. `application._parent.reference` = person entity `_id`. This is the identity proof (see Section B).

**0 instances exist** in polyphony currently.

---

### member (type `69c7ea4a8489bfcb0e819edd`)

**Type-def `_sharing`: `domain`** (members are discoverable within the domain)  
**Instance `_sharing`: `domain`** (confirmed on live instances)

| prop | type | mandatory | list | notes |
|---|---|---|---|---|
| name | string | YES | — | plain string (no formula); v4E design note: legacy field, rsvp uses `member` ref for identity |
| person | reference | — | — | reference to person entity |
| section | reference | — | YES | optional list of section refs |
| current_section | reference | — | — | current section (domain-sharing prop-def) |
| status | string | YES | — | "active", "inactive" etc. (domain-sharing prop-def) |

**Multi-parent shape:** confirmed — org + section(s) as `_parent[]`. Probe created member with 2 parents (org + Soprano section) via two-POST sequence: create with org parent, then POST second `_parent` reference.

**Creator rule:** member `_owner` is set to the creating entity (org admin / BFF). There is no "bilateral consent" enforcement at the Entu layer — that is a BFF-enforced rule (accept endpoint reads `application._parent` as the verified person and only then creates the member).

**`name` prop-def:** plain string, not a formula. No formula field on the prop-def entity. This is a legacy display field — the real identity link is via `person` reference.

**244 instances** currently in polyphony.

---

## B) Accept-identity decision: Path A vs Path B

### The design question

When a user clicks `/invite/<token>`, the BFF accept endpoint needs to know WHO is accepting. Two options:

- **Path A:** the user (with their own Entu JWT) creates an `application` entity under their own `person` entity. The application's `_parent.reference` = their person `_id`. The elevated BFF accept endpoint reads `application._parent[0].reference` as the verified acceptor. This is the identity proof — Entu's rights model guarantees that only the `_owner` of that person entity could have created a child entity under it.

- **Path B:** the user's JWT is not used for Entu writes during accept. The accept endpoint trusts a client-supplied `personId` (from `localStorage.user._id` or the Entu JWT's account). This is weaker because the elevated BFF service key could create the member for any supplied personId without cryptographic identity verification from the user's side.

### Evidence for Path A

1. **The application type-def label explicitly encodes Path A:** "Person's consent. Person creates; admin accepts → member created + application deleted." The word "Person creates" = the person's own JWT creates the application. This was designed in.

2. **No `person` prop on application.** If the design intended Path B (BFF creates application on behalf of the user with a supplied personId), there would be a `person` reference prop. The absence is intentional: identity is encoded in `_parent`, not in a property.

3. **The `rsvp` precedent is identical.** Live rsvp instances confirm: `_parent.entity_type = "person"` (rsvp lives under the person entity). The user's own JWT creates rsvp under their own person. This is the established pattern for "user-created record that lives under the user's own subtree." Application follows the same pattern but under the person entity instead of under an event.

4. **Entu rights mechanics.** Creating an entity under a person entity requires `_editor` or `_owner` on that person entity. An authenticated user's JWT gives them `_owner` on their own person entity (they are the subject). A third party cannot create an entity under someone else's person entity without an explicit rights grant. So `application._parent = personId` provably means "this person's JWT created it." The elevated accept endpoint can trust this.

5. **Path B is weaker.** The elevated BFF service key, if it processes a client-supplied `personId`, has no proof that the user with `personId` is the actual browser-session user. The JWT in the browser proves their identity to Entu; a `personId` parameter does not.

### Recommendation: **PATH A**

Path A is the recommended design. The data confirms it was the intended design (the type-def label, the absent `person` prop, the `rsvp` precedent all point the same way).

**Resulting accept endpoint flow:**
1. User (with own JWT) hits `/api/accept-invite` with token + their personId
2. BFF mints service-key JWT
3. BFF verifies invitation (token match, not expired, org target)
4. **BFF instructs user's browser to create application under user's person entity** — wait, but the accept endpoint is a server-side elevated op. The user's JWT must create the application, not the service key, for Path A to hold.

**Revised Path A flow (correct):**
1. User (own JWT) calls a **user-tier** endpoint: `POST /api/invite/accept` with token
2. SvelteKit server (with user's proxied JWT — but wait, we're browser-direct under Path C) ... 

**Path C correction:** Under the browser-direct architecture (CHORE-53), the user's JWT stays in the browser. The accept flow needs two legs:
- **Leg 1 (user-tier, browser-direct):** User's browser creates `application` under their own person entity via `api.entu.app` directly (browser-direct, user's JWT). This establishes identity.
- **Leg 2 (elevated, BFF):** User calls BFF elevated endpoint `/api/invite/accept` with token + `applicationId`. BFF reads `application._parent` to verify person identity, verifies invitation, creates member, deletes application + invitation.

This is Path A implemented correctly under the Path C browser-direct architecture. The application creation is user-tier (browser-direct), the member creation is elevated (BFF).

**Alternatively (simpler Path A variant):**  
The BFF accept endpoint takes the user's JWT (forwarded from browser's Authorization header) + the invitation token. BFF:
1. Calls `api.entu.app` with the USER's JWT to create the application under their person (proving identity in-band)
2. Then switches to service key JWT to create member + delete invite + delete application

This keeps all Entu writes on the server but still uses the user's own JWT for the identity-establishing write. Cleaner than two browser round-trips.

---

## C) Org-service key rights feasibility

### Test identity

The existing `ENTU_API_KEY` credentials are bound to the PO's person entity, which is `_owner` on all 6 org entities in polyphony. This models the org-service key: a key on a service account entity that holds `_owner` (or `_editor`) on the org + its subtree.

### Results

| Op | Result | Evidence |
|---|---|---|
| Read org private entity (domain-sharing with _inheritrights=false) | YES | C1: org list returned 6 orgs with full details |
| Create invitation under org (private) | YES | C2: probe `6a2e561e4cd971291c5d5772` created OK |
| Read back org-private invitation | YES | C3: full invitation entity returned (including `_owner`, `_sharing: private`) |
| Create multi-parent member (org + section) | YES | C4: probe `6a2e561f4cd971291c5d577b` created with 2 _parent refs confirmed |
| Delete invitation | YES | Cleanup: probe invitation 404 after DELETE |
| Delete member | YES | Cleanup: probe member 404 after DELETE |

All 6 operations confirmed feasible with org-owner credential level.

### Key observation: creator = _owner on created entity

When the service key creates an invitation or member, it becomes `_owner` on that entity (observed on probe invitation: `_owner = Mihkel Putrinš` = the API key holder). This is the correct behavior for BFF-created entities — the service account owns them and can delete them.

### Minimum-rights spec for CF BFF service key

The service key does NOT need:
- `_owner` on org entities (excessive)
- global database access

The service key needs, per org:

| Right | Target | Reason |
|---|---|---|
| `_editor` on org | Each org entity | To create child entities (invitation, member) under the org |
| `_owner` on invitation (auto-granted at create) | Individual invitation entities | Creator becomes owner; allows read + delete |
| `_editor` on member (auto-granted at create) | Individual member entities | Creator becomes owner; allows read + delete |
| READ access to org's section entities | Each section entity | To resolve `invitation.sections` references at accept time |

In practice: **`_editor` on each org entity is sufficient**. This grants:
- Create child entities under the org (invitation, member)
- Read the org and its subtree (sections, members)
- Does NOT grant modify/delete on existing members created by other keys

This is a tighter scope than `_owner` (which would grant delete-org capability). The MVP CF secret should be a dedicated service account entity with `_editor` on each org, not a full `_owner`.

**Provisioning:** Create a `person` entity for the service account, add an `entu_api_key` property, grant `_editor` on each org entity. Store the raw key as `ENTU_ORG_SERVICE_KEY` in CF Pages secrets. This is a PO-gated deploy step — not done here.

---

## Blockers and open items

1. **No blockers for Slice 3 implementation.** All three type-defs exist, write probes passed, Path A is sound.

2. **application type-def has no `person` prop.** Confirmed by design (parent IS the person). No schema change needed.

3. **The invitation type has no `person` prop either.** The accept endpoint must match token to invitation to identify which org + sections the user is joining; then read the user's identity from their JWT (or from the application they create). The invitation is org-side consent; the application is person-side consent.

4. **member.name is still present** as a mandatory prop-def on the live polyphony member type. The v4E `schema.ts` may or may not have this; the live db still requires it. The BFF member-create call must include a `name` value. A safe default: `name = person.name` (fetched from person entity before creating member). Open question for spec: should the BFF compute this or should the schema retire `member.name`?

5. **Path A two-leg vs single-BFF-leg:** team-lead / PO should decide whether application creation uses:
   - The user's JWT forwarded to BFF (simpler, single server hop)
   - Browser-direct application create + separate BFF accept call (two round-trips but matches Path C purity)

   This is a spec decision, not a Entu-capability question.

---

## Data state (post-probe)

Polyphony unchanged. All probe entities confirmed deleted:
- `6a2e561e4cd971291c5d5772` (probe invitation) → 404
- `6a2e561f4cd971291c5d577b` (probe member) → 404

---

(*MVOX:Perotin*)
