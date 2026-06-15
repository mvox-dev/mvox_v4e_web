# Slice-3: Membership Content Visibility Model

**Date:** 2026-06-15 (session 37)
**Branch:** main
**Related issue:** #91 / #92 (Slice-3 native keyless invite/join)

---

## Summary

Org-level `_viewer` grant does NOT automatically cascade to private agenda content when the org has `_inheritrights:false`. The fix: set `_inheritrights:true` explicitly on EVERY node in the agenda chain (seasons, event_series, events), and guard private subtrees (library) with their own `_inheritrights:false`. The org entity itself stays `_inheritrights:false` (load-bearing tenant isolation).

Applied live to EFK (polyphony playground), verified, and subsequently partially reverted: EFK org flipped back to `_inheritrights:false` per PO directive (orgs must stay isolated from umbrella). Agenda chain and library guard retained.

---

## Probe: absent `_inheritrights` default

**Empirical result:** Entu auto-sets `_inheritrights:true` when the field is absent at entity creation. A child created without `_inheritrights` in the POST body gets `_inheritrights:true` materialized in the create response.

**Schema note:** `inheritsRights: boolean` is non-optional in the `EntityDef` TypeScript interface (`entu/research docs/schema/v4E/schema.ts:49`). Every entity type in the schema has it explicitly specified. Absent in runtime data = auto-materialized true by Entu.

**Cascade is live (not materialized-at-create):** A child created AFTER the parent's `_viewer` grant was established still picks up the inherited grant immediately. Rights propagation is evaluated at read time.

---

## `_inheritrights` direction

`_inheritrights` on an entity controls whether IT passes its rights DOWN to children — not whether it inherits from its parent. A child inherits from its parent when the child's own `_inheritrights` is `true` AND the parent's `_inheritrights` is `true`. One `false` in the chain breaks the cascade at that node.

---

## EFK safety check

EFK has two parents: db root (`69bcfd8e9c031ab8e6ce807a`) and Eesti Kammerkooride Liit umbrella (`69c7f8718489bfcb0e81b05a`). Umbrella has `_inheritrights:false` and carries only PO + db entity in its rights lists — no external viewers. Flipping EFK to `_inheritrights:true` is safe from the umbrella side.

---

## Mutations applied (2026-06-15, live on polyphony)

### Step 0 — Gate (confirmed GREEN before proceeding)

Isolated test: `_inheritrights:true` parent with explicit `_viewer:singer` + `_inheritrights:true` child (explicit) → singer GET returns 200. Cascade is live and works.

### Step 1 — Library guard

| Entity | _id | Mutation | Reversibility token |
|---|---|---|---|
| EPCC Library | `6a12036c4ff8277cd4306b26` | POST `_inheritrights:false` (was absent/auto-true) | `6a2fe1964cd971291c5d5eba` |

### Step 2 — Full chain set to explicit `_inheritrights:true`

| Entity | _id | Old prop (deleted) | New prop _id |
|---|---|---|---|
| EFK org | `69c7f8718489bfcb0e81b065` | `6a0e96a54ff8277cd430667b` (was `false`) | `6a2fe1a24cd971291c5d5ebb` ← **REVERTED** (see below) |
| Fila hooaeg season | `6a1d6b6210cc20db24e7ce58` | none (was absent) | `6a2fe1ac4cd971291c5d5ebc` |
| suvekool '26 season | `6a1d789c10cc20db24e7cf40` | none (was absent) | `6a2fe1ac4cd971291c5d5ebd` |
| Tuesday rehearsals (series) | `6a1d6b6210cc20db24e7ce61` | none (was absent) | `6a2fe1ac4cd971291c5d5ebe` |
| october sprint (series) | `6a2d546d4cd971291c5d5705` | none (was absent) | `6a2fe1ac4cd971291c5d5ebf` |
| Event `6a1d6b6210cc20db24e7ce70` | — | none | `6a2fe1b34cd971291c5d5ec0` |
| Event `6a1d6b6310cc20db24e7ce88` | — | none | `6a2fe1b44cd971291c5d5ec1` |
| Event `6a1d6b6310cc20db24e7ce94` | — | none | `6a2fe1b44cd971291c5d5ec2` |
| Event `6a1d6b6310cc20db24e7cea0` | — | none | `6a2fe1b44cd971291c5d5ec3` |
| Event `6a1d6b6310cc20db24e7ceac` | — | none | `6a2fe1b44cd971291c5d5ec4` |
| Event `6a1d6b6310cc20db24e7ceb8` | — | none | `6a2fe1b44cd971291c5d5ec5` |
| Event `6a1d6b6310cc20db24e7cec4` | — | none | `6a2fe1b44cd971291c5d5ec6` |
| Event `6a1d6b6410cc20db24e7ced0` | — | none | `6a2fe1b54cd971291c5d5ec7` |
| Event `6a1d6b6410cc20db24e7cedc` | — | none | `6a2fe1b54cd971291c5d5ec8` |
| Event `6a1d6b6410cc20db24e7cee8` | — | none | `6a2fe1b54cd971291c5d5ec9` |
| Event `6a1d6b6410cc20db24e7cef4` | — | none | `6a2fe1b54cd971291c5d5eca` |
| Event `6a1d6b6410cc20db24e7cf00` | — | none | `6a2fe1b54cd971291c5d5ecb` |
| Event `6a1d6b6410cc20db24e7cf0c` | — | none | `6a2fe1b54cd971291c5d5ecc` |
| Event `6a1d6b6410cc20db24e7cf18` | — | none | `6a2fe1b54cd971291c5d5ecd` |
| Event `6a1d6b6510cc20db24e7cf24` | — | none | `6a2fe1b64cd971291c5d5ece` |
| Event `6a2d546d4cd971291c5d5714` | — | none | `6a2fe1b64cd971291c5d5ecf` |
| Event `6a2d546e4cd971291c5d5720` | — | none | `6a2fe1b64cd971291c5d5ed0` |
| Event `6a2d546e4cd971291c5d572c` | — | none | `6a2fe1b64cd971291c5d5ed1` |
| Event `6a2d546e4cd971291c5d5738` | — | none | `6a2fe1b64cd971291c5d5ed2` |
| Event `6a2d546f4cd971291c5d5744` | — | none | `6a2fe1b64cd971291c5d5ed3` |
| Event `6a2d546f4cd971291c5d5750` | — | none | `6a2fe1b74cd971291c5d5ed4` |

### Step 3 — Verification (singer JWT, second account `6a2fc05e4cd971291c5d5ddc`)

| Check | Result |
|---|---|
| Singer GET "Tuesday rehearsals" event (`6a1d6b6210cc20db24e7ce70`) | **200** — entity returned, name visible ✓ |
| Singer LIST `?_type.string=event&_parent.reference=<season1>` | **21 results** ✓ |
| Singer GET EPCC Library (`6a12036c4ff8277cd4306b26`) | **403** — library guard holds ✓ |

---

## EFK org revert (2026-06-15, same session)

PO directive: organization entities must stay `_inheritrights:false` for load-bearing tenant isolation from the umbrella. EFK reverted:

| Step | Action | Result |
|---|---|---|
| DELETE | Prop `6a2fe1a24cd971291c5d5ebb` (`_inheritrights:true`) | `deleted: true` |
| POST | `_inheritrights:false` on EFK `69c7f8718489bfcb0e81b065` | New prop `6a2ff12a487a9c1f02f705c2` |
| Verify GET | `_inheritrights` on EFK | `[{_id:'6a2ff12a487a9c1f02f705c2', boolean:false}]` ✓ |

Agenda chain (seasons, event_series, 21 events) stays `_inheritrights:true`.

---

## Library guard removal + full children alignment (2026-06-15, same session)

PO directive + schema.ts (`library` has `inheritsRights:true`): the `_inheritrights:false` guard on EPCC Library was a mistake contradicting the schema. Removed. All EFK direct children aligned to `_inheritrights:true` (idempotent — skipped anything already true).

| Entity | Action | New prop _id / note |
|---|---|---|
| EPCC Library `6a12036c4ff8277cd4306b26` | DELETE false guard `6a2fe1964cd971291c5d5eba`, POST true | `6a2ff4bc487a9c1f02f705c3` |
| Soprano section `69c7f8728489bfcb0e81b07b` | SKIP — already true | — |
| Alto section `69c7f8748489bfcb0e81b0cd` | SKIP — already true | — |
| Tenor section `69c7f8758489bfcb0e81b113` | SKIP — already true | — |
| Bass section `69c7f8768489bfcb0e81b163` | SKIP — already true | — |
| 62 existing members | SKIP — all already true | — |
| member `6a2ba6c84cd971291c5d5320` | SET true (was absent) | `6a2ff4c5487a9c1f02f705c4` |
| member `6a2fdb434cd971291c5d5e85` | SET true (was absent) | `6a2ff4c5487a9c1f02f705c5` |

EFK confirmed still `_inheritrights:false` (prop `6a2ff12a487a9c1f02f705c2`) after all mutations.

---

## Membership content visibility model (v4E deployment standard)

For a member to see org content via the org `_viewer` grant, every node in the chain from org to content must have `_inheritrights:true`. Set explicitly (don't rely on absent-default, even though runtime auto-materializes true).

```
organization      _inheritrights:false  ← ISOLATION: orgs don't inherit from umbrella
  season          _inheritrights:true   ← org _viewer grant cascades FROM season down
    event_series  _inheritrights:true
    event         _inheritrights:true   ← member can read rehearsal schedule
  library         _inheritrights:true   ← schema.ts: library inheritsRights:true
    copy          _inheritrights:true   ← schema.ts: copy inheritsRights:true
    lending       _inheritrights:true   ← schema.ts: lending inheritsRights:true
  section         _inheritrights:true   ← schema.ts: section inheritsRights:true
  member          _inheritrights:true   ← schema.ts: member inheritsRights:true
```

**Key insight:** `_inheritrights:false` on org blocks the umbrella→org cascade (correct isolation). Org-level `_viewer` grants to members still cascade DOWN through all children (seasons, library, sections, members) because those nodes have `_inheritrights:true`. The org's own `_inheritrights` controls what it receives FROM its parent, not what it passes to its children — those are governed by the children's own `_inheritrights` values.

**Library access control** is NOT via `_inheritrights:false` — it is via explicit `_viewer`/`_editor` grants on the library entity scoped to librarian members. The library subtree is accessible by anyone who has a grant on it; the org `_viewer` grant cascades there just like to events.

Private subtrees that should NOT be member-visible must have their own `_inheritrights:false` guard. The library subtree is the canonical example.

## Deployment prerequisite checklist addendum

Alongside `add_user` on db entity and type-defs `_sharing:domain`:
3. Org and agenda chain `_inheritrights:true` (explicit on every node)
4. Private subtrees (library, any org-internal-only content) `_inheritrights:false`

## Side note: api_key masking

Entu hashes `entu_api_key` values and returns `***` on subsequent GET. The raw key is only available in the create response. Must capture at POST time and use immediately — cannot re-read later.

(*MVOX:Pérotin*)
