# Formula reverse-reference aggregation probe

**Date:** 2026-06-13  
**Branch:** main (direct commit, per team-lead instruction)  
**Authorised by:** team-lead 2026-06-13 (session 32)  
**Scope:** Decides slice-2b conductor RSVP tally design — formula-based vs BFF elevated report

---

## Background

Entu JWTs are IP-bound (`aud=callerIP`). A BFF server cannot hold a user JWT across requests and cannot act as a trusted-identity conductor when the JWT was minted from the user's browser. This rules out a BFF that mediates "read all RSVPs for event X as conductor" using the conductor's own JWT. 

One alternative: define formula properties on the `event` entity that aggregate counts from private `rsvp` entities referencing it. Formulas bypass the Entu rights evaluator (established principle: common-prompt §"Formula evaluator bypasses rights"). If this works for reverse-reference aggregation (rsvp → event, not child of event), the conductor can read counts directly from the public event entity with no elevated BFF op and no per-rsvp grants.

---

## Probe design

Two passes:

**Pass 1** (`_probe_target` / `_probe_voter`): Establish that `_referrer.<type>.<prop> COUNT` syntax works, and that it counts private entities. Voters reference target via a `target` property; target carries formula `_referrer._probe_voter.name COUNT`.

**Pass 2** (`_probe_target2` / `_probe_voter2`): Test per-status COUNT. Strategy: each voter sets a sentinel reference property (`going_ref`, `maybe_ref`, `not_going_ref`) only when their status matches. Target formulas: `_referrer._probe_voter2.going_ref COUNT` etc. 6 voters (2 going public, 1 maybe public, 1 not_going public, 1 going private, 1 maybe private).

All types and instances cleaned up post-probe.

---

## Results — Pass 1

Formula: `_referrer._probe_voter.name COUNT`

| Formula | Result | Notes |
|---------|--------|-------|
| `_referrer._probe_voter.name COUNT` | **6** | All 6 voters counted (4 public + 2 private) |
| `_referrer._probe_voter.status CONCAT` | `"goinggoingmaybenot_goinggoingmaybe"` | All 6 status strings concatenated (unordered) |
| `_child._probe_voter.name COUNT` | **0** | Child-of not applicable — voters reference via prop, not `_parent` |

---

## Results — Pass 2 (per-status sentinel pattern)

Formulas: `_referrer._probe_voter2.going_ref COUNT`, `_referrer._probe_voter2.maybe_ref COUNT`, etc.

| Formula | Result | Expected (bypass YES) | Expected (bypass NO) | Verdict |
|---------|--------|-----------------------|----------------------|---------|
| `going_count` | **3** | 3 | 2 | **BYPASS YES** |
| `maybe_count` | **2** | 2 | 1 | **BYPASS YES** |
| `not_going_count` | **1** | 1 | 1 | (confirms baseline) |
| `total_count` | **6** | 6 | 4 | **BYPASS YES** |

Private voters (1 going, 1 maybe) are counted despite being unreadable to non-owners.

---

## Verdict

**VIABLE. Formula-based conductor RSVP tally works and bypasses rights.**

1. **`_referrer.<type>.<prop> COUNT` is supported** in Entu's formula engine for reverse-reference aggregation. Single-hop (`_referrer._probe_voter2.going_ref`) — no chaining needed.

2. **Rights bypass is confirmed** for reverse-reference formulas. Private rsvp entities (only visible to their owner) are still counted by formulas on the referenced entity. This matches the documented behaviour for `_child` aggregation (member_count formulas in the polyphony schema) — the bypass applies to `_referrer` as well.

3. **Per-status counts are achievable** via the sentinel-reference pattern: add a per-status reference property to the `rsvp` entity (`going_ref`, `maybe_ref`, `not_going_ref`, `late_ref`); set only the one matching the current status. The `event` entity carries count formulas `_referrer.rsvp.going_ref COUNT` etc. No intermediate denormalization entity needed.

4. **No BFF elevated op needed for the tally** — the conductor reads counts directly from the public event entity. The formula aggregates across the rights boundary automatically.

---

## Denormalization shape for rsvp → event

To implement the formula tally in the v4E schema:

### On `rsvp` type — add 4 sentinel reference properties
```
going_ref:      type reference, optional — set to event._id when status='going'
maybe_ref:      type reference, optional — set to event._id when status='maybe'  
not_going_ref:  type reference, optional — set to event._id when status='not_going'
late_ref:       type reference, optional — set to event._id when status='late'
```

BFF write path (rsvp create/update):
1. POST rsvp with `event`, `member`, `status` properties.
2. POST exactly one of `{going_ref, maybe_ref, not_going_ref, late_ref}` = event `_id`.
3. On status change: DELETE the old sentinel prop value; POST the new sentinel prop.

### On `event` type — add 4 count formula properties
```
rsvp_going_count:     type number, formula: '_referrer.rsvp.going_ref COUNT'
rsvp_maybe_count:     type number, formula: '_referrer.rsvp.maybe_ref COUNT'
rsvp_not_going_count: type number, formula: '_referrer.rsvp.not_going_ref COUNT'
rsvp_late_count:      type number, formula: '_referrer.rsvp.late_ref COUNT'
```

These are public properties on the event (event is `_sharing: public`). Any authenticated user who can read the event sees the tally. No elevated BFF endpoint needed.

---

## Single-hop constraint

All four formula expressions are single-hop (`_referrer.rsvp.going_ref`) — no chaining. The documented constraint "single-hop formula traversal only" (common-prompt §"v4E / Entu Known Pitfalls") is satisfied.

---

## Implications for slice-2b

| Question | Answer |
|----------|--------|
| Formula-based tally VIABLE? | **YES** |
| Rights bypass works? | **YES** — private rsvps counted |
| Needs BFF elevated op for tally? | **NO** — read directly from event |
| Schema change needed? | YES — add sentinel props to `rsvp` + count formulas to `event` (upstream `entu/research` PR) |
| Per-status formula syntax | `_referrer.rsvp.going_ref COUNT` (sentinel-reference pattern) |
| Status-change BFF complexity | Moderate — DELETE old sentinel + POST new sentinel on each update |

The BFF elevated report endpoint (`GET /api/reports/rsvp-summary`) from spec §6 can be **simplified or eliminated** for the count display: the formula tally covers going/maybe/not_going/late counts natively on the event entity. The elevated endpoint may still be useful for **name lists** (who is going) — that would require a different approach (CONCAT of names, or still an elevated query). But the core tally (counts only) is formula-feasible.

---

## Probe artifacts

- Pass 1 artifact: `scripts/migrations/seed-results/probe-formula-reverse-ref-2026-06-13T09-33-17-593Z.json`
- Probe script: `scripts/migrations/probes/probe-formula-reverse-ref-aggregate-2026-06-13.ts`
- All `_probe_*` types and instances: deleted (verified via DELETE → `{"deleted":true}`)

---

(*MVOX:Perotin*)
