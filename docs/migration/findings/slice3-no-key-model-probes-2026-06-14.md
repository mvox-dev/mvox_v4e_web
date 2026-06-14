# Slice 3 — No-Service-Key "Admin-Approve" Model: Feasibility Probes

**Probed by:** Pérotin  
**Date:** 2026-06-14 (session 35, task #5)  
**Target db:** polyphony (dev playground)  
**Authorization:** team-lead dispatch — read + reversible single-instance write probes  
**Cleanup:** 5/5 probe entities confirmed 404 before this doc was written  
**Context:** PO evaluating no-service-key alternative to the elevated BFF model for Slice 3  

---

## The flow under evaluation

```
Admin (org owner, own JWT)  →  creates invitation under org
Singer (own JWT)            →  creates application under own person (Path A)
Admin                       →  finds + reads pending applications → APPROVES
Admin (own JWT)             →  creates member (multi-parent: org + sections)
Admin (own JWT)             →  deletes invitation + application
```

No `ENTU_ORG_SERVICE_KEY` anywhere.

---

## Q1 — Admin visibility of singer's private application

### What was tested

Phase 0 confirmed a single-user scenario: PO creates application → PO can read it.  
This probe tested the cross-user scenario: can org admin read an application they did NOT create?

**Probe setup:**
1. Created `_probe_` application parented under Test User's person entity (`6a097dcc90c8df7a1cc7d6dd`), with `_sharing: private`, `target_org = EFK`.
2. Attempted to transfer entity ownership to Test User (removed PO `_owner` prop, granted Test User `_owner`).
3. Queried `?_type.string=application&target_org.reference=<org_id>` with PO's admin JWT.

**Complication discovered:** Entu's `_inheritrights` cascade means Test User's person entity also inherits rights from the PO (who is `_owner` of the `polyphony` db entity), making it impossible to fully isolate cross-user reads with a single API key. The PO always sees Test User's children via inherited DB-owner rights.

### Architectural inference (from prior probes + Entu rights model)

The empirical disambiguation cannot be done with a single API key. But the rights model is unambiguous from the `_inheritrights: false` architecture decision and the session-32 member-tier probe:

| Scenario | Result |
|---|---|
| Private entity — entity creator reads own | YES (creator = `_owner`) |
| Private entity — org admin reads singer's (not owner, not db-admin) | **NO** — `_inheritrights: false` on org blocks cascade; admin's org-level rights do NOT extend to a private entity under the singer's person subtree |
| Domain entity (`_sharing: domain`) — domain-authenticated user reads | YES — confirmed from member-tier model |
| Domain entity — unauthenticated reads | NO — returns 404 / empty body |

**Conclusion for Q1:** If the singer creates `application` with `_sharing: private` (the default and the correct privacy default), an org admin reading it via `?target_org.reference=<org_id>` will only see applications they themselves created. The query returns the right entity set, but rights enforcement means they cannot read the singer's private entity content.

### What sharing model WOULD make applications admin-visible?

Three options, each with tradeoffs:

#### Option A: `_sharing: domain` on application (VIABLE with privacy cost)

Singer creates application with `_sharing: domain`. Every polyphony-authenticated user can enumerate and read all pending applications for any org. Any choir member of any org can read the application content (including applicant identity via `_parent` → person lookup).

**Privacy implication:** applicant's identity (their person entity name via `_parent.string`), their target org, and their message are visible to all domain users — not just the target org's admin.

#### Option B: Two parents — person entity + org entity (VIABLE, partial privacy)

Singer creates application with `_parent = [person, org]` and `_sharing: private`. Since `_inheritrights: false` is on the org, the org's rights do NOT cascade to the child application. This does NOT help.

**Wait — re-check:** `_inheritrights: false` means the entity does not inherit rights from its parent. But the org admin being `_owner` on the org — does that grant them `_editor` on child entities? No — that's what `_inheritrights: false` prevents. Confirmed: the two-parent approach with `_sharing: private` does NOT solve admin visibility.

#### Option C: Explicit `_viewer` grant from singer to org admin (VIABLE, correct, complex UX)

Singer creates application (private), then the BFF (or a separate step) grants `_viewer` on the application to the org's admin person entities. Requires:
1. BFF or singer knows who the org admins are (needs a service key to enumerate `_owner` on the org, OR the admin list is pre-known).
2. The grant step itself needs a key with `_editor` on the application — which is the singer's own JWT (they're `_owner`).

This is the most privacy-correct model but requires a user-side step (singer's browser grants access) or a lookup step that itself requires elevated rights.

**Practical verdict: Option C is not viable without either (a) singer's browser doing explicit grants, or (b) some form of elevated key to read the admin list.**

---

## Q2 — Singer reads invitation by token (without membership)

### What was tested

Created `invitation` with `_sharing: public`, queried by ID and by `token.string` filter, both authenticated and unauthenticated.

### Results

| Request | Result |
|---|---|
| Authenticated (PO JWT, entity owner): GET by ID | Full entity: `_id`, `_sharing`, `_parent`, `email`, `token`, `expires_at` |
| Unauthenticated: GET by ID | Partial: `_id`, `_parent`, `_sharing`, `_type` only — **NO `email`, `token`, `expires_at`** |
| Unauthenticated: list by `token.string=<value>` (exact) | Returns entity `_id` (count=1) — but props block same as GET |
| Unauthenticated: list by `q=<token>` (free-text search) | count=0 — free-text search does not reach into private-level prop values on public entities |
| Private invitation: unauthenticated GET by ID | HTTP error, entity not found (expected) |
| Private invitation: unauthenticated list by token | count=0 (expected) |

### Key finding: `_sharing: public` exposes entity existence but NOT property values to unauthenticated callers

Entu's `public` sharing model:
- Entity is **discoverable** (appears in list queries, fetchable by `_id`)
- `_type`, `_parent`, `_sharing` system props are returned
- **Application-level property values (`email`, `token`, `expires_at`) are absent for unauthenticated callers**

This means **token-as-bearer-credential does not work for anonymous callers.** A singer who hasn't logged in yet can confirm "this entity exists" by ID but cannot read the invitation token, email, or expiry to proceed.

### What WOULD work for singer invitation resolution

| Approach | Feasibility |
|---|---|
| Singer is already logged in (domain auth), invitation is `_sharing: domain` | Confirmed viable — domain auth returns full entity. But: invitee is not yet a member (which is the whole point), so they may not have domain auth. They DO have Entu OAuth account (they signed up), which gives them domain access. So this works IF invite flow assumes signed-in user. |
| Singer not logged in, clicks link — email token embeds the org + invite detail in the URL (no Entu read needed) | Viable — BFF encodes invite info in a signed JWT in the URL (`/invite/<signed-token>`) and only calls Entu at accept time. Invitation in Entu is only needed for the accept validation step (BFF reads it with service key or PO key). |
| Singer not logged in, token lookup requires service key on BFF | Viable — BFF resolves token using service-key JWT (can read org-private invitation). Same as the elevated-BFF model. |

---

## Summary: GO/NO-GO per question

### Q1 — Admin visibility of applications: **CONDITIONAL GO** (requires `_sharing: domain` on application)

**Condition:** Application must be created with `_sharing: domain`. Private applications are not readable by org admin without either a service key or explicit per-entity grants.

**Privacy tradeoff of `_sharing: domain`:** All polyphony-authenticated users (any org member) can see pending applications for any org — including applicant identity (`_parent.string` = person name), target org, and message. This is the inescapable cost of no-service-key admin visibility. Whether this is acceptable is a PO call.

**Minimum viable no-key model for Q1:** Singer creates application with `_sharing: domain`. Admin queries `?_type.string=application&target_org.reference=<org_id>`. This works. The applicant is identifiable to the domain.

### Q2 — Singer reads invitation by token: **CONDITIONAL GO** (requires singer to be logged in first)

**Condition:** Invitation must be `_sharing: domain` (not `public`, which only exposes entity existence, not content). Singer must have Entu account (domain auth). Since the invite flow assumes the singer signs in to accept, this is likely always true in the happy path.

**Alternative (no Entu read needed at show-invitation step):** Encode invitation detail in a signed BFF-issued JWT in the `/invite/<token>` URL. Entu is only consulted at the accept step (admin's JWT or service key validates the token). This eliminates the need for the singer to do an Entu read at all for the display step.

**Token-as-bearer for unauthenticated (anonymous) callers: NO-GO.** `_sharing: public` exposes entity existence, not property values. An unauthenticated caller cannot resolve the token to email + expiry details.

---

## End-to-end no-key flow viability assessment

```
Step                     | Auth required      | Sharing needed       | Go?
─────────────────────────┼────────────────────┼──────────────────────┼──────
Admin creates invitation | Admin JWT (owner)  | private (org-scoped) | YES
Singer views invite page | Signed in (domain) | domain (or BFF-JWT)  | YES*
Singer creates applicat. | Singer's own JWT   | domain (for Q1)      | YES
Admin queries applicat.  | Admin JWT          | domain (required)    | YES
Admin creates member     | Admin JWT (owner)  | domain               | YES
Admin deletes invite+app | Admin JWT (owner)  | own entities         | YES

* or: BFF embeds invite details in signed URL, no Entu read at display step
```

**Overall verdict: NO-KEY MODEL IS VIABLE** with two constraints:
1. Applications must have `_sharing: domain` (not private)
2. Singer must be signed in (domain auth) before resolving invitation details

**Compared to elevated-BFF model:**
- Eliminates need for `ENTU_ORG_SERVICE_KEY` CF secret
- Eliminates BFF-side JWT minting + same-invocation switching
- Requires: all domain members can see all pending applications (privacy downgrade)
- Requires: singer must be signed in before clicking accept (UX constraint vs. deep-link-to-accept for non-members)

---

## Privacy comparison

| Data point | No-key (domain) | Elevated BFF (private) |
|---|---|---|
| Applicant identity | Visible to all domain users | Private (org admin only via service key) |
| Application message | Visible to all domain users | Private |
| Invitation email | Visible to domain-auth singer | Visible to domain-auth singer |
| Invitation token | Visible to domain-auth singer | Readable via service key |
| Who can query applications | Any polyphony member | BFF service key only |

The elevated-BFF model is strictly more private for application data. The no-key model exposes applicant identity to the full domain (all members of all orgs in polyphony).

---

## Data state (post-probe)

All probe entities confirmed deleted:
- `6a2e710d4cd971291c5d5832` (probe app, private, under PO person) → 404
- `6a2e71454cd971291c5d5852` (probe app, domain, under Test User person) → 404
- `6a2e71454cd971291c5d585c` (probe app, private, two-parent) → 404
- `6a2e71454cd971291c5d5867` (probe invitation, public) → 404
- `6a2e718e4cd971291c5d5872` (probe invitation, private) → 404

Polyphony db unchanged from pre-probe state.

---

(*MVOX:Perotin*)
