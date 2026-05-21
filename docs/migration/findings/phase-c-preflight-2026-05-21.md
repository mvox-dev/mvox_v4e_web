# Phase C Pre-flight Findings

**Date:** 2026-05-21  
**Probe:** `scripts/migrations/probes/probe-phase-c-preflight-2026-05-21.ts`  
**Artifact:** `scripts/migrations/seed-results/probe-phase-c-preflight-2026-05-21T15-28-23-732.json`  
**Authorization:** Read-only. No mutations.

---

## Halt-condition status: GO

Neither halt condition triggered:

- **Formula references** scanned across all 248 prop-defs: **0 hits**. No formula in any type references `affiliation.*`, `inventory_copy.*`, `participation.*`, `member.*.role`, or `role.*`.
- **Reference-query pickers** scanned across all reference-typed prop-defs: **0 hits**. No prop-def's `reference_query._type` targets a retiring type.

Clean to proceed to Tasks 2-6.

---

## Instance counts (drift check from a1aba7a)

| Type | a1aba7a baseline | Pre-flight count | Drift? |
|---|---|---|---|
| `inventory_copy` | 0 | **0** | none |
| `participation` | 0 | **0** | none |
| `affiliation` | 4 | **4** | none |
| `member.role` values | 8 | **8** (4 members × 2) | none |

No drift. All counts stable since session-10 discovery.

One corrected ID: session-10 discovery notes recorded member IDs `69c7f87e8489bfcb0e81b2f9` (Rahvusmeeskoor) and `69c7f8878489bfcb0e81b50f` (TAM) which returned 404. Correct IDs confirmed live: `69c7f87e8489bfcb0e81b304` and `69c7f8878489bfcb0e81b510`. Scratchpad updated.

---

## Role-type entity inventory

**5 instances** — not 2 as the design spec estimated. All five must be deleted in C.5:

| _id | Display name |
|---|---|
| `69c7f8708489bfcb0e81b020` | Owner |
| `69c7f8708489bfcb0e81b02e` | Admin |
| `69c7f8718489bfcb0e81b03b` | Librarian |
| `69c7f8718489bfcb0e81b045` | Conductor |
| `69c7f8718489bfcb0e81b050` | Section Leader |

Librarian, Conductor, and Section Leader carry no live `role` property values on any member (confirmed: only Owner + Admin had values on the 4 PO members). They are orphaned role-type entities with no current consumers. The C.5 script should enumerate `listInstancesByType('role')` at runtime (not hard-code the 5 IDs) so any further drift is caught.

---

## Type-def entity IDs

| Type | Type-def entity `_id` |
|---|---|
| `inventory_copy` | `69c7ea508489bfcb0e819fed` |
| `participation` | `69c7ea588489bfcb0e81a137` |
| `affiliation` | `69c7ea598489bfcb0e81a178` |
| `role` | `69c7ea468489bfcb0e819df9` |
| `member` (for prop-def lookup) | `69c7ea4a8489bfcb0e819edd` |

---

## Prop-def inventory

### `inventory_copy` — 7 prop-defs

| _id | Name | Type |
|---|---|---|
| `69c7ea508489bfcb0e819ff4` | name | string |
| `69c7ea518489bfcb0e81a000` | copy_number | number |
| `69c7ea518489bfcb0e81a00b` | edition | reference |
| `69c7ea518489bfcb0e81a017` | condition | string |
| `69c7ea518489bfcb0e81a025` | assigned_to | reference |
| `69c7ea528489bfcb0e81a030` | assigned_at | date |
| `69c7ea528489bfcb0e81a03a` | notes | text |

### `participation` — 5 prop-defs

| _id | Name | Type |
|---|---|---|
| `69c7ea588489bfcb0e81a13e` | name | string |
| `69c7ea588489bfcb0e81a14a` | member | reference |
| `69c7ea588489bfcb0e81a156` | rsvp | string |
| `69c7ea588489bfcb0e81a163` | attended | boolean |
| `69c7ea598489bfcb0e81a16d` | noted_by | reference |

### `affiliation` — 5 prop-defs

| _id | Name | Type |
|---|---|---|
| `69c7ea598489bfcb0e81a17f` | name | string |
| `69c7ea598489bfcb0e81a18b` | umbrella | reference |
| `69c7ea5a8489bfcb0e81a197` | joined_at | date |
| `69c7ea5a8489bfcb0e81a1a2` | left_at | date |
| `69c7ff138489bfcb0e81b644` | collective | reference |

### `role` type — 5 prop-defs

| _id | Name | Type |
|---|---|---|
| `69c7ea468489bfcb0e819e00` | name | string |
| `69c7ea468489bfcb0e819e0c` | description | text |
| `69c7ea468489bfcb0e819e17` | permissions | string |
| `69c7ea478489bfcb0e819e27` | ordinal | number |
| `69c7ea478489bfcb0e819e31` | member_count | number |

### `member.role` prop-def

| _id | Name | Type |
|---|---|---|
| `69c7ea4b8489bfcb0e819f11` | role | reference |

---

## Operation count summary (actual, for design-spec calibration)

| Sub-op | DELETEs |
|---|---|
| C.1 — inventory_copy | 7 prop-defs + 1 type-def = **8** |
| C.2 — participation | 5 prop-defs + 1 type-def = **6** |
| C.3 — affiliation | 4 instances + 5 prop-defs + 1 type-def = **10** |
| C.4 — member.role | 8 property-values + 1 prop-def = **9** |
| C.5 — role type | 5 instances + 5 prop-defs + 1 type-def = **11** |
| **Total** | **44 DELETEs** |

Design spec estimated "~35–50 live ops total" — confirmed at 44. Within range.

---

## Recommendation

**Proceed to Tasks 2-6.** No halt conditions. Counts stable. All concrete IDs captured in artifact for script consumption.

Flag for team-lead: design spec estimated 2 role-type instances (Owner + Admin); actual count is 5 (also Librarian, Conductor, Section Leader). No change to Phase C scope — all 5 retire — but C.5 script should dynamically enumerate `listInstancesByType('role')` rather than consuming a hard-coded list, per the plan's "halt-on-surprise" pattern. The 5 IDs in the preflight artifact are the authoritative pre-run snapshot; the runtime recount is the drift-check gate.

(*MVOX:Pérotin*)
