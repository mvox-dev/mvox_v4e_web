# Type-name-string sweep — 2026-05-21

(*MVOX:Perotin*)

> **Status:** live run complete (2026-05-21T20:24:31Z). 1 genuine type-name mismatch found.

## Background

PO encountered a stale type-name string in a menu query: `_type.string == "Organisation"` (British
spelling, capital O) when the actual v4E type is `organization` (American, lowercase). This sweep
scans the polyphony Entu db for all similar literal type-name strings and flags mismatches against
the v4E canonical type list.

**Canonical v4E entity types (19 total):**

| Type name | Section |
|---|---|
| `voice` | 1.1 Identity |
| `person` | 1.1 Identity |
| `organization` | 1.1 Identity |
| `section` | 1.1 Identity |
| `member` | 1.1 Identity |
| `library` | 1.2 Library |
| `work` | 1.2 Library |
| `edition` | 1.2 Library |
| `copy` | 1.2 Library |
| `lending` | 1.2 Library |
| `invitation` | 1.3 Onboarding |
| `application` | 1.3 Onboarding |
| `season` | 1.4 Temporal |
| `event_series` | 1.4 Temporal |
| `event` | 1.4 Temporal |
| `repertoire_item` | 1.4 Temporal |
| `program_item` | 1.4 Temporal |
| `rsvp` | 1.5 Participation |
| `attendance` | 1.5 Participation |

## Scan scope

- **Pass 1:** All `menu` entities — `query`, `reference_query`, `add`, `search` properties
- **Pass 2:** All `_property` entities of `type=formula` — `formula` property strings
- **Pass 3:** All `_property` entities of `type=reference` — `reference_query` property strings

**Probe script:** `scripts/migrations/probes/probe-type-name-string-sweep-2026-05-21.ts`

---

## Results

### 1. Summary table

| Pass | Entities scanned | Genuine mismatches |
|---|---|---|
| Pass 1 — menu (7 entities) | 7 menus | 1 |
| Pass 2 — formula prop-defs | 0 (none found) | 0 |
| Pass 3 — reference prop-defs | 0 (none found) | 0 |
| **Total** | 7 | **1** |

**Note on Pass 2 and 3:** The polyphony db returned 0 entities for `_type.string=_property` +
`type.string=formula` and `type.string=reference`. This is expected — property definitions in Entu
are likely stored differently from instance entities (they may use the meta-type system and not be
reachable via `_type.string=_property`). The sweep can only confirm: no formula/reference property
definitions are reachable via this query path. Manual Entu UI verification would be needed to rule
out query-path gap.

### 2. All menu entities (full inventory)

7 menus found on polyphony db. 5 were flagged by the regex; 4 are Entu meta/system type names
(correct for their purpose), 1 was a regex false-positive (property value, not type name). Only
1 is a genuine v4E type-name mismatch.

| Entu ID | Name | Query string | Type-name status |
|---|---|---|---|
| `69bcfd8e9c031ab8e6ce8070` | Entities | `_type.string=entity&system._id.exists=false&sort=name.string` | `entity` = Entu meta, not v4E — not a bug |
| `69bcfd8e9c031ab8e6ce8071` | Menu | `_type.string=menu&sort=name.string` | `menu` = Entu meta — not a bug |
| `69bcfd8e9c031ab8e6ce8072` | Plugins | `_type.string=plugin&sort=name.string` | `plugin` = Entu meta — not a bug |
| `69bcfd8e9c031ab8e6ce8073` | Persons | `_type.string=person&sort=name.string` | `person` = canonical ✓ |
| `69bcfd8e9c031ab8e6ce8074` | Billing | `/{DATABASE}/billing` | no type filter — not applicable |
| `69c7f88b8489bfcb0e81b5f8` | **Choirs** | `_type.string=Organization&org_type.string=collective&sort=name.string` | **`Organization` → should be `organization`** ← MISMATCH |
| `69c7f88c8489bfcb0e81b600` | Umbrella Orgs | `_type.string=organization&sort=name.string` | `organization` = canonical ✓ |

### 3. Genuine mismatch detail

**Menu: "Choirs"**

- **Entu URL:** `https://entu.app/polyphony/69c7f88b8489bfcb0e81b5f8`
- **Current query string (verbatim):** `_type.string=Organization&org_type.string=collective&sort=name.string`
- **Mismatched type name:** `Organization` (capital O)
- **Suggested correction:** `organization` (lowercase, American spelling — matches v4E schema.ts)
- **Impact:** The "Choirs" menu would return 0 results on a v4E-clean database because no entities have `_type.string=Organization` (type names are stored as the exact string used at entity creation; v4E-clean entities use `organization`). On the transitional polyphony db, results may still appear if the type entity's `name.string` property coincidentally matches (type filtering resolves via the type entity reference, not the literal string — but the menu query uses `_type.string` which IS literal). **This is the same stale string PO encountered.**

**PO's note re "Umbrella Orgs":** That menu actually uses `_type.string=organization` (correct, lowercase) — not stale. The "organisations" PO mentioned was referring to the domain concept; the Umbrella Orgs query itself is clean.

### 4. Formula source mismatches

None found. The db returned 0 formula property definitions via `_type.string=_property&type.string=formula`. See Pass 2 note above.

### 5. Reference-query mismatches

None found. The db returned 0 reference property definitions via `_type.string=_property&type.string=reference`. See Pass 2 note above.

### 6. Recommendations

| # | Item | Fix type | Who |
|---|---|---|---|
| R1 | "Choirs" menu: `Organization` → `organization` | Manual UI edit in Entu — change the `query` property value on entity `69c7f88b8489bfcb0e81b5f8` | PO (1 field edit) |
| R2 | Verify formula/reference prop-def reach | Explore Entu meta-type query path for property definitions; may require a different query shape (e.g., listing under the type entity) | Pérotin (if PO wants completeness) |

R1 is a one-field edit; no cleanup script needed for a single instance. R2 is optional — the formula
and reference property definitions are likely reached via the type-entity subtree, not a flat
`_type.string=_property` query.

---

## Artifact

Result JSON artifact: `scripts/migrations/seed-results/probe-type-name-string-sweep-2026-05-21T20-24-31-517.json`
