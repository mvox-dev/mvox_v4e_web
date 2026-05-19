# Entu Live Schema-Mutation Handbook
## Polyphony → v4E In-Place Migration

Status: living document. Created 2026-05-19 by Finn (mvox-dev). All operations live-tested against the polyphony db. Update as we execute migration phases and learn more.

Mirror: brilliant KB at `Resources/mvox/entu-schema-mutation-handbook` (entry ID TBD on first push).

---

## 1. Executive Summary

Entu's schema-mutation API is **fully programmable and uniform**: entity types and property definitions are themselves entities, created and modified through the same `POST /entity` + `DELETE /entity/{id}` endpoints used for application data. All 8 operation classes we need for the polyphony→v4E migration are supported via the API.

- **Adds are clean.** Creating new entity types and adding properties is immediate, no data migration.
- **Renames + type changes use additive (soft-delete) semantics.** POST with the existing property's `_id` replaces the value; the old value is archived.
- **Rights changes (`_inheritrights`, `_sharing`) are mutable on entity type definitions.** Changes take effect immediately for *new* entities; retroactive effect on existing entities requires a separate per-entity update pass.
- **Deletes return `{deleted: true}` immediately** (Entu soft-deletes internally, presents hard-delete to callers). **Cascade behavior on entity type delete is undocumented** — safer to rename to `_DEPRECATED_*` than delete with live instance data.
- **No special admin role required** beyond `_owner` on the database entity. The PO's API key has sufficient rights.

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

**`_inheritrights`** on an entity type entity controls whether new instances of that type inherit their parent's rights.

```bash
ORG_TYPE_ID="69c7ea478489bfcb0e819e3d"
CURRENT_INHRIGHTS_ID="69c7ea478489bfcb0e819e41"  # current value: true

curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  "https://api.entu.app/polyphony/entity/${ORG_TYPE_ID}" \
  -d '[{"_id": "'${CURRENT_INHRIGHTS_ID}'", "type": "_inheritrights", "boolean": false}]'
```

**Verified:** Tested live on season entity type (true → false → true). Works immediately.

**Critical caveat:** Changing `_inheritrights` on the entity type definition applies **only to new instances**. Existing organization entities have `_inheritrights: true` set on each entity (inherited at creation time). Each existing org entity will need an individual update. With 6 orgs, this is a small step — but it must be done separately for each.

**`_sharing`** on the entity type: same pattern. Polyphony db currently uses `domain` for all types; v4E specifies `public`/`private`/`domain` per type. Changing the entity type's `_sharing` does NOT cascade to existing entities — bulk update required.

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
| Backfill data under new property name | **Awkward** | Must read all entities of type, DELETE old values, POST new values one-by-one (no bulk API) |
| Retroactively fix `_inheritrights` on existing entities | **Awkward** | Must update each entity individually (6 orgs = manageable) |
| Delete entity types with live data | **Workaround needed** | Cascade unclear — rename to `_DEPRECATED_*` instead |
| Bulk re-aggregation of formula outputs | **Unknown** | No documented public endpoint; may require Entu team assistance |

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

## 5. Open Questions for PO (session 5 morning)

1. **Formula re-aggregation:** After changing a formula expression on a property definition, do existing entities automatically recompute, or is there a manual trigger? The docs mention "manual re-aggregation endpoint" but don't document it publicly. Argo Roots likely knows. Worth asking before Phase A.

2. **`mandatory: true` retroactivity:** If we add `end_date` to `season` with `mandatory: true`, does the UI flag existing seasons (which don't have `end_date`) as invalid? Or does mandatory only enforce on new creates? Affects whether we set mandatory from day-1 of Phase A or only after backfill.

3. **`_type` rename impact:** Does renaming an entity type's `name` field (e.g., `inventory_copy` → `copy`) require updating all existing `_type` properties on instance entities, or does Entu resolve by entity ID (the reference value), making the name change transparent? If by ID — rename is free. If by string value — data migration needed for every instance entity.

4. **Cascade on entity type delete:** Confirm with Argo before deleting any entity type.

5. **Bulk delete API:** Is there a way to delete multiple property values in one call, or must it be one-by-one? With ~104k properties in the db, some phases could be slow if strictly serial.

6. **`_sharing` enum values:** The DB uses `domain` for all types. v4E specifies `public` and `private`. Is `public` in Entu the same as v4E's `public`? Docs warn: "Setting `_sharing: public` makes the entity visible to anyone on the internet without authentication." Does `domain` mean "visible within the Entu database domain (authenticated users only)"? Need to confirm mapping before Phase D.

---

## 6. Documentation Gaps Found

(Pending PO + team-lead review before filing as Entu doc-improvement issues.)

| # | Title | URL | Issue |
|---|---|---|---|
| 1 | API reference at `api.entu.app/docs` empty | https://api.entu.app/docs | Page returns title header only — no actual API endpoint documentation rendered. Empty page or rendering failure. |
| 2 | Entity type modification absent from docs | https://entu.ee/configuration/entity-types | Docs cover creating entity types via UI + adding property definitions, but say nothing about modifying or deleting existing entity types. No mention of the API endpoint (`POST /entity/{id}` overwrite pattern) for schema mutation. |
| 3 | `_inheritrights` retroactivity not documented | https://entu.ee/configuration/entity-types | No mention that changing `_inheritrights` on an entity type definition does NOT retroactively update existing instance entities. Critical operational gotcha. |
| 4 | Formula re-aggregation endpoint undocumented | https://entu.ee/overview/ (formulas section) | Docs say formulas "recalculate on every save" but don't document how to trigger bulk re-aggregation after a formula definition change. Endpoint presumably exists (admin UI must use it). |
| 5 | `_sharing` enum values + `domain` meaning | https://entu.ee/overview/ (rights section) | Docs mention `public` and imply `private`, but the `domain` value (which the DB uses) is not explained. |
| 6 | Cascade behaviour on entity type delete | https://entu.ee/configuration/entity-types | No documentation of what happens to instance entities when their entity type definition is deleted. |
| 7 | Auth docs silent on service accounts / admin scope | https://entu.ee/api/authentication | No mention of which rights level is needed for schema mutations, whether there's an admin role, or how to scope API keys. |
| 8 | Old API base URL still referenced | https://entu.ee/api/quickstart | Brilliant KB `Teams/entu` confirms `https://entu.app/api/{db}/` was retired (404) as of 2026-04-20. Docs still show this old pattern — will confuse new developers. |

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
