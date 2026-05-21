# Menu rationalization design — one menu per entity type

(*MVOX:Perotin*)

> **Status:** COMPLETE. Live run 2026-05-21T20:38:08Z — all 19 ops landed. Post-mutation type-name sweep: CLEAN (0 domain mismatches across all 18 Polyphony-group menus).

## Goal

Rationalize the polyphony Entu menu set to one menu item per live v4E entity type:

1. Merge "Choirs" + "Umbrella Orgs" into a single "Organisations" menu (all org instances).
2. Create one menu item per remaining v4E entity type in the Polyphony group.

**Script:** `scripts/migrations/seed-menu-items-per-entity-type-2026-05-21.ts`
**Dry-run artifact:** `scripts/migrations/seed-results/seed-menu-items-per-entity-type-dry-run-2026-05-21T20-33-49-647.json`

---

## Current state (7 menus)

### Entu meta menus — KEEP as-is

| ID | Name | Query | Action |
|---|---|---|---|
| `69bcfd8e9c031ab8e6ce8070` | Entities | `_type.string=entity&...` | KEEP |
| `69bcfd8e9c031ab8e6ce8071` | Menu | `_type.string=menu&...` | KEEP |
| `69bcfd8e9c031ab8e6ce8072` | Plugins | `_type.string=plugin&...` | KEEP |
| `69bcfd8e9c031ab8e6ce8074` | Billing | `/{DATABASE}/billing` | KEEP |
| `69bcfd8e9c031ab8e6ce8073` | Persons | `_type.string=person&sort=name.string` | KEEP (already clean) |

### Polyphony domain menus — CHANGE

| ID | Current name | Current query | Action |
|---|---|---|---|
| `69c7f88b8489bfcb0e81b5f8` | Choirs | `_type.string=Organization&org_type.string=collective&sort=name.string` | **UPDATE** |
| `69c7f88c8489bfcb0e81b600` | Umbrella Orgs | `_type.string=organization&sort=name.string` | **DELETE** |

---

## Target state — proposed manifest

### DELETE (1 op)

| ID | Name | Reason |
|---|---|---|
| `69c7f88c8489bfcb0e81b600` | Umbrella Orgs | Superseded by unified Organisations menu (all org instances regardless of type). |

### UPDATE (1 op)

**"Choirs" → "Organisations"** (`69c7f88b8489bfcb0e81b5f8`)

| Field | From | To |
|---|---|---|
| `name` | `Choirs` | `Organisations` [Q1][Q4] |
| `query` | `_type.string=Organization&org_type.string=collective&sort=name.string` | `_type.string=organization&sort=name.string` |
| `ordinal` | `110` | `120` [Q3] |
| `group` | `Polyphony` | `Polyphony` (no change) |

### CREATE (17 ops — one per remaining v4E type)

All created with `group=Polyphony`, `_sharing=domain`, `_parent=polyphony db entity`.

| Ordinal | Type name | Proposed label | Query | Live instances |
|---|---|---|---|---|
| 110 | `voice` | Voices | `_type.string=voice&sort=name.string` | 5 |
| 120 | `organization` | Organisations | *(UPDATE of existing — not a CREATE)* | 6 |
| 130 | `section` | Sections | `_type.string=section&sort=name.string` | 16 |
| 140 | `member` | Members | `_type.string=member&sort=name.string` | 235 |
| 200 | `library` | Libraries | `_type.string=library&sort=name.string` | 0 [Q2] |
| 210 | `work` | Works | `_type.string=work&sort=name.string` | 0 [Q2] |
| 220 | `edition` | Editions | `_type.string=edition&sort=name.string` | 0 [Q2] |
| 230 | `copy` | Copies | `_type.string=copy&sort=name.string` | 0 [Q2] |
| 240 | `lending` | Lendings | `_type.string=lending&sort=name.string` | 0 [Q2] |
| 300 | `invitation` | Invitations | `_type.string=invitation&sort=name.string` | 0 [Q2] |
| 310 | `application` | Applications | `_type.string=application&sort=name.string` | 0 [Q2] |
| 400 | `season` | Seasons | `_type.string=season&sort=name.string` | 0 [Q2] |
| 410 | `event_series` | Event Series | `_type.string=event_series&sort=name.string` | 0 [Q2] |
| 420 | `event` | Events | `_type.string=event&sort=name.string` | 0 [Q2] |
| 430 | `repertoire_item` | Repertoire | `_type.string=repertoire_item&sort=name.string` | 0 [Q2] |
| 440 | `program_item` | Programme Items | `_type.string=program_item&sort=name.string` | 0 [Q2] |
| 500 | `rsvp` | RSVPs | `_type.string=rsvp&sort=name.string` | 0 [Q2] |
| 510 | `attendance` | Attendance | `_type.string=attendance&sort=name.string` | 0 [Q2] |

**Note on `Persons` (ordinal absent, group "Organisations"):** This is an existing Entu meta menu
(created at db provisioning with bilingual name/group). Its group is "Organisations" (with language
tags, not the plain-string "Polyphony" group). The script treats it as KEEP — it does not have a
Polyphony-group ordinal and is not in the polyphony domain namespace. It can coexist.

---

## Open questions for PO

### [Q1] Naming convention

Proposed English labels shown in the CREATE table above. Key decisions:

- `person` → **"Persons"** (already exists, unchanged)
- `organization` → **"Organisations"** (British spelling for UX; query uses v4E `organization`)
- `repertoire_item` → **"Repertoire"** (dropped "Items" for readability) — or "Repertoire Items"?
- `program_item` → **"Programme Items"** (British "programme" for UX) — or "Program Items"?
- `event_series` → **"Event Series"** (matches type name structure)
- `rsvp` → **"RSVPs"** (acronym; alternative: "Responses")
- `lending` → **"Lendings"** (grammatically correct plural; alternative: "Loans")

**PO action:** confirm or correct any label above before authorization.

### [Q2] Zero-instance types — include or skip?

14 of 19 types have 0 live instances today (`library`, `work`, `edition`, `copy`, `lending`,
`invitation`, `application`, `season`, `event_series`, `event`, `repertoire_item`, `program_item`,
`rsvp`, `attendance`).

**Proposed default (Option A):** Include all 19. Menus with 0 instances show an empty list in the
Entu UI — useful for PO when manually adding first instances of each type, and ensures the menu set
is forward-complete for mvox development.

**Option B:** Only create menus for the 5 types with live instances (`voice`, `person`,
`organization`, `section`, `member`). Leaner now; revisit when seeding new types.

**PO action:** confirm A or B (or C: per-type list).

### [Q3] Sort order within Polyphony group

Proposed: logical schema grouping by section, 10-step ordinal gaps within each group:

```
Identity:      voice=110, organization=120, section=130, member=140
Library:       library=200, work=210, edition=220, copy=230, lending=240
Onboarding:    invitation=300, application=310
Temporal:      season=400, event_series=410, event=420, repertoire_item=430, program_item=440
Participation: rsvp=500, attendance=510
```

Alternative: alphabetical by label (Application, Attendance, Copies, ...).

**PO action:** confirm logical grouping or request alphabetical.

### [Q4] Org menu name: "Organisations" vs "Organizations"

The v4E type name is `organization` (American). The Entu UI locale files use Estonian "Asutused"
for et. For the English label:

- **"Organisations"** (British) — consistent with existing Entu UI conventions on this db
- **"Organizations"** (American) — consistent with v4E type name

Query string uses `_type.string=organization` (canonical) regardless of display label.

**PO action:** confirm preferred spelling for the display label.

---

## Notes on scope

- **Not a v4E schema mutation.** Menu entities are Entu infrastructure, not schema types. No
  `Schema-Change:` or `PO-Approved:` trailers needed.
- **1 DELETE op.** Umbrella Orgs is the only destructive op. It is recoverable (can be re-created
  manually in Entu UI if needed).
- **No `add` property on new menus.** Existing polyphony domain menus (`Choirs`, `Umbrella Orgs`)
  have no `add` property — kept consistent. The `add` property would allow creating new instances
  directly from the menu view; that's a separate decision once BFF is in place.
- **`_sharing: domain`** on all new menus — matches existing polyphony domain menus.

---

## Post-run verification

Post-mutation type-name sweep run at 2026-05-21T20:38:52Z:

- 23 menus scanned (6 Entu meta + 17 Polyphony-group domain menus + "Persons" Entu meta)
- 3 flagged by regex — all Entu infrastructure types (`entity`, `menu`, `plugin`), not v4E domain types — same pattern as pre-run, not bugs
- **0 domain mismatches** across all 18 Polyphony-group menus
- All new menus confirmed to use v4E canonical lowercase type names

Result: **CLEAN.**

**Live result artifact:** `scripts/migrations/seed-results/seed-menu-items-per-entity-type-live-2026-05-21T20-38-10-360.json`
**Post-sweep artifact:** `scripts/migrations/seed-results/probe-type-name-string-sweep-2026-05-21T20-38-52-535.json`
