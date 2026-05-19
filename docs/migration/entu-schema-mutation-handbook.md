# Entu Live Schema-Mutation Handbook
## Polyphony → v4E In-Place Migration

Status: living document. Created 2026-05-19 by Finn (mvox-dev). All operations live-tested against the polyphony db. Update as we execute migration phases and learn more.

Mirror: brilliant KB at `Resources/mvox/entu-schema-mutation-handbook` (entry ID TBD on first push).

---

## 1. Executive Summary

Entu's schema-mutation API is **fully programmable and uniform**: entity types and property definitions are themselves entities, created and modified through the same `POST /entity` + `DELETE /entity/{id}` endpoints used for application data. All 8 operation classes we need for the polyphony→v4E migration are supported via the API.

- **Adds are clean.** Creating new entity types and adding properties is immediate, no data migration.
- **Renames + type changes use additive (soft-delete) semantics.** POST with the existing property's `_id` replaces the value; the old value is archived.
- **`_inheritrights` and `_sharing` are per-entity properties.** Changing them on a type entity affects that type entity only — not instances (see §1.5). Retroactive updates to instance entities require a separate per-entity update pass.
- **Deletes return `{deleted: true}` immediately** (Entu soft-deletes internally, presents hard-delete to callers). **Cascade confirmed (session-6 probe):** deleting an entity type leaves data instances alive as silent orphans — not queryable by type, but readable by `_id`. Safer to rename to `_DEPRECATED_*` than delete with live instance data.
- **No special admin role required** beyond `_owner` on the database entity. The PO's API key has sufficient rights.

---

## 1.5 Conceptual Model: What Propagates, What Doesn't

This is the mental model that governs everything in this handbook. Entu has exactly two propagation mechanics; everything else is an instance's own materialized state.

| Mechanic | What it does |
|---|---|
| **Type → instance** | Nothing at runtime. An entity type is a template and UI hint. System properties set on the type entity (including `_sharing`, `_inheritrights`, `_owner`) belong to the type entity itself — they do not flow into instances at create time or afterward. If a creating client (Entu admin UI, migration script, BFF) copies type-level properties onto new instances, that is a creating-client convention, not an Entu runtime mechanic. |
| **Parent → child (rights cascade)** | Rights propagate via `_inheritrights`. When a child entity has `_inheritrights: true`, it inherits `_owner` / `_editor` / `_viewer` from its `_parent`. This is Entu's real cascade mechanic — and it is parent-child, not type-instance. |
| **Formula re-aggregation** | Formula values are materialized at save time on the bearing entity. Changing a formula expression on a property-definition entity does not retroactively update existing instance entities. Each instance must be touched (re-saved) to recompute its formula output. Internal Entu server routines may re-aggregate server-side outside our scope, but there is no API endpoint to trigger this. |
| **`_sharing` specifically** | Lives only on the bearing entity. No mechanic propagates it — not type→instance, not parent→child. Each entity carries its own. |

**Concrete examples:**

- `organization` entity type has `_sharing: domain`. This means the type-definition entity itself is domain-visible. The six `organization` data instances have their own `_sharing` (currently `domain` per probe). Setting the type entity's `_sharing` to `public` would make the type definition page public — it has no effect on existing or future organization instances.
- `_inheritrights: false` on the `organization` type entity controls the type entity's own rights inheritance from the db entity. The six existing org instances each have their own `_inheritrights` value, set when they were created. To flip them, update each instance individually.
- A formula on `edition.work` is materialized the next time each `edition` entity is saved. Adding or modifying the formula on the property-definition entity has no immediate effect on existing `edition` instances.

**Why this matters for migration:** Every Phase D rights change (flip `organization._inheritrights`, set per-type `_sharing`) requires a separate per-instance update pass. There is no "change the type and have it cascade." This is not a limitation — it is the design. Instance state is authoritative and immutable except by explicit API write.

---

## 2. The Schema Mutation API

### Base URL
```
https://api.entu.app/polyphony/
```

(Subdomain form — NOT `entu.app/api/{db}/`, which is retired.)

### Auth
```bash
# Exchange API key for 48h JWT (IP-bound)
JWT=$(curl -s -H "Authorization: Bearer ${ENTU_API_KEY}" \
  "https://api.entu.app/auth?db=polyphony" | jq -r '.token')
```

JWT is IP-bound (48h). Automated migration scripts must run from a stable IP or regenerate the JWT between runs.

---

### 2.1 Create entity type

Entity types are entities of type `entity` (meta-type ID `69bcfd8e9c031ab8e6ce8034`), parented under the database entity (`69bcfd8e9c031ab8e6ce807a`).

**Endpoint:** `POST /polyphony/entity`

**Required fields:**
- `_type` → reference to entity meta-type (`69bcfd8e9c031ab8e6ce8034`)
- `_parent` → reference to database entity (`69bcfd8e9c031ab8e6ce807a`)
- `name` → string, internal API identifier (lowercase, underscores)
- `label` → string, display name in UI

**Optional fields:** `label_plural` (string), `description` (text), `add_from` (reference), `default_parent` (reference), `plugin` (reference list)

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity" \
  -d '[
    {"type": "_type", "reference": "69bcfd8e9c031ab8e6ce8034"},
    {"type": "_parent", "reference": "69bcfd8e9c031ab8e6ce807a"},
    {"type": "name", "string": "voice"},
    {"type": "label", "string": "Voice"}
  ]'
# Returns: {"_id": "<new-entity-type-id>", "properties": [...]}
```

Entu auto-adds `_sharing: domain`, `_inheritrights: true`, `_owner`, `_created` on creation.

**`_sharing` on the type entity** controls the type entity's own visibility (see §1.5). Each instance owns its own `_sharing`. Creating clients (BFF, admin UI, migration scripts) must set `_sharing` explicitly at create time per the v4E spec for that entity type.

**Doc ref:** https://entu.ee/configuration/entity-types

---

### 2.2 Add property to existing entity type

Property definitions are entities of type `property` (meta-type ID `69bcfd8e9c031ab8e6ce8048`), parented under the entity type entity.

**Endpoint:** `POST /polyphony/entity`

**Required fields on property entity:**
- `_type` → reference to property meta-type (`69bcfd8e9c031ab8e6ce8048`)
- `_parent` → reference to the entity type being extended
- `name` → string, API property identifier (letters/digits/underscores only)
- `label` → string (mandatory per property meta-type schema)
- `type` → string, from the type catalog below

**Property type catalog** (verified from polyphony property meta-type):

| Type | Description |
|---|---|
| `string` | Single-line text; renders as dropdown if `set` defined |
| `text` | Multi-line; `markdown: true` enables formatting |
| `number` | Numeric; `decimals` controls precision |
| `boolean` | Toggle |
| `date` | Date only (no time) |
| `datetime` | Full timestamp |
| `file` | S3-backed binary attachment |
| `reference` | Link to another entity; `reference_query` for filtering |
| `counter` | Auto-generated sequential code (read-only) |

**Optional property fields:** `ordinal`, `group`, `hidden`, `readonly`, `mandatory`, `list` (boolean), `multilingual`, `formula`, `default`, `search`, `table`, `markdown`, `decimals`, `uniqueness`, `set` (list), `plugin` (ref list), `reference_query`

```bash
# Add 'end_date' (required date) to season entity type
curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity" \
  -d '[
    {"type": "_type", "reference": "69bcfd8e9c031ab8e6ce8048"},
    {"type": "_parent", "reference": "69c7ea528489bfcb0e81a044"},
    {"type": "name", "string": "end_date"},
    {"type": "label", "string": "End date"},
    {"type": "type", "string": "date"},
    {"type": "mandatory", "boolean": true}
  ]'
```

**Doc refs:** https://entu.ee/configuration/entity-types, https://entu.ee/overview/properties

---

### 2.3 Rename a property (or entity type)

Entu uses additive/soft-delete for all mutations. There is no in-place rename. Pattern:

1. Find the current `name` property's `_id` on the property entity (or entity type entity).
2. POST with that `_id` and the new string value — Entu soft-deletes the old value and creates a new one.
3. The property is immediately renamed in the API (new queries use the new name).

**Important:** Existing entity *data* stored under the old property name is NOT automatically migrated. All existing `person.forename` values continue to exist as `forename` properties on person entities — they don't become `name` properties automatically. Data backfill is a separate step (see §3.3).

```bash
PROPERTY_ENTITY_ID="<the-property-definition-entity-id>"
CURRENT_NAME_PROP_ID="<the-_id-of-the-name-property-value>"

curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${PROPERTY_ENTITY_ID}" \
  -d '[{"_id": "'${CURRENT_NAME_PROP_ID}'", "type": "name", "string": "new_name"}]'
```

**Verified:** Works immediately. Old value soft-deleted.

---

### 2.4 Change property type

Same additive pattern as rename.

```bash
PROPERTY_ENTITY_ID="<property-definition-entity-id>"
CURRENT_TYPE_PROP_ID="<_id-of-the-type-property-value>"

curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${PROPERTY_ENTITY_ID}" \
  -d '[{"_id": "'${CURRENT_TYPE_PROP_ID}'", "type": "type", "string": "reference"}]'
```

**Warning:** Changing the type of a property definition does NOT cast existing data values. If `section.voice_type` was stored as `string` and you change the property definition to `reference`, existing string values remain as string properties on all section entities. They will not display correctly in the UI and will not be queryable as references. Data migration (DELETE old values + POST new reference values) is required.

**Verified:** Works immediately.

---

### 2.5 Modify a formula expression

Same additive pattern.

```bash
# If formula doesn't exist yet: add it
curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${PROPERTY_ENTITY_ID}" \
  -d '[{"type": "formula", "string": "work.*.name CONCAT"}]'

# If formula exists: overwrite by _id
curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${PROPERTY_ENTITY_ID}" \
  -d '[{"_id": "'${FORMULA_PROP_ID}'", "type": "formula", "string": "new_expression"}]'
```

Formulas use Reverse Polish Notation: `field1 field2 FUNCTION`. Cross-entity: `ref.*.prop`, `_child.typeName.prop`, `_referrer.typeName.prop`. Functions: CONCAT, CONCAT_WS, SUM, COUNT, AVERAGE, MIN, MAX, SUBTRACT, MULTIPLY, DIVIDE, ROUND, ABS. Evaluated on every save + manual re-aggregation endpoint (not documented publicly — see open question §5.1).

**Note:** When you set `type: string` and add `formula: "..."`, the property becomes computed/read-only. The UI will not show an edit field. Changing an existing writable property to formula means existing user-entered values will coexist with the formula output (formula overrides for display; old values remain).

---

### 2.6 Change rights defaults

**`_inheritrights`** is a per-entity property. On any entity (type entity or instance entity), it controls whether *that entity* inherits rights from its `_parent`.

- On the `organization` **type entity**: controls the type entity's own rights inheritance from the db entity.
- On an `organization` **instance entity**: controls that org's rights inheritance from its parent (the db entity). This is the load-bearing value for access control on actual data.

The Entu admin UI may copy `_inheritrights` from the type entity onto new instances at create time as a convention, but that is a creating-client behavior, not an Entu runtime cascade. Changing `_inheritrights` on the type entity has no retroactive effect on existing instances.

```bash
ORG_TYPE_ID="69c7ea478489bfcb0e819e3d"
CURRENT_INHRIGHTS_ID="69c7ea478489bfcb0e819e41"  # current value: true

curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${ORG_TYPE_ID}" \
  -d '[{"_id": "'${CURRENT_INHRIGHTS_ID}'", "type": "_inheritrights", "boolean": false}]'
```

**Verified:** Tested live on season entity type (true → false → true). Works immediately on the type entity.

**Phase D implication:** To make the 6 existing org instances rights-isolated, update each instance entity individually — not the type entity. With 6 orgs this is manageable, but must be done as a separate step.

**`_sharing`** on an entity type entity: same pattern — sets the type entity's own sharing. Each instance owns its own `_sharing` (see §1.5). Migration scripts must set `_sharing` explicitly on each new instance at create time. Polyphony db currently has `domain` on all instance entities; v4E specifies per-type defaults — bulk update required for Phase D.

---

### 2.7 Delete entity types / properties

**Delete an entity type definition:**
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer ${JWT}" \
  "https://api.entu.app/polyphony/entity/{entity-type-id}"
# Returns: {"deleted": true}
```

**Delete a property definition entity:**
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer ${JWT}" \
  "https://api.entu.app/polyphony/entity/{property-entity-id}"
```

**Delete a single property value on a data entity:**
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer ${JWT}" \
  "https://api.entu.app/polyphony/property/{property-value-id}"
```

**Verified:** All three DELETE forms tested. Entity becomes 404 immediately. Entu uses soft-delete internally (`deleted.at`/`deleted.by` markers in MongoDB) but the API presents hard-delete semantics to callers.

**Critical unknown — cascade behaviour:** What happens to data entities of a deleted type? Docs are silent. If you delete the `role` entity type definition, the 116+ role instances may become orphaned. **Safe assumption: do NOT delete entity type definitions while data entities of that type exist. Retire by renaming to `_DEPRECATED_role`, not by deleting.**

**Restriction:** Cannot DELETE `_type` property or the last `_owner` property.

---

### 2.8 Auth and rights for schema operations

- No special admin role or service account required. Schema entities (entity types, property definitions) are ordinary entities owned by whoever created them (+ the database entity).
- The polyphony db entity (`69bcfd8e9c031ab8e6ce807a`) is owned by Mihkel Putrinš + the polyphony database itself. The PO's API key has sufficient rights for all schema mutations.
- JWT is IP-bound (48h).
- The `ENTU_API_KEY` in `~/.config/mvox/credentials.env` is long-lived and will survive the migration.

---

## 3. Per-Operation Feasibility

| Operation | Rating | Notes |
|---|---|---|
| Add new entity type | **Easy** | Single POST, immediate |
| Add property to existing entity type | **Easy** | Single POST, immediate |
| Rename a property (definition) | **Easy** | POST with existing `_id`, immediate |
| Rename an entity type | **Easy** | POST with existing name `_id`, immediate |
| Change property type (definition) | **Easy** | Immediate — but requires separate data migration |
| Modify a formula expression | **Easy** | POST with/without existing `_id` |
| Change `_inheritrights` on entity type | **Easy** | Immediate — but NOT retroactive on existing instances |
| Change `_sharing` on entity type | **Easy** | Same — not retroactive |
| Backfill data under new property name | **Awkward** | Must read all entities of type, DELETE old values, POST new values one-by-one (no bulk API confirmed §5.5) |
| Retroactively fix `_inheritrights` on existing entities | **Awkward** | Must update each entity individually (6 orgs = manageable) |
| Delete entity types with live data | **Workaround needed** | Cascade confirmed (§5.4): instances become silent orphans, not auto-deleted. Rename to `_DEPRECATED_*` instead. |
| Bulk re-aggregation of formula outputs | **Not possible via API** | No bulk endpoint found (§5.1). Per-save only. Ask Argo whether internal/admin endpoint exists. |
| Rename entity type (name field) | **Easy** | Transparent to instances — no data migration. ~1s async propagation of string cache (§5.3). |

---

## 4. Migration Phase Mapping

### Phase A — Additive (low risk)
**Operations:** Add entity type (×9), add property to existing entity type (×many)

New entity types: `voice`, `library`, `copy`, `lending`, `invitation`, `application`, `event_series`, `rsvp`, `attendance`

New properties: per the divergence report — `organization.{founded, location, website, logo, rsvp_lockout_hours, ...}`, `season.{end_date, description}`, `event.{capacity, start_datetime, duration_minutes, description}`, `edition.{external_link, work [formula], arranger, ...}`, etc.

**Risk:** None — additive only. Existing data unaffected. Existing API callers unaffected.

**Unknown:** Whether adding `mandatory: true` retroactively flags existing entities as invalid in the UI (see open question §5.2).

---

### Phase B — Renames
**Operations:** Rename property definition (×many) + data backfill for each rename

Key renames:
- `section.voice_type` (string) → `section.voice` (reference to `voice` entity type, after Phase A creates `voice` type)
- `section.ordinal` → `section.display_order`
- `work.voicing` → `work.original_voicing`
- `work.duration` → `work.original_duration`
- `work.language` → `work.original_language`
- `person.photo` → `person.avatar`

**Risk:** Medium. Each rename requires a data backfill pass. All 116 members, 6 orgs, existing works/editions/events need property value migration. `section.voice_type` → `section.voice` involves a type change too (string → reference), which requires creating voice entities first (Phase A) then pointing references to them.

**Script pattern per rename:**
```bash
# For each entity of the type:
# 1. GET entity, find old property value _id
# 2. DELETE /polyphony/property/{old-value-id}
# 3. POST /polyphony/entity/{entity-id} with new property name + same value
```

---

### Phase C — Structural restructurings
**Operations:** Create new entity types (from Phase A), data migration scripts to transform existing data structures

Key restructurings:
- `participation` → split into `rsvp` + `attendance` (two new entity types)
- `inventory_copy` → `copy` (rename entity type, migrate data; `assigned_to` inline field becomes a separate `lending` entity)
- `affiliation` → replaced by structural parent-child relationships (data migration: convert affiliation entities to `_parent` links)
- `role` → replaced by rights grants (`_owner`/`_editor` etc. on relevant entities)
- `member.role` (inline ref list) → rights grants on org/section entities
- `event` datetime split (`date` + `start_time` + `end_time`) → `start_datetime` + `duration_minutes`

**Risk:** High. Old entity types (`affiliation`, `participation`, `inventory_copy`, `role`) should remain until new structures are fully populated — then retire (rename to `_DEPRECATED_*`).

---

### Phase D — Rights + cleanup
**Operations:** Change `_inheritrights` on entity type + update existing entity instances, change `_sharing` on entity types, retire deprecated entity types

Key changes:
- `organization._inheritrights`: flip entity type to `false` + update each of the 6 existing org entities
- `_sharing` per type: set `member` → `private`, `organization` → `public`, etc.
- Retire `affiliation`, `participation`, `inventory_copy`, `role` (rename to `_DEPRECATED_*` once data is migrated)

**Risk:** High. Retroactive rights changes require per-entity updates. A bug here could lock members out or expose private data. Verify after each org.

---

## 5. Open Questions — Status after session-6 probing (2026-05-19)

Questions 1, 3, 4, 5, 6 resolved by live probing. Question 2 still open.

---

### 5.1 Formula re-aggregation — RESOLVED

**Answer: Formula values are materialized at save time. Changing a formula expression on the property-definition entity does not retroactively update existing instances. Touch-save each instance to refresh.**

Live probe results (`_probe_formula`, 3 instances, formula expression changed):

| Observation | Result |
|---|---|
| GET instances immediately after formula-definition change (no re-save) | `computed` still shows old materialized value. No automatic recompute. |
| Re-save one instance (touch any field) | `computed` updates immediately on that instance only. Other instances remain at their previous materialized value. |

This is the expected behavior per §1.5: instance state is owned by the instance, not the type. Internal Entu maintenance routines may re-aggregate server-side but that is outside our scope as API consumers. No API endpoint exists to trigger bulk re-aggregation (`/recalculate`, `/reindex`, etc. all return 404).

**Operational implication for Phase A+B:** Adding `edition.work` as a new formula property has no backfill concern — there are no pre-existing materialized values. Modifying an existing formula property requires a touch-save pass over every instance of that type. Script pattern: GET all instances, POST a no-op field touch to each, verify `computed` updated. Cost at 50ms/call: proportional to instance count.

---

### 5.2 `mandatory: true` retroactivity — STILL OPEN

Not probed in this session. Still needs PO/Argo answer before Phase A. (Low urgency — we can set `mandatory: false` initially and tighten later.)

---

### 5.3 `_type` rename impact — RESOLVED

**Answer: Rename is transparent for existing instances — no data migration needed. But: propagation is async (~1 second lag).**

Live probe results (`_probe_renamea` → `_probe_renameb`, 3 instances):

| Observation | Result |
|---|---|
| Obs 1: GET instance immediately after rename | `_type[0].string` still shows OLD name `_probe_renamea`. (Propagation lag.) |
| Obs 1 re-check after ~1–3 seconds | `_type[0].string` updated to `_probe_renameb`. Reference (`_type[0].reference`) never changed. |
| Obs 2: Query `?_type.string=_probe_renameb` | Returns the 3 instances (after propagation). |
| Obs 3: Query `?_type.string=_probe_renamea` | Returns the 3 instances immediately after rename (stale), then returns 0 after propagation. |
| Query by `_type.reference=<type-entity-id>` | Always returns the 3 instances — instant, never affected by rename. |

**Operational implication:** Entity type renames (`inventory_copy` → `copy`) require no data migration. All existing instances are found via the type entity's `_id` reference, which never changes. The string denormalization in `_type[0].string` is an Entu-managed cache that auto-updates within ~1 second. **Safe to use `?_type.reference=<id>` queries in migration scripts** to avoid race conditions.

---

### 5.4 Cascade on entity type delete — RESOLVED

**Answer: Instances survive type deletion as orphans. They are queryable (with known `_id`), editable, and deletable. But they are invisible to `?_type.string=` and `?_type.reference=` queries. Cleaning them up requires knowing their `_id` values in advance.**

Live probe results (`_probe_canary` type deleted, 1 instance):

| Observation | Result |
|---|---|
| GET instance after type delete | Returns 200 with full entity body. `_type[0]` reference value is preserved (pointing to deleted type) and `string` still shows `_probe_canary`. |
| Query `?_type.reference=<deleted-type-id>` | Returns 0 results — orphans are invisible to type queries. |
| Query `?_type.string=_probe_canary` | Returns 0 results — invisible. |
| POST to orphaned instance | Succeeds (HTTP 200). Instance is editable. |
| DELETE orphaned instance | Returns `{"deleted": true}`. Instance is deletable. |

**Operational implication:** If we ever DELETE an entity type definition with live data, the data entities become silent orphans — not queryable by type, but not auto-deleted. They persist forever unless explicitly cleaned up by `_id`. **Confirmed: never DELETE entity type definitions with live data. Rename to `_DEPRECATED_*` instead.** The safe-by-default recommendation in §2.7 is correct.

---

### 5.5 Bulk property-value delete API — RESOLVED

**Answer: Only one bulk form works: `DELETE /property/{id1},{id2}` returns HTTP 500 Server Error (route exists but fails). No working bulk delete endpoint found.**

Live probe results (5 forms tested against fresh property value IDs):

| Form | HTTP Status | Notes |
|---|---|---|
| `DELETE /property?ids=<id1>,<id2>` (query-string list) | 404 | Route not found |
| `DELETE /property` with JSON body `{"ids": [...]}` | 404 | Route not found |
| `DELETE /property/<id1>,<id2>` (path comma) | 500 Server Error | Route exists but fails — data NOT deleted |
| `DELETE /properties` (plural) | 404 | Route not found |
| `POST /entity/{id}` with `[{"_id": "<prop-id>", "deleted": true}]` | 400 "Property type not set" | Pattern rejected — `type` field required |

**Operational implication for Phase B/C/D:** There is no bulk property delete. All property value deletions are strictly **one-by-one** via `DELETE /polyphony/property/{id}`. For ~104k property values across the migration, serial deletion will be slow. Migration scripts must be designed with:
- Checkpointing (save progress to disk every N deletions)
- Error handling (individual 404/500 retries without re-doing completed deletions)
- Realistic time estimates (at 50ms/call: 104k × 50ms ≈ 87 minutes for a full property backfill pass)

This is a strong argument for asking Argo Roots whether a bulk endpoint exists outside the public API surface.

---

### 5.6 `_sharing` enum values — RESOLVED

**Answer: `public` = unauthenticated (anyone on internet). `domain` and `private` are identical from the API perspective — both 403 to unauthenticated requests. No `/public/entity/` API path exists.**

Live probe results (explicit `_sharing` set on 3 instances at creation time — each entity owns its own `_sharing` per §1.5):

| Instance `_sharing` | GET with valid JWT | GET with no `Authorization` header | GET via `/public/entity/{id}` |
|---|---|---|---|
| `public` | 200 ✓ | 200 ✓ (entity data visible) | 404 (path doesn't exist) |
| `private` | 200 ✓ | 403 `"No accessible properties"` | 404 |
| `domain` | 200 ✓ | 403 `"No accessible properties"` | 404 |

**Key findings:**
1. `public` = true unauthenticated access. Entity and all properties returned without `Authorization` header.
2. `domain` and `private` are **identical** from the API access perspective — both block unauthenticated requests. The distinction, if any, is not observable via the API (may be a UI-layer concept in Entu).
3. No `/public/entity/` API path. Public entities served at the standard `/entity/{id}` endpoint, without auth.

**Operational implication for Phase D:** Creating clients (BFF, migration scripts) must set `_sharing` explicitly on each entity instance at create time per the v4E spec for that type. Setting `_sharing: public` on `organization` and `section` instances will make them readable by unauthenticated HTTP clients (federation discoverability). v4E's `public` = Entu `public`; v4E's `private` = Entu `private` or `domain` (functionally identical via API).

**Doc gap (§6 row 5):** `domain` vs `private` distinction undocumented and not observable via API.

---

## 6. Documentation Gaps Found

(Pending PO + team-lead review before filing as Entu doc-improvement issues.)

| # | Title | URL | Issue | Status |
|---|---|---|---|---|
| 1 | API reference at `api.entu.app/docs` empty | https://api.entu.app/docs | Page returns title header only — no actual API endpoint documentation rendered. Empty page or rendering failure. | Unresolved |
| 2 | Entity type modification absent from docs | https://entu.ee/configuration/entity-types | Docs cover creating entity types via UI + adding property definitions, but say nothing about modifying or deleting existing entity types. No mention of the API endpoint (`POST /entity/{id}` overwrite pattern) for schema mutation. | Unresolved |
| 3 | `_inheritrights` retroactivity not documented | https://entu.ee/configuration/entity-types | No mention that `_inheritrights` on a type entity does NOT retroactively affect existing instance entities. Each instance owns its own `_inheritrights`. Critical operational gotcha. | Unresolved |
| 4 | `_sharing` enum values + `domain` meaning | https://entu.ee/overview/ (rights section) | `domain` and `private` are identical from the API access perspective (both 403 unauthenticated). The distinction, if any, is not observable via the API. Docs should clarify. | Confirmed gap via session-6 probe. |
| 5 | Cascade behaviour on entity type delete | https://entu.ee/configuration/entity-types | Deleting an entity type definition leaves all data instances alive as silent orphans — not queryable by `_type`, but readable/editable/deletable by `_id`. Serious data management hazard not mentioned anywhere in docs. | Confirmed gap via session-6 probe. High priority. |
| 6 | Auth docs silent on service accounts / admin scope | https://entu.ee/api/authentication | No mention of which rights level is needed for schema mutations, whether there's an admin role, or how to scope API keys. | Unresolved |
| 7 | Old API base URL still referenced | https://entu.ee/api/quickstart | Brilliant KB `Teams/entu` confirms `https://entu.app/api/{db}/` was retired (404) as of 2026-04-20. Docs still show this old pattern — will confuse new developers. | Unresolved |
| 8 | No `/public/entity/` API path | https://entu.ee/api/ | `/polyphony/public/entity/{id}` returns 404. Public entities are served at the standard `/entity/{id}` endpoint without auth. Docs should clarify. | Confirmed gap via session-6 probe. |
| 9 | Conceptual model — what propagates between entities not stated anywhere | https://entu.ee/overview/ | The two propagation mechanics (rights cascade via parent-child `_inheritrights`; formula materialization at save time) and what does NOT propagate (type→instance system properties, `_sharing`) are not stated in any single place in Entu's docs. This is the most-asked conceptual question and the source of repeated operational errors. PO to pursue as goodwill docs PR after handbook stabilizes. | New — surfaced in session-6 debrief. §1.5 of this handbook is the draft text. |

Repo for docs issues: likely `entu/www` (Entu's docs site source). Verify before filing.

---

## 7. Related Brilliant Entries

| ID | Title | Logical path |
|---|---|---|
| `4dd3f891-c473-4b41-9f23-86902ae9dbea` | Entu — entity-property database platform | `Teams/entu` |
| `521af3a8-1336-48fa-91a4-82675bce59a1` | entu-research — POC to rebuild Polyphony on Entu | `Projects/entu-research` |
| `96603bda-188a-4ad4-a1c5-188fa6a838dc` | polyphony — Choral music sharing platform | `Projects/polyphony` |
| `c5db2dcc-e49c-4333-b334-c312d37f4307` | entu-research team — Polyphony rewrite on Entu | `Teams/ai-teams/entu-research` |
| `4bce27ac-db51-463e-95bf-7591e8b5f667` | Decision: v4E schema ownership — schema-as-contract | `Decisions/mvox/schema-as-contract` |
| `2a1e452e-5ca3-4e66-87a8-4a2d4c0acb82` | Decision: polyphony db is pre-v4E — migrate in-place | `Decisions/mvox/polyphony-v4e-divergence` |

---

*(*MVOX:Finn*) — research, with team-lead persisting.*
