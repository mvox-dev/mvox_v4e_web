# Polyphony DB ↔ v4E Schema Divergence
## Persistent source of truth — produced 2026-05-19

Status: snapshot. Regenerate after Phase A/B/C/D ops complete.

**Post-hoc corrections** (the snapshot is dated; these override it where they conflict):

- **2026-09-01 — `person.entu_user`**: the "currently `string`, Phase B pending" line was stale. Entu
  already owns the rich multi-valued `{uid, provider, email}` credential form plus a lazy old-format
  migration; no mvox-side op is owed. Marked in §2 `person` and §Phase B · **[SRC]**
  `entu-api routes/auth/index.get.js:155-183`.

---

## 1. Polyphony DB Inventory

Queried via `GET /entity?_type.reference=69bcfd8e9c031ab8e6ce8034&limit=50` (meta-type-entity reference form, no parent constraint). Returns all 19 entity type definitions including Entu internals.

**App entity types (13)** — excludes Entu internals: `database`, `entity`, `menu`, `plugin`, `property`.

| Name | `_id` | `_parent` | `_inheritrights` | `_sharing` | Prop count |
|---|---|---|---|---|---|
| `affiliation` | `69c7ea598489bfcb0e81a178` | none (root) | true | domain | 5 |
| `edition` | `69c7ea4e8489bfcb0e819f9c` | none (root) | true | domain | 6 |
| `event` | `69c7ea548489bfcb0e81a0a2` | none (root) | true | domain | 8 |
| `inventory_copy` | `69c7ea508489bfcb0e819fed` | none (root) | true | domain | 7 |
| `member` | `69c7ea4a8489bfcb0e819edd` | none (root) | true | domain | 8 |
| `organization` | `69c7ea478489bfcb0e819e3d` | none (root) | true | domain | 8 |
| `participation` | `69c7ea588489bfcb0e81a137` | none (root) | true | domain | 5 |
| `person` | `69bcfd8e9c031ab8e6ce805f` | `69bcfd8e9c031ab8e6ce807a` (db) | true | domain | 20 |
| `program_item` | `69c7ea568489bfcb0e81a103` | none (root) | true | domain | 4 |
| `repertoire_item` | `69c7ea538489bfcb0e81a06e` | none (root) | true | domain | 4 |
| `role` | `69c7ea468489bfcb0e819df9` | none (root) | true | domain | 5 |
| `season` | `69c7ea528489bfcb0e81a044` | none (root) | true | domain | 3 |
| `section` | `69c7ea498489bfcb0e819ea3` | none (root) | true | domain | 4 |
| `work` | `69c7ea4c8489bfcb0e819f3e` | none (root) | true | domain | 8 |

**Note on parent layout:** All 12 app entity types (except `person`) have no `_parent` set on their type-definition entity — they are root-level entities in the Entu meta-model. Only `person`, `database`, `entity`, `menu`, `plugin`, `property` are parented under the polyphony db entity (`69bcfd8e9c031ab8e6ce807a`). This is why queries filtering by `_parent.reference=<db-id>` only return 6 results, not the full 19. **Use `_type.reference=69bcfd8e9c031ab8e6ce8034` with no parent constraint to enumerate all entity types.**

### Property detail per type

#### `affiliation` (5 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `collective` | reference | — | — | yes |
| `joined_at` | date | — | — | yes |
| `left_at` | date | — | — | — |
| `name` | string | `_parent.*.name ' @ ' umbrella.*.name CONCAT` | — | — |
| `umbrella` | reference | — | — | yes |

#### `edition` (6 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `edition_type` | string | — | — | yes |
| `file` | file | — | list | — |
| `license` | string | — | — | — |
| `name` | string | — | — | yes |
| `publisher` | string | — | — | — |
| `year` | number | — | — | — |

#### `event` (8 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `date` | date | — | — | yes |
| `end_time` | datetime | — | — | — |
| `event_type` | string | — | — | yes |
| `location` | string | — | — | — |
| `name` | string | — | — | yes |
| `notes` | text | — | — | — |
| `season` | reference | — | — | — |
| `start_time` | datetime | — | — | — |

#### `inventory_copy` (7 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `assigned_at` | date | — | — | — |
| `assigned_to` | reference | — | — | — |
| `condition` | string | — | — | — |
| `copy_number` | number | — | — | yes |
| `edition` | reference | — | — | yes |
| `name` | string | — | — | yes |
| `notes` | text | — | — | — |

#### `member` (8 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `email` | string | — | — | — |
| `invited_by` | reference | — | — | — |
| `joined_at` | date | — | — | — |
| `name` | string | — | — | yes |
| `nickname` | string | — | — | — |
| `person` | reference | — | — | — |
| `role` | reference | — | list | — |
| `section` | reference | — | list | — |

#### `organization` (8 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `contact_email` | string | — | — | yes |
| `description` | text | — | — | — |
| `language` | string | — | — | — |
| `locale` | string | — | — | — |
| `member_count` | number | `(_child.member.name COUNT) (_child.organization.member_count SUM) SUM` | — | — |
| `name` | string | — | — | yes |
| `org_type` | string | — | — | yes |
| `timezone` | string | — | — | — |

#### `participation` (5 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `attended` | boolean | — | — | — |
| `member` | reference | — | — | yes |
| `name` | string | — | — | yes |
| `noted_by` | reference | — | — | — |
| `rsvp` | string | — | — | — |

#### `person` (20 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `address` | string | — | — | — |
| `birthdate` | date | — | — | — |
| `county` | string | — | — | — |
| `email` | string | — | — | — |
| `entu_api_key` | string | — | — | — |
| `entu_passkey` | string | — | — | — |
| `entu_user` | string | — | — | — |
| `forename` | string | — | — | — |
| `idcode` | string | — | — | — |
| `language` | string | — | — | — |
| `locale` | string | — | — | — |
| `name` | string | `forename ' ' surname` | — | — |
| `notes` | text | — | — | — |
| `phone` | string | — | — | — |
| `photo` | file | — | — | — |
| `postalcode` | string | — | — | — |
| `surname` | string | — | — | — |
| `timezone` | string | — | — | — |
| `town` | string | — | — | — |
| `voice` | string | — | list | — |

> **Correction 2026-09-01 — `entu_user` is not a plain single string.** The `string` above is the
> *declared prop-def type* as snapshotted on 2026-05-19, and it still reads that way — but the values
> Entu stores under it are **multi-valued and structured**, carrying `uid` / `provider` / `email`
> subfields. Entu's auth path resolves a person by `private.entu_user.uid` + `private.entu_user.provider`
> · **[SRC]** `entu-api routes/auth/index.get.js:155-161`, falls back to the legacy
> `private.entu_user.string` (the bare email) when that misses, and **migrates the old value in place on
> that login** — writing `{type:'entu_user', _id, uid, email, provider}` over the matched entry
> · **[SRC]** `:163-183`. The property is read with `.find()` over an array at `:171`, which is what
> establishes it as multi-valued.
>
> Two consequences for migration planning: (a) **no mvox-side Phase B op is owed for `entu_user`** —
> Entu owns both formats and the conversion; (b) the migration is **lazy, not swept** — it fires only
> when a session supplies both `id` and `provider` (`:173`), so legacy single-string values persist
> indefinitely for anyone who has not signed in since. Don't read "already migrated" as "uniformly
> migrated": expect both shapes live in the data at once, and query for both.
>
> (*MVOX:Bentham*)

#### `program_item` (4 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `edition` | reference | — | — | — |
| `name` | string | — | — | yes |
| `ordinal` | number | — | — | — |
| `work` | reference | — | — | yes |

#### `repertoire_item` (4 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `edition` | reference | — | — | — |
| `name` | string | — | — | yes |
| `ordinal` | number | — | — | — |
| `work` | reference | — | — | yes |

#### `role` (5 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `description` | text | — | — | — |
| `member_count` | number | `_referrer.member.name COUNT` | — | — |
| `name` | string | — | — | yes |
| `ordinal` | number | — | — | — |
| `permissions` | string | — | list | — |

#### `season` (3 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `name` | string | — | — | yes |
| `start_date` | date | — | — | yes |
| `work_count` | number | `_child.repertoire_item.name COUNT` | — | — |

#### `section` (4 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `member_count` | number | `_referrer.member.name COUNT` | — | — |
| `name` | string | — | — | yes |
| `ordinal` | number | — | — | yes |
| `voice_type` | string | — | — | yes |

#### `work` (8 props)
| Property | Type | Formula | List | Required |
|---|---|---|---|---|
| `arranger` | string | — | — | — |
| `composer` | string | — | — | — |
| `duration` | number | — | — | — |
| `edition_count` | number | `_child.edition.name COUNT` | — | — |
| `genre` | string | — | list | — |
| `language` | string | — | list | — |
| `name` | string | — | — | yes |
| `voicing` | string | — | — | — |

---

## 2. v4E Schema Inventory

Source: `~/projects/entu-research/docs/schema/v4E/schema.json` (version `v4E.0.1`). 19 entity types.

| Name | `sharing` | `inheritsRights` | Properties (names only) |
|---|---|---|---|
| `application` | private | true | `target_org`, `message`, `status`, `expires_at` |
| `attendance` | private | true | `member`, `status`, `notes` |
| `copy` | private | true | `name`, `copy_number`, `barcode`, `condition`, `notes` |
| `edition` | private | true | `name`, `external_link`, `work`\*, `edition_type`, `arranger`, `voicing`, `duration`, `language`, `publisher`, `year`, `license`, `acquired_at`, `source`, `cost`, `license_note`, `file` |
| `event` | public | true | `name`, `event_type`, `start_datetime`, `duration_minutes`, `location`, `description`, `capacity` |
| `event_series` | public | true | `name`, `event_type`, `interval_days`, `start_time`, `duration_minutes`, `start_date`, `end_date`, `default_location`, `default_description` |
| `invitation` | private | true | `email`, `sections`, `token`, `expires_at`, `inviter`, `message` |
| `lending` | private | true | `name`\*, `copy`, `member`, `assigned_at`, `assigned_until`, `returned_at`, `renewed_at`, `notes` |
| `library` | private | true | `name` |
| `member` | private | true | `person`, `current_section`, `status` |
| `organization` | public | **false** | `name`, `description`, `founded`, `location`, `website`, `logo`, `social_links`, `rsvp_lockout_hours`, `public_contact`, `member_count_per_section`\*, `_inheritrights`\* |
| `person` | public | true | `name`\*, `voice`, `bio`, `avatar`, `notes`, `preferred_contact_email`, `preferences`, `entu_user`, `email` |
| `program_item` | public | true | `name`\*, `edition`, `ordinal`, `notes` |
| `repertoire_item` | public | true | `name`\*, `work`, `edition`, `status` |
| `rsvp` | private | true | `event`, `member`, `status`, `notes` |
| `season` | public | true | `name`, `start_date`, `end_date`, `description` |
| `section` | public | true | `name`, `voice`, `description`, `display_order`, `member_count`\* |
| `voice` | public | true | `name`, `class`, `display_order`, `description` |
| `work` | private | true | `name`, `composer`, `catalog_id`, `catalog_system`, `original_voicing`, `original_duration`, `original_language`, `genre`, `part_of` |

\* = formula property

---

## 3. Side-by-Side Comparison

### 3.1 Entity type mapping

| v4E name | Polyphony name | Migration status |
|---|---|---|
| `application` | *(absent)* | **truly-missing** — Phase A: create |
| `attendance` | *(absent)* | **truly-missing** — Phase A: create |
| `copy` | `inventory_copy` | **rename-candidate** — Phase C: rename + data migrate |
| `edition` | `edition` | **exists-with-property-gaps** — Phase A: add 10 props; Phase B: no renames |
| `event` | `event` | **exists-with-property-gaps + renames** — Phase A: add props; Phase B: rename `date`→`start_datetime`, `start_time`/`end_time` model change |
| `event_series` | *(absent)* | **truly-missing** — Phase A: create |
| `invitation` | *(absent)* | **truly-missing** — Phase A: create |
| `lending` | *(absent, inline on `inventory_copy.assigned_to`)* | **truly-missing** — Phase A: create |
| `library` | *(absent)* | **truly-missing** — Phase A: create |
| `member` | `member` | **exists-with-property-gaps + renames** — Phase A: add props; Phase B: rename/remove; Phase C: restructure `role[]` |
| `organization` | `organization` | **exists-with-property-gaps + renames** — Phase A: add props; Phase B: rename; Phase D: flip `_inheritrights` |
| `person` | `person` | **exists-with-property-gaps + renames** — Phase A/B: rename `photo`→`avatar`, `forename`/`surname` merge |
| `program_item` | `program_item` | **exists-with-property-gaps** — Phase A: add `notes`; formula `name` needs fix |
| `repertoire_item` | `repertoire_item` | **exists-with-property-gaps** — Phase A: add `status`; Phase B: drop `ordinal` |
| `rsvp` | *(absent, inline on `participation.rsvp`)* | **truly-missing** — Phase A: create |
| `season` | `season` | **exists-with-property-gaps** — Phase A: add `end_date`, `description`; remove `work_count` formula |
| `section` | `section` | **exists-with-property-gaps + renames** — Phase A: add props; Phase B: rename `ordinal`→`display_order`, `voice_type`→`voice` (type change too) |
| `voice` | *(absent)* | **truly-missing** — Phase A: create |
| `work` | `work` | **exists-with-property-gaps + renames** — Phase A: add props; Phase B: rename `voicing`→`original_voicing`, `duration`→`original_duration`, `language`→`original_language`; remove `arranger` (moves to `edition`) |
| *(absent)* | `affiliation` | **polyphony-only** — Phase C: data migrate to `_parent` links; Phase D: retire |
| *(absent)* | `participation` | **polyphony-only** — Phase C: split into `rsvp` + `attendance`; Phase D: retire |
| *(absent)* | `role` | **polyphony-only** — Phase C: replace with rights grants; Phase D: retire |

### 3.2 Property-level gaps per existing type

#### `edition` — add 10 properties (Phase A)
| Add | Type | Notes |
|---|---|---|
| `external_link` | string (list) | IMSLP etc. |
| `work` | string (formula: `_parent`) | denormalization for `program_item.name` chain |
| `arranger` | string | moves from `work.arranger` |
| `voicing` | string | optional override |
| `duration` | number | optional override |
| `language` | string (list) | optional override |
| `acquired_at` | date | — |
| `source` | string | — |
| `cost` | number | — |
| `license_note` | text | — |

**No renames on `edition`.**

#### `event` — add 3 properties + rename/restructure datetime (Phase A + B)
| Action | Detail |
|---|---|
| Add `start_datetime` (datetime, required) | Phase A — new property |
| Add `duration_minutes` (number) | Phase A — new property |
| Add `description` (text) | Phase A — new property |
| Add `capacity` (number) | Phase A — new property |
| Rename `event_type` → `event_type` | no change — same name |
| Rename `date` + `start_time` + `end_time` → `start_datetime` | Phase B/C — data migrate: compute `start_datetime` from `date` + `start_time`; `duration_minutes` from `end_time - start_time`; then delete old props |
| Remove `season` (reference) | Phase C — structural parent relationship replaces inline ref |
| Remove `notes` | Phase B — v4E drops this property |

#### `member` — overhaul (Phase A + B + C)
| Action | Detail |
|---|---|
| Add `status` (string, required: `active\|archived`) | Phase A |
| Add `current_section` (reference) | Phase A |
| Remove `email` | Phase B — deferred to `person.preferred_contact_email` |
| Remove `invited_by` | Phase B — invitation lifecycle handles this |
| Remove `joined_at` | Phase B — not in v4E |
| Remove `nickname` | Phase B — not in v4E |
| Remove `role` (ref list) | Phase C — replace with rights grants on org/section entities |
| `name` property | Phase B — v4E has no computed name on member; remove or keep as-is |
| `section` (ref list) | Phase C — structural parent relationship replaces inline ref |
| `person` (reference, required) | exists — keep |

#### `organization` — add 8 properties + rename 2 + rights change (Phase A + B + D)
| Action | Detail |
|---|---|
| Add `founded` (date) | Phase A |
| Add `location` (string) | Phase A |
| Add `website` (string) | Phase A |
| Add `logo` (file) | Phase A |
| Add `social_links` (string, list) | Phase A |
| Add `public_contact` (reference to member, list) | Phase A |
| Add `rsvp_lockout_hours` (number) | Phase A |
| Add `member_count_per_section` (number, formula) | Phase A |
| Remove `contact_email` | Phase B — v4E uses `person.preferred_contact_email` |
| Remove `language` | Phase B — not in v4E (locale-level) |
| Remove `locale` | Phase B — not in v4E |
| Remove `org_type` | Phase B — not in v4E |
| Remove `timezone` | Phase B — not in v4E |
| Rename `member_count` formula | Phase B — existing formula wrong; replace with `member_count_per_section` formula |
| Flip `_inheritrights: false` | Phase D — on type entity + all 6 org instances |

#### `person` — renames + additions (Phase A + B)
| Action | Detail |
|---|---|
| `voice` (string list → reference list) | Phase B — prop already exists as `string` list; Phase B type-change on existing prop, same as `section.voice_type` → `section.voice`; requires Phase A `voice` entity type first |
| Add `bio` (text) | Phase A |
| Add `avatar` (file) — rename from `photo` | Phase B: rename property definition; data backfill |
| Add `preferred_contact_email` (string) | Phase A |
| Add `preferences` (text) | Phase A |
| Remove `forename`, `surname` → keep `name` formula | Phase B — v4E uses only `name`; existing formula `forename ' ' surname` kept; delete `forename`/`surname` props |
| Remove `address`, `birthdate`, `county`, `idcode`, `phone`, `postalcode`, `timezone`, `town`, `language`, `locale` | Phase B — not in v4E |
| Remove `entu_api_key`, `entu_passkey` | Phase B — system use; not in v4E spec |
| `entu_user` type | **No mvox action — corrected 2026-09-01.** Entu already stores the rich multi-valued credential form `{uid, provider, email}` and migrates old single-string values itself, lazily, on login · **[SRC]** `entu-api routes/auth/index.get.js:155-183`. See the correction note under §2 `person`. |
| `notes` — keep | exists and matches |

#### `program_item` — add `notes`, fix formula (Phase A + B)
| Action | Detail |
|---|---|
| Add `notes` (text) | Phase A |
| `name` formula | Phase B — currently no formula in DB (just `name` string); v4E wants `edition.*.work CONCAT`; add formula |
| Remove `work` (reference) | Phase B — v4E derives via `edition._parent`; `work` is redundant; data migrate if needed |

#### `repertoire_item` — add `status`, fix formula, drop `ordinal` (Phase A + B)
| Action | Detail |
|---|---|
| Add `status` (string) | Phase A |
| `name` formula | Phase B — currently no formula; v4E wants `work.*.name CONCAT`; add formula |
| Remove `ordinal` (number) | Phase B — not in v4E |

#### `season` — add 2 properties, remove 1 formula (Phase A + B)
| Action | Detail |
|---|---|
| Add `end_date` (date, required) | Phase A |
| Add `description` (text) | Phase A |
| Remove `work_count` (formula) | Phase B — not in v4E |

#### `section` — add 1 property + update formula + rename 2 (Phase A + B)
| Action | Detail |
|---|---|
| Add `description` (text) | Phase A |
| Update `member_count` formula (already exists) | Phase A — existing formula is `_referrer.member.name COUNT`; v4E wants `(_child.member COUNT) (_child.section.member_count SUM) +` (recursive roll-up); update formula expression on existing prop def |
| Rename `ordinal` → `display_order` | Phase B |
| Rename + retype `voice_type` (string) → `voice` (reference to `voice` entity) | Phase B — requires `voice` entity type (Phase A); data migrate string values to reference |

#### `work` — rename 3 + add 3 + remove 1 (Phase A + B)
| Action | Detail |
|---|---|
| Add `catalog_id` (string) | Phase A |
| Add `catalog_system` (string) | Phase A |
| Add `part_of` (reference: work) | Phase A |
| Rename `voicing` → `original_voicing` | Phase B |
| Rename `duration` → `original_duration` | Phase B |
| Rename `language` → `original_language` | Phase B — currently list; keep list |
| Remove `arranger` | Phase B — moves to `edition.arranger` |
| Remove `edition_count` (formula) | Phase B — not in v4E |

---

## 4. Phase A Scope (Refined)

### 4.1 New entity types to create (Phase A)

| # | Name | Key notes |
|---|---|---|
| 1 | `voice` | Global taxonomy; lives under db root. Unblocks `section.voice` and `person.voice` reference conversions in Phase B. |
| 2 | `library` | 1:1 with org; librarian subtree root. Parent: organization instance. |
| 3 | `copy` | Physical copy. Parent: edition. (Data migrate from `inventory_copy` in Phase C.) |
| 4 | `lending` | Loan record. Parent: library. (Phase C: migrate from `inventory_copy.assigned_to`.) |
| 5 | `invitation` | Onboarding consent (org side). Parent: organization. |
| 6 | `application` | Onboarding consent (person side). Parent: person. |
| 7 | `event_series` | Recurring pattern. Parent: organization (required) + season/section (optional). |
| 8 | `rsvp` | Member pre-event commitment. Parent: person. |
| 9 | `attendance` | Post-event record. Parent: event. |

Total: **9 new entity types** (not 18 — the plan over-counted).

### 4.2 New properties on existing types (Phase A)

Add these properties. Set `mandatory: false` initially for all (see open question §5.2 of handbook) — tighten to required after data backfill.

| Type | Property | Entu type | Formula | Notes |
|---|---|---|---|---|
| `edition` | `external_link` | string | — | list=true |
| `edition` | `work` | string | `_parent` | formula; denormalization |
| `edition` | `arranger` | string | — | moved from work |
| `edition` | `voicing` | string | — | override |
| `edition` | `duration` | number | — | override |
| `edition` | `language` | string | — | list=true, override |
| `edition` | `acquired_at` | date | — | — |
| `edition` | `source` | string | — | — |
| `edition` | `cost` | number | — | — |
| `edition` | `license_note` | text | — | — |
| `event` | `start_datetime` | datetime | — | required; Phase B: migrate from `date`+`start_time` |
| `event` | `duration_minutes` | number | — | Phase B: migrate from `end_time - start_time` |
| `event` | `description` | text | — | — |
| `event` | `capacity` | number | — | — |
| `member` | `status` | string | — | required: `active\|archived` |
| `member` | `current_section` | reference | — | — |
| `organization` | `founded` | date | — | — |
| `organization` | `location` | string | — | — |
| `organization` | `website` | string | — | — |
| `organization` | `logo` | file | — | — |
| `organization` | `social_links` | string | — | list=true |
| `organization` | `public_contact` | reference | — | list=true; ref to member |
| `organization` | `rsvp_lockout_hours` | number | — | — |
| `organization` | `member_count_per_section` | number | `SUM(_child section.member_count)` | formula |
| `person` | `bio` | text | — | — |
| `person` | `preferred_contact_email` | string | — | — |
| `person` | `preferences` | text | — | — |
| `program_item` | `notes` | text | — | — |
| `repertoire_item` | `status` | string | — | `learning\|active\|retired\|dropped` |
| `season` | `end_date` | date | — | required; add immediately |
| `season` | `description` | text | — | — |
| `section` | `description` | text | — | — |
| `work` | `catalog_id` | string | — | — |
| `work` | `catalog_system` | string | — | — |
| `work` | `part_of` | reference | — | self-referential |

Total: **35 property additions** on existing types.

**Phase A formula update (not a new property):** `section.member_count` already exists in polyphony (formula: `_referrer.member.name COUNT`). Phase A updates the formula expression to v4E's recursive form `(_child.member COUNT) (_child.section.member_count SUM) +`. This is a formula-definition edit, not a new property create.

### 4.3 Deferred to Phase B/C/D

| Item | Phase | Operation |
|---|---|---|
| `person.photo` → `person.avatar` | B | Rename + data backfill |
| `section.ordinal` → `section.display_order` | B | Rename + data backfill |
| `section.voice_type` (string) → `section.voice` (reference) | B | Requires Phase A `voice` type; rename + type change + data backfill |
| `work.voicing` → `work.original_voicing` | B | Rename + data backfill |
| `work.duration` → `work.original_duration` | B | Rename + data backfill |
| `work.language` → `work.original_language` | B | Rename + data backfill |
| `work.arranger` remove (migrated to `edition.arranger`) | B | Delete + data migrate |
| `person.forename`/`surname` → drop (keep formula `name`) | B | Delete props + data verify |
| Add `program_item.name` formula (`edition.*.work CONCAT`) | B | Update formula definition |
| Add `repertoire_item.name` formula (`work.*.name CONCAT`) | B | Update formula definition |
| Remove obsolete org props: `contact_email`, `language`, `locale`, `org_type`, `timezone` | B | Delete + data backfill |
| Remove obsolete member props: `email`, `invited_by`, `joined_at`, `nickname` | B | Delete |
| `member.role` (ref list) → rights grants | C | Data migrate role→rights; delete prop |
| `participation` → split into `rsvp` + `attendance` | C | Data migrate; retire `participation` |
| `inventory_copy` → `copy` + `lending` | C | Data migrate; retire `inventory_copy` |
| `affiliation` → structural `_parent` links | C | Data migrate; retire `affiliation` |
| `role` → rights grants | C | Data migrate; retire `role` |
| `organization._inheritrights` → false | D | Type entity + 6 org instances |
| `_sharing` per-type alignment | D | Bulk update all instances per type |
| Retire `_DEPRECATED_*` types | D | Final cleanup after C complete |

---

## 5. Field-Name Mapping: v4E Spec → Entu API

### 5.1 Entity-type level fields

| v4E `schema.json` field | Entu API payload field | Notes |
|---|---|---|
| `name` | `name` (string property) | Same |
| `blurb` | `label` (string property on type entity) | v4E's human description; Entu UI shows `label` |
| `sharing` | `_sharing` (string property on type entity) | Leading underscore; values `public`/`private`/`domain` |
| `inheritsRights` | `_inheritrights` (boolean property on type entity) | camelCase → snake_case with leading underscore |
| `parents` | n/a — handled at instance `_parent` at create time | `parents` in spec is declarative; Entu enforces via UI `add_from` / BFF |
| `parentConstraint` | n/a — BFF-enforced | No Entu API analog |
| `recursion` | n/a — BFF/UI convention | No Entu API analog |
| `creators` | n/a — rights + BFF logic | Not stored as a property |
| `roleMapping` | n/a — documentation only | Describes how `_owner`/`_editor` map to UX roles |
| `notes` | n/a — documentation only | No Entu equivalent |

### 5.2 Property-definition level fields

| v4E `schema.json` field | Entu API payload field | Notes |
|---|---|---|
| `name` | `name` (string property on prop entity) | Same |
| `type` | `type` (string property on prop entity) | Same; values differ slightly — see note |
| `required` | `mandatory` (boolean property on prop entity) | Name mismatch |
| `list` | `list` (boolean property on prop entity) | Same |
| `formula` | `formula` (string property on prop entity) | Same |
| `ref` | n/a | v4E notation for whether property is a reference; in Entu set `type: reference` instead |
| `sharing` | not a property on property definitions | Per-property sharing not a first-class Entu concept; `_sharing` lives on the entity, not individual properties |
| `system` | n/a | Documentation flag only; no Entu API equivalent |
| `note` | n/a | Documentation only; no Entu API equivalent |

### 5.3 Type value mapping

| v4E `type` value | Entu `type` value | Notes |
|---|---|---|
| `string` | `string` | Same |
| `text` | `text` | Same |
| `number` | `number` | Same |
| `date` | `date` | Same |
| `datetime` | `datetime` | Same |
| `file` | `file` | Same |
| `boolean` | `boolean` | Same |
| `oauth` | `string` | Entu stores oauth identities as string; no special `oauth` type |
| `voice` / `work` / `person` / *any entity name* | `reference` | v4E uses the target entity name; Entu uses `reference` with `reference_query` for filtering |

---

*(*MVOX:Finn*) — divergence audit 2026-05-19*
