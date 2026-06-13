# Entu formula: COUNT scope + formula-reads-formula mechanics

**Date:** 2026-06-13  
**Branch:** main (direct commit)  
**Authorised by:** team-lead 2026-06-13 (session 32)  
**Probe script:** `scripts/migrations/probes/probe-formula-count-concat-2026-06-13.ts`  
**Artifact:** `scripts/migrations/seed-results/probe-formula-count-concat-2026-06-13T10-51-33-498Z.json`

---

## Setup

`_probe_event` type with multiple formula properties (4 count formulas + tally + Q2 variants).  
`_probe_rsvp` type with sentinel reference props (`going_ref`, `maybe_ref`, `not_going_ref`, `late_ref`).  
7 rsvp instances: 3 going (2 public + 1 private), 2 maybe (1 public + 1 private), 1 not_going (public), 1 late (private).

---

## Q1 — Formula-reads-formula (dependency ordering)

### 4 count formulas
```
going_count     = _referrer._probe_rsvp.going_ref COUNT
maybe_count     = _referrer._probe_rsvp.maybe_ref COUNT
not_going_count = _referrer._probe_rsvp.not_going_ref COUNT
late_count      = _referrer._probe_rsvp.late_ref COUNT
```

Results: `going=3, maybe=2, not_going=1, late=1` — all correct, rights bypass confirmed again.

### 5th tally formula referencing the 4 count props
```
tally = "{"going":" going_count ","maybe":" maybe_count ","not_going":" not_going_count ","late":" late_count "}" CONCAT
```

Result:
```
{"going":3,"maybe":2,"not_going":1,"late":1}
```

**WORKS.** The tally formula correctly reads `going_count`, `maybe_count`, `not_going_count`, `late_count` as pre-evaluated scalar values. Dependencies are resolved in the correct order (count formulas materialize before tally reads them).

### Named formula-prop arithmetic: BROKEN

```
q1_going_times2 = going_count 2 *
```

Result: `"32"` (string) — not `6` (number).

**The `*` operator is not numeric multiplication in this context.** The formula engine treats named formula-property references as string substitution. `going_count` resolves to `"3"` (string), `2` is pushed as `"2"`, and `*` appears to CONCAT them as strings → `"32"`. Alternatively `*` may mean string-repeat.

**Implication:** Arithmetic on formula-derived values (e.g. `going_count + maybe_count` for a total) is not reliable via the arithmetic operators. Use a separate `_referrer._probe_rsvp.target COUNT` formula for total, or compute totals client-side.

---

## Q2 — Single-formula count+concat (no intermediate props)

Three variants tested:

### Q2a — Interleaved string literals and COUNTs
```
"{going:" _referrer._probe_rsvp.going_ref COUNT ",maybe:" _referrer._probe_rsvp.maybe_ref COUNT "}" CONCAT
```

Result: `"4}"`

**FAILS.** Dissection:
1. `"{going:"` pushed to stack. Stack: `["{going:"]`
2. `_referrer._probe_rsvp.going_ref` pushes 3 referrer entities. Stack: `["{going:", r1, r2, r3]`
3. `COUNT` — **consumes the ENTIRE stack** (4 items). Stack: `[4]`
4. `",maybe:"` pushed. Stack: `[4, ",maybe:"]`
5. `_referrer._probe_rsvp.maybe_ref` pushes 2 referrer entities. Stack: `[4, ",maybe:", r4, r5]`
6. `COUNT` — consumes entire stack again (4 items). Stack: `[4]`
7. `"}"` pushed. Stack: `[4, "}"]`
8. `CONCAT` → `"4}"`

**COUNT is a whole-stack reducer.** It counts ALL items currently on the evaluation stack, not just the preceding reverse-reference traversal result.

### Q2b — All COUNTs first, then CONCAT
```
_referrer._probe_rsvp.going_ref COUNT _referrer._probe_rsvp.maybe_ref COUNT _referrer._probe_rsvp.not_going_ref COUNT CONCAT
```

Result: `"2"` (not `"321"` as might be hoped)

**FAILS.** Dissection:
1. `_referrer._probe_rsvp.going_ref` pushes 3 items. Stack: `[r1, r2, r3]`
2. `COUNT` — consumes all 3. Stack: `[3]`
3. `_referrer._probe_rsvp.maybe_ref` pushes 2 items. Stack: `[3, r4, r5]`
4. `COUNT` — consumes all 3 items on stack. Stack: `[3]` — **the prior `3` is consumed again**
5. `_referrer._probe_rsvp.not_going_ref` pushes 1 item. Stack: `[3, r6]`
6. `COUNT` — consumes 2. Stack: `[2]`
7. `CONCAT` — only 1 item on stack. Result: `"2"`

Each subsequent `COUNT` re-consumes everything including the count produced by the previous `COUNT`.

### Q2c — Single count + concat
```
"going=" _referrer._probe_rsvp.going_ref COUNT CONCAT
```

Result: `"4"` (not `"going=3"`)

**FAILS.** `"going="` (1 item) + 3 referrers = 4 items on stack → `COUNT` = `4`. The literal is consumed.

---

## Summary of COUNT semantics (empirically confirmed)

**`COUNT` in Entu's formula engine reduces the ENTIRE evaluation stack, not just the preceding sub-expression.**

This is a whole-stack reduce operation. There is no way to scope COUNT to a specific sub-expression when other items exist on the stack. Interleaving string literals with reverse-ref traversals and COUNTs always produces incorrect results because COUNT consumes the literals too.

---

## Architecture verdict

| Approach | Viable? | Notes |
|----------|---------|-------|
| **4 separate count formulas** on event | **YES** | `_referrer.rsvp.going_ref COUNT` etc. — confirmed working |
| **Tally formula reading the 4 count props** | **YES** | Named formula-prop references work as pre-evaluated scalars |
| Single complex COUNT+concat formula | **NO** | COUNT is whole-stack — cannot interleave with string literals |
| Arithmetic on formula values (`going + maybe`) | **NO** | `*` / `+` treat values as strings; `going_count 2 *` → `"32"` |

---

## Recommended architecture for slice-2b RSVP tally

**Use the 4 count formulas + 1 tally formula pattern (Q1 architecture).**

```
-- On rsvp type: sentinel reference props (set to event._id when status matches)
going_ref     : reference
maybe_ref     : reference  
not_going_ref : reference
late_ref      : reference

-- On event type: 4 count formulas
rsvp_going_count     : number, formula = _referrer.rsvp.going_ref COUNT
rsvp_maybe_count     : number, formula = _referrer.rsvp.maybe_ref COUNT
rsvp_not_going_count : number, formula = _referrer.rsvp.not_going_ref COUNT
rsvp_late_count      : number, formula = _referrer.rsvp.late_ref COUNT

-- On event type: optional tally formula (convenient single-field read)
rsvp_tally : string, formula = '{"going":' rsvp_going_count ',"maybe":' rsvp_maybe_count ',"not_going":' rsvp_not_going_count ',"late":' rsvp_late_count '}' CONCAT
```

Client can read either the 4 individual count props OR the single `rsvp_tally` JSON string. Both are correct and up to date (formula-reads-formula dependency ordering is handled by Entu's aggregation engine).

**No BFF elevated op needed for the tally.** The conductor reads counts directly from the public event entity.

---

## Cleanup

All `_probe_event` and `_probe_rsvp` types and instances deleted (verified via `{"deleted":true}`).

---

(*MVOX:Perotin*)
