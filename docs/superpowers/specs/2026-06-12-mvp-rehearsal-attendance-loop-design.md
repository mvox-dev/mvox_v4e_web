# mvox MVP — Rehearsal Attendance Loop

**Status:** APPROVED scope (PO, 2026-06-12 session 32)
**Defines:** what "MVP" means for mvox, the three buildable slices, prerequisites, and the deferred list.

## 1. MVP definition

A choir can run weekly rehearsal attendance entirely on mvox:

> Admin schedules rehearsals (✅ shipped, sessions 29–30) → admin invites singers via copy-link → singer joins → singer sees their unified agenda → singer RSVPs going / not_going / maybe / late → conductor sees who's coming via an aggregated tally.

The loop targets the singer — the largest user group, currently unserved (every shipped surface is admin/librarian-facing). Today there is no way to get a person into an org through the app and nothing for them to see once in.

## 2. Settled product decisions

| Decision | Choice | Rationale |
|---|---|---|
| MVP core loop | Rehearsal attendance | Real choirs can run weekly rehearsals on mvox; repertoire/scores and org-self-service loops deferred |
| Onboarding depth | Invite-only, Path A (#21 + #11) | Bilateral consent preserved (invite = org consent, accept = singer consent); application/self-signup path deferred |
| Invite delivery | Copy-the-link | Email sending (#6) is blocked on PO SPF/DKIM; admin sends the link via their own channel |
| Singer surface | Unified agenda, all orgs (#10) | One chronological list across all memberships; degrades gracefully for single-choir singers |
| RSVP states | `going \| not_going \| maybe \| late` | "late" is a first-class singer intent; requires upstream enum addition (see §5) |
| RSVP changeability | Freely changeable until the rehearsal | Lockout (#9) + org policy hours (#22) deferred |
| RSVP visibility | Per Entu rights — no app-level policy | rsvp is private under person; conductor tally via elevated BFF report, exactly as the v4E schema note prescribes |

## 3. Schema ground truth (Finn audit, 2026-06-12, v4E.0.1)

**No schema gaps.** All required entities exist:

- **`rsvp`** — child of `person` (1:N "by"), `_sharing: private`, creator `self`. Props: `event` ref (req), `member` ref (req — org context), `status` enum, `notes`. Schema note: "Private — person sees own; admins/conductors aggregate via BFF report."
- **`invitation`** — child of `organization`, `_sharing: private`, creator = org `_owner`. Props: `email` (req), `token` (req, UUID for URL access), `expires_at` (req, default 30d), `sections[*]`, `inviter`, `message`. Deleted on acceptance (no status field).
- **`member`** — multi-parent (org required + sections optional), instance default private, creator rule `bilateral` (BFF-only via invitation + application). Props: `person` ref (req), `current_section`, `status` (`active | archived`).
- **`attendance`** — child of `event`, conductor-created (`_editor` on event scope), status `present | absent | late`. Adjacent, not MVP-critical.

**Why rsvp is child-of-person (design rationale, re-validated this session):** Entu entity creation requires rights on the parent. Under event, singers (no `_editor`) could not create RSVPs without granting event-edit rights to every member or proxying every write through an elevated op. Under person, writes are native (`creator: self`) and only the read-side aggregate needs elevation — one curated read-only report vs. an elevated write-proxy on every singer action. Symmetric: `attendance` is child-of-event because its author (conductor) natively holds rights there.

## 4. The three slices (build order)

### Slice 1 — Unified singer agenda (#10)

- New route `/agenda`: chronological list of upcoming rehearsals across every org the user belongs to.
- Data path: `userStore` memberships → orgs → seasons → events (client-side hydration, existing pattern; reuses/extends `listRehearsals`).
- Read-only. No new rights, no elevated ops, no schema change.
- Live-testable immediately with seeded EFK members (Jaan Kõrv, Eve Lepik).
- *This is the page RSVP lands on in slice 2.*

### Slice 2 — RSVP (#8)

- Inline 4-state control (`going | not_going | maybe | late`) on each agenda row.
- Write path: singer creates/updates own `rsvp` under their person entity, with `event` + `member` refs. The UI resolves the correct `member` id from the event's org (userStore already carries membership ↔ org mapping).
- Singer always sees their own RSVP state on the agenda (native rights).
- **Conductor tally:** aggregated per-rehearsal summary (counts + names) surfaced on the `/seasons` manage side, served by an elevated BFF report endpoint (§6).
- Lockout NOT enforced; RSVPs editable until rehearsal start.

### Slice 3 — Invite & join (#21 + #11)

- Admin side (on `/seasons` org context or a small `/members` surface — slice-level spec decides): create invitation (email, optional sections, optional message) → app shows a copyable link `/invite/<token>`.
- Singer side: opens link → landing page resolves the token via elevated op (§6) and shows "«Org» invites you" → Entu OAuth sign-in → accept.
- Accept = bilateral consent consummation, BFF-mediated: create `application` (singer's consent, immediately consumed) → create `member` (multi-parent: org + preset sections; `person` ref; `status: active`) → delete `invitation` + `application`.
- Expired tokens (past `expires_at`) → clear error page.
- No email sending; no application/self-signup path.

## 5. Upstream schema change (prerequisite, slice 2)

Add `late` to the `rsvp.status` enum: `going | not_going | maybe | late`.

- Mechanical enum addition in `entu/research` `docs/schema/v4E/schema.ts` (+ regenerate `schema.json`, sweep README).
- Team-lead authors + opens the upstream PR (per the v4E-ours-to-maintain decision).
- PO approval: given verbally 2026-06-12, logged here — satisfies the `PO-Approved:` trailer for the mvox slice-2 PR, which also carries `Schema-Change: entu/research@<sha>`.

## 6. Elevated BFF ops (prerequisite, slices 2–3)

mvox's first server-side Entu calls. Two endpoints join the enumerated elevated-ops list (architecture-decisions.md):

1. **`GET /api/reports/rsvp-summary?eventId=`** — conductor/admin-only (caller's own JWT must hold `_editor`/`_owner` on the event scope — verified before the elevated query runs). Returns per-status counts + member names for one rehearsal.
2. **`GET /api/invite/<token>`** — public (pre-auth). Resolves token → org display name + invite validity. Returns the minimum needed to render the landing page; never exposes the full invitation entity.

Mechanism: CF Worker holds the org service API key (secret), exchanges it for an Entu JWT and uses it **within the same invocation** (Entu JWTs are IP-bound; same-invocation mint+use should share the egress IP).

**GATING PROBE (Pérotin, before slice 2 spec):** deploy a scratch Worker that mints + uses an Entu JWT in one invocation against the polyphony db. If the IP-bound hypothesis fails, the elevated-ops design must be revisited before slices 2–3 proceed. Slice 1 is NOT gated.

## 7. Explicitly deferred (not MVP)

| Item | Why deferred |
|---|---|
| #9 RSVP lockout + #22 org policy page | Pilot choirs don't need hard lockouts yet |
| #23 roster management | Invite + Entu-side archival suffice for MVP |
| Epic C (programme/scores #14–16) | Next loop after attendance; needs licensed content |
| #17 D1 unified dashboard, #18 role display | Agenda covers the daily-use need |
| #12 cross-choir conflict warning | Multi-choir polish, post-MVP |
| Application/self-signup path | Invite covers pilot onboarding |
| #6 email sending | Blocked on PO SPF/DKIM; copy-link replaces it |
| `attendance` recording UI | Conductor-side bookkeeping, post-MVP |

## 8. Slice execution

Each slice gets its own design spec + implementation plan + team TDD chain (Tallis RED → Byrd/Josquin GREEN → Comenius i18n where user-facing strings exist → Bentham review → Josquin merge), one branch at a time. Slice 1 spec is the next artifact after this document.

(*MVOX:Palestrina*)
