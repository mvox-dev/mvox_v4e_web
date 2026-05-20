# Entu Mutation Wire Shapes — Live-Verified 2026-05-20

**Probe**: `scripts/migrations/probes/probe-mutation-ops-2026-05-20.ts`
**Result artifact**: `scripts/migrations/seed-results/probe-mutation-ops-2026-05-20T15-24-35-641Z.json`
**Architecture-decisions entry**: `43517ac` — "Entu mutation-op wire shapes (2026-05-20, session 8)"

---

## Three confirmed wire shapes

### 1. UPDATE — replace a property value

Entu has no in-place update. To change a property value:

1. `DELETE /polyphony/property/{existing-prop-value-id}` → `{"deleted": true}`
2. `POST /polyphony/entity/{entity-id}` with `{ propName: { string: newValue } }` → appends new value

**Evidence** (target: `Soprano (EFK)` section, `display_order`):

| Step | Value | Result |
|---|---|---|
| Pre | `1` | read from GET |
| Intermediate | `10` | DELETE old + POST new → confirmed read-back `10` |
| Final | `1` | DELETE intermediate + POST new → confirmed read-back `1`, roundtrip correct |

### 2. REMOVE — delete a property value entirely

`DELETE /polyphony/property/{prop-value-id}` → `{"deleted": true}`

Subsequent GET of the entity returns the property absent (not null, not zero — key missing from response).

**Evidence** (target: `Soprano (EFK)` section, `ordinal` pre-v4E artifact):

| Step | Result |
|---|---|
| Pre | `ordinal` present with value `1`, prop-value id `69c7f8728489bfcb0e81b080` |
| Post DELETE | `ordinal` key absent from entity GET response |

### 3. DELETE_ENTITY — hard delete an entity

`DELETE /polyphony/entity/{entity-id}` → `{"deleted": true}`

Subsequent GET of the same `entity-id` returns HTTP 404. Entity disappears from `?_type=` listing queries.

**Evidence** (target: `Mait Vaher`, last pre-v4E member by `_id`):

| Step | Result |
|---|---|
| Pre | entity GET → 200, name "Mait Vaher" |
| Post DELETE | entity GET → 404 |
| Member count | 116 → 115 (confirmed via listing query) |

---

## Gotchas

- **DELETE /property/ vs DELETE /entity/ are not interchangeable.** `DELETE /property/{id}` removes one property-value from an entity. `DELETE /entity/{id}` hard-deletes the entity itself. Confusing them (bug confirmed in Phase B.1) silently succeeds but does the wrong thing.
- **No bulk DELETE.** `DELETE /property/{id1},{id2}` returns HTTP 500. All deletes are serial.
- **POST appends.** `POST /entity/{id}` appends a new property-value; it does not replace. Always DELETE the old value-id before POSTing a replacement.

(*MVOX:Pérotin*)
