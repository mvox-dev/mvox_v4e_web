# Entu Formula Unwrap — Live-Verified 2026-05-21

**Probe**: `scripts/migrations/probes/probe-phase-d-formula-unwrap-2026-05-21.ts`
**Result artifact**: `scripts/migrations/seed-results/probe-phase-d-formula-unwrap-2026-05-21T05-13-08-917Z.json`
**Date**: 2026-05-21
**Purpose**: Verify that deleting the `formula` value from a prop-def entity converts instances of that property from formula-evaluated to plain-writable.

---

## Question

When you `DELETE /property/{formulaValueId}` on a prop-def entity (removing the formula expression), do the property instances on that type become plain-writable?

---

## Probe setup

Created a throwaway type `_probe_phase_d_formula_unwrap` with:
- `probe_forename` — plain string prop-def
- `probe_surname` — plain string prop-def
- `probe_name` — formula prop-def (`probe_forename ' ' probe_surname`)

Created one instance with `probe_forename=Test`, `probe_surname=Probe`.

Verified `probe_name` materialized as `"Test Probe"` before unwrap.

---

## Results

| Step | Op | Result |
|---|---|---|
| Read formula value _id | GET prop-def | `formula=[{"_id":"6a0e945f4ff8277cd430665f","string":"probe_forename ' ' probe_surname"}]` |
| Delete formula value | `DELETE /property/6a0e945f4ff8277cd430665f` | 200 OK |
| Re-read prop-def | GET | `formula=[]` — formula gone from prop-def |
| Existing instance probe_name | GET | `"Test Probe"` — **stale value persists** (consistent with Q4 findings) |
| Direct POST probe_name to existing instance | POST `[{type:'probe_name',string:'Direct Write Test'}]` | `probe_name=["Direct Write Test"]` — **write stuck, single value** |
| New instance with plain probe_name | POST new entity with `probe_name=Fresh Plain Name` | `probe_name=["Fresh Plain Name"]` — **plain write works** |

---

## Conclusions

### 1. Formula-unwrap WORKS

`DELETE /property/{formulaValueId}` on a prop-def's `formula` property value converts the property to plain-writable. After deletion:
- New instances accept plain POSTs and values persist.
- Existing instances accept direct POSTs and the written value sticks.

### 2. Stale formula value persists until overwritten

The existing instance's stale `"Test Probe"` value remained after the prop-def's formula was deleted (consistent with Q4: "Entu RETAINS materialized formula values after source deletion"). This is expected and benign — a subsequent direct POST replaces it.

### 3. POST to existing instance with stale formula value — single value, not multi

Crucially: when POSTing a plain value to an instance that has a stale formula-cached value, the result is **a single new value** (not a multi-value accumulation). The stale formula value disappears. This differs from the Q5 multi-value trap (which applies to regular plain properties). Formula-cached values have no `_id`, so the POST path on Entu does not treat them as an existing value to accumulate alongside — the new plain value replaces the formula cache.

This means: for the 120 seed persons with `name=" "`, a direct POST of `name=<real name>` will produce `name=["<real name>"]` cleanly, without needing to pre-delete the stale space value.

---

## Implication for Phase D sub-op 1

The plan is valid:

1. **DELETE** the `formula` value `_id=69bcfd8e9c031ab8e6ce81cb` from the `person.name` prop-def (`_id=69bcfd8e9c031ab8e6ce8068`).
2. Verify: `formula=[]` on the prop-def after delete.
3. **POST** real names to the 120 seed persons. No pre-delete of the stale `" "` value needed — the POST replaces it.
4. **DELETE** `forename` and `surname` values from the 2 real persons (PO + Test User).
5. **DELETE** the `forename` and `surname` prop-def entities.

---

(*MVOX:Perotin*)
