# Menu Usability — Pre-Launch Proposal

(*MVOX:Perotin*)

**Status:** PROPOSAL FINALIZED — PO answers incorporated (2026-05-23). Script drafted at `scripts/migrations/cleanup-menu-usability-2026-05-23.ts`. **17 UPDATE ops.** No live mutations until team-lead sends "I authorize this run."
**Inspected:** 2026-05-23 via `GET /polyphony/entity?_type.string=menu` — 23 menus total.
**Baseline:** Session 11 structural rationalization (commits `3525de1` + `7b21bcb`) — one menu per v4E entity type.

**PO answers (2026-05-23 09:27):**
- [Q1] "Programme Items" → **"Programme"** ✓ — applied (U17)
- [Q2] Keep **"RSVPs"** — rename dropped
- [Q3] Keep **"Applications"** — rename dropped
- [Q4] `sort=start_date.date` confirmed valid — v3 schema docs use `sort=date.date` and `sort=-start_date.date`; `.date` suffix is the correct convention for `type: date` properties, matching `.string` for `type: string`.

---

## 1. Goal

Eager users will interact with polyphony via Entu's admin UI directly until mvox ships. The session-11 structural pass established correctness (one menu per type, clean queries). This pass targets **usability**: labels they'll recognize, ordering they'll navigate intuitively, query defaults that surface useful subsets rather than undifferentiated dumps.

Context: pre-launch users are likely conductors, org admins, or librarians who already know what they manage. They are not confused by data-management concepts. They are confused by menus named after internal type names.

---

## 2. Current state — verified live (2026-05-23)

### Configuration group (Entu meta — leave untouched)

| ID | Name | Ordinal | Query |
|---|---|---|---|
| `69bcfd8e9c031ab8e6ce8070` | Entities | 1100 | `_type.string=entity&system._id.exists=false&sort=name.string` |
| `69bcfd8e9c031ab8e6ce8071` | Menu | 1000 | `_type.string=menu&sort=name.string` |
| `69bcfd8e9c031ab8e6ce8072` | Plugins | 1200 | `_type.string=plugin&sort=name.string` |
| `69bcfd8e9c031ab8e6ce8074` | Billing | 9999 | `/{DATABASE}/billing` |

### Organisations group (Entu meta — leave untouched)

| ID | Name | Ordinal | Query |
|---|---|---|---|
| `69bcfd8e9c031ab8e6ce8073` | Persons | (none) | `_type.string=person&sort=name.string` |

### Polyphony group — domain menus (18 items)

In Entu ordinal order:

| Ordinal | ID | Current label | Current query |
|---|---|---|---|
| 110 | `69c7f88b8489bfcb0e81b5f8` | Organisations | `_type.string=organization&sort=name.string` |
| 110 | `6a0f6d304ff8277cd43069ab` | Voices | `_type.string=voice&sort=name.string` |
| 130 | `6a0f6d304ff8277cd43069b6` | Sections | `_type.string=section&sort=name.string` |
| 140 | `6a0f6d304ff8277cd43069c1` | Members | `_type.string=member&sort=name.string` |
| 200 | `6a0f6d314ff8277cd43069cc` | Libraries | `_type.string=library&sort=name.string` |
| 210 | `6a0f6d314ff8277cd43069d7` | Works | `_type.string=work&sort=name.string` |
| 220 | `6a0f6d314ff8277cd43069e2` | Editions | `_type.string=edition&sort=name.string` |
| 230 | `6a0f6d314ff8277cd43069ed` | Copies | `_type.string=copy&sort=name.string` |
| 240 | `6a0f6d314ff8277cd43069f8` | Lending | `_type.string=lending&sort=name.string` |
| 300 | `6a0f6d314ff8277cd4306a03` | Invitations | `_type.string=invitation&sort=name.string` |
| 310 | `6a0f6d314ff8277cd4306a0e` | Applications | `_type.string=application&sort=name.string` |
| 400 | `6a0f6d314ff8277cd4306a19` | Seasons | `_type.string=season&sort=name.string` |
| 410 | `6a0f6d314ff8277cd4306a24` | Event Series | `_type.string=event_series&sort=name.string` |
| 420 | `6a0f6d314ff8277cd4306a2f` | Events | `_type.string=event&sort=name.string` |
| 430 | `6a0f6d324ff8277cd4306a3a` | Repertoire | `_type.string=repertoire_item&sort=name.string` |
| 440 | `6a0f6d324ff8277cd4306a45` | Programme Items | `_type.string=program_item&sort=name.string` |
| 500 | `6a0f6d324ff8277cd4306a50` | RSVPs | `_type.string=rsvp&sort=name.string` |
| 510 | `6a0f6d324ff8277cd4306a5b` | Attendance | `_type.string=attendance&sort=name.string` |

**Observation — ordinal collision:** Organisations and Voices both have ordinal 110. The Entu UI will show them in some non-deterministic order within the tie. This is a low-severity bug from session 11 (Voices was assigned 110, but so was Organisations when it was renamed from the old Choirs menu). Needs a fix regardless of the usability pass.

---

## 3. User workflow analysis

### Cohort A — Singer joining a choir

Primary workflow: find their org → see their member record → see upcoming events → RSVP.

**Menus they need first:**
1. Organisations — find the choir
2. Members — see the roster (their own record, once created)
3. Events — upcoming rehearsals and performances

The current "Events" menu shows all events sorted by `name.string`. Pre-launch this is an empty list; when events exist, a sort by name is misleading — conductors name events like "Rehearsal" many times. The natural sort for events is `start_date` descending or ascending (upcoming first).

### Cohort B — Conductor managing rehearsals

Primary workflow: create a season → create events within it → see attendance → manage programme.

**Menus they need first:**
1. Seasons — the container
2. Events — the workhorse; they create + manage here
3. Attendance — post-rehearsal entry
4. Programme Items / Repertoire — programme assembly

The "Event Series" menu is a subordinate concept that most conductors won't discover until they need recurring event templates. It belongs in the menu set but can be lower-prominence.

### Cohort C — Librarian managing scores

Primary workflow: browse works → find an edition → see copies → manage lending.

**Menus they need first:**
1. Works — find the composition
2. Editions — find the concrete score
3. Copies — see physical inventory
4. Lending — check who has what

The current menu ordering (Libraries → Works → Editions → Copies → Lending) buries the high-traffic entries (Works, Editions) behind the low-traffic container (Libraries). A librarian rarely navigates to "Libraries" — they navigate to "Works". But the library subsystem's entity hierarchy (library → work → edition → copy, lending) requires libraries to exist first, so it does need to be discoverable.

### Cohort D — Org admin

Primary workflow: create the org → create sections → manage membership → onboard new members.

**Menus they need first:**
1. Organisations
2. Sections
3. Members
4. Invitations / Applications — onboarding pipeline

"Invitations" and "Applications" are functionally paired (the membership creation flow requires both). Presenting them adjacent and in the right order (Invitations before Applications) matches the workflow.

---

## 4. Proposed changes

### 4.1 Fix ordinal collision — Voices vs Organisations

**Problem:** Both currently have ordinal 110. Voices should be secondary to Organisations in the identity grouping.

| Menu | Current ordinal | Proposed ordinal |
|---|---|---|
| Organisations | 110 | 120 |
| Voices | 110 | 105 |

Wait — reconsider. Organisations is the primary nav entry for all cohorts; Voices is a reference taxonomy rarely navigated. Proposed:

| Menu | Proposed ordinal |
|---|---|
| Organisations | 110 (keep) |
| Voices | 115 |

### 4.2 Query improvements — sort by date where applicable

The "Events" menu currently sorts by `name.string`. Events are time-anchored; the intuitive sort is by `start_date`. Proposed query change:

| Menu | Current query | Proposed query |
|---|---|---|
| Events | `_type.string=event&sort=name.string` | `_type.string=event&sort=start_date.date` |
| Seasons | `_type.string=season&sort=name.string` | `_type.string=season&sort=start_date.date` |
| Event Series | `_type.string=event_series&sort=name.string` | `_type.string=event_series&sort=name.string` (keep — no date field) |

**Note on event default filter:** A common usability improvement would be to default "Events" to upcoming only (e.g., `start_date.date.gte=<today>`). However, Entu's query syntax for date comparisons uses `gt` / `lt` operators, and injecting a dynamic date requires knowing whether the Entu `menu.query` is evaluated at render time with substitution or is static. The session-11 sweep confirmed menu queries are static strings (no substitution). An "upcoming events" filter would need a static cutoff date, which is not useful. **Defer date-filter to mvox app layer.** Today's change: just fix the sort.

### 4.3 Label improvements

| Current label | Proposed label | Status |
|---|---|---|
| Lending | Loans | Applied (U2) — standard library term for lending records |
| Programme Items | Programme | Applied (U17) — PO confirmed [Q1] |
| RSVPs | (keep) | Dropped — PO confirmed [Q2] keep |
| Applications | (keep) | Dropped — PO confirmed [Q3] keep |

Labels left unchanged:
- "Sections" — universally understood choir terminology
- "Editions" — standard library/bibliographic term; librarians will recognize it
- "Copies" — standard library term
- "Libraries" — the container; keep as-is (self-explanatory)
- "Invitations" — clear
- "Event Series" — clear enough; no better 2-word alternative
- "Attendance" — clear
- "Voices" — choir-domain term; universally understood in context
- "Repertoire" — already approved, clear
- "Works" — music-library term, appropriate for librarian cohort

### 4.4 Ordinal rebalancing — surface high-traffic entries

Current grouping is correct (Identity 100s, Library 200s, Onboarding 300s, Temporal 400s, Participation 500s). Within each group, re-order by workflow frequency:

**Identity group (100s):**

| Proposed ordinal | Menu | Rationale |
|---|---|---|
| 110 | Organisations | Primary nav entry — all cohorts land here first |
| 115 | Voices | Reference taxonomy — low-traffic, but belongs in identity section |
| 120 | Sections | Admin cohort uses frequently; conductor cohort moderately |
| 130 | Members | High-traffic for all cohorts once org is set up |

**Library group (200s) — reorder to lead with high-traffic:**

| Proposed ordinal | Menu | Rationale |
|---|---|---|
| 200 | Works | Librarian's primary nav entry — most browsed |
| 210 | Editions | Second most common librarian destination |
| 220 | Copies | Physical inventory — librarian uses regularly |
| 230 | Loans | Lending records — the active-state query |
| 240 | Libraries | Container — low-traffic; create-and-forget after setup |

**Onboarding group (300s) — keep current order:**

| Proposed ordinal | Menu | Rationale |
|---|---|---|
| 300 | Invitations | Workflow step 1 (admin sends invitation) |
| 310 | Applications / Membership Requests | Workflow step 2 (person applies) |

**Temporal group (400s) — reorder to put Events before Seasons:**

| Proposed ordinal | Menu | Rationale |
|---|---|---|
| 400 | Events | Conductor's most-visited menu; immediate operational concern |
| 410 | Seasons | Container for events; set up once per season |
| 420 | Repertoire | Programme planning — tied to events |
| 430 | Programme | Programme items per event |
| 440 | Event Series | Recurring-event templates — advanced, lower frequency |

**Participation group (500s) — keep current order, possibly swap:**

| Proposed ordinal | Menu | Rationale |
|---|---|---|
| 500 | Attendance | Conductor enters attendance after every rehearsal — high frequency |
| 510 | Responses (RSVPs) | Members self-submit; conductor monitors — moderate frequency |

### 4.5 Summary of proposed changes (ops manifest)

All ops are UPDATE ops on existing menu entities. No creates or deletes.

| Op | Entity ID | Field | From | To |
|---|---|---|---|---|
| U1 | `6a0f6d304ff8277cd43069ab` | ordinal | 110 | 115 |
| U2 | `6a0f6d314ff8277cd43069f8` | name | Lending | Loans |
| U3 | `6a0f6d314ff8277cd43069f8` | ordinal | 240 | 230 |
| U4 | `6a0f6d314ff8277cd43069cc` | ordinal | 200 | 240 |
| U5 | `6a0f6d314ff8277cd43069d7` | ordinal | 210 | 200 |
| U6 | `6a0f6d314ff8277cd43069e2` | ordinal | 220 | 210 |
| U7 | `6a0f6d314ff8277cd43069ed` | ordinal | 230 | 220 |
| U8 | `6a0f6d314ff8277cd4306a2f` | ordinal | 420 | 400 |
| U9 | `6a0f6d314ff8277cd4306a2f` | query | `...&sort=name.string` | `...&sort=start_date.date` |
| U10 | `6a0f6d314ff8277cd4306a19` | ordinal | 400 | 410 |
| U11 | `6a0f6d314ff8277cd4306a19` | query | `...&sort=name.string` | `...&sort=start_date.date` |
| U12 | `6a0f6d324ff8277cd4306a3a` | ordinal | 430 | 420 |
| U13 | `6a0f6d324ff8277cd4306a45` | ordinal | 440 | 430 |
| U14 | `6a0f6d314ff8277cd4306a24` | ordinal | 410 | 440 |
| U15 | `6a0f6d324ff8277cd4306a50` | ordinal | 500 | 510 |
| U16 | `6a0f6d324ff8277cd4306a5b` | ordinal | 510 | 500 |

**PO-answered additions:**

| Op | Entity ID | Field | From | To | Status |
|---|---|---|---|---|---|
| U17 | `6a0f6d324ff8277cd4306a45` | name | Programme Items | Programme | INCLUDED — PO [Q1] confirmed |

---

## 5. Open questions — RESOLVED

All four questions answered by PO (2026-05-23 09:27):

- **[Q1] Programme Items → "Programme":** YES — applied as U17.
- **[Q2] RSVPs → "Responses":** NO — keep "RSVPs". Dropped.
- **[Q3] Applications → "Membership Requests":** NO — keep "Applications". Dropped.
- **[Q4] `sort=start_date.date` syntax:** CONFIRMED by probe + v3 schema docs. The v3 `event.md` and `season.md` use `sort=date.date` and `sort=-start_date.date` explicitly. Both `sort=start_date.date` and `sort=start_date` accepted without error by the API; `.date` suffix is the correct form for `type: date` properties (mirrors `.string` for `type: string`). Applied as U9 + U11.

---

## 6. What this does NOT change

- **Entu meta menus** (Configuration group: Entities, Menu, Plugins, Billing) — unchanged.
- **Persons meta menu** (Organisations group) — unchanged.
- **Menu queries beyond sort** — no attempt to add default filters (e.g., "upcoming events only") because Entu menu queries are static strings; dynamic date filtering belongs in the mvox app layer.
- **The `add` property** — none of the current domain menus have an `add` property (allow creating new instances from the menu list view). That's a separate decision when BFF patterns are stable.
- **v4E schema** — this is purely Entu infrastructure. No Schema-Change trailer needed.

---

## 7. Affiliation-deep probe status

`probes/probe-phase-c-affiliation-deep-2026-05-21.ts` — this was a **read-only pre-flight probe** written as part of Phase C discovery (session 10) to inspect affiliation entity structure before the deletion script was written. Phase C is fully closed (affiliation type retired, 4 instances deleted, AC verification 9/9 PASS). No findings document is needed — the probe's purpose was satisfied by the Phase C scripts and their result artifacts. No follow-up action required.

---

## 8. Implementation notes (for when PO authorizes)

All changes are UPDATE ops (DELETE old prop value + POST new value per replace semantics). The existing `perotin-toolkit.ts` `replaceProperty()` export handles this pattern. A new script `cleanup-menu-usability-2026-05-23.ts` should:

1. Auth via `getJwt`
2. For each op: fetch current entity, verify the current value matches what's recorded here (drift check), then execute replace
3. Log every op result to stdout + accumulate into JSON artifact at `seed-results/cleanup-menu-usability-<ts>.json`
4. Exit 0 on success

The ordinal rebalancing involves 10 menus swapping ordinals. Sequential execution is safe (no two ops target the same entity for the same field simultaneously). No race conditions.

---

(*MVOX:Perotin*)
