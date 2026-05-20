# Section voice_type Audit — 2026-05-20

**Source:** Live polyphony Entu db
**Query:** `GET /polyphony/entity?_type.reference=69c7ea498489bfcb0e819ea3&props=name,voice_type&limit=200`
**Date:** 2026-05-20
**Probed by:** Finn (research request from team-lead, 2026-05-20 04:23)
**Purpose:** Phase B Open item #4 — settle distinct `section.voice_type` values before Tallis writes §1.3 rename fixtures

---

## 1. Total Section Count

**16 sections** total. All 16 have a `voice_type` value — zero NULL/missing.

---

## 2. Distinct `voice_type` Values

| `voice_type` value | Section count |
|--------------------|---------------|
| `alto`             | 3             |
| `baritone`         | 2             |
| `bass`             | 3             |
| `soprano`          | 3             |
| `tenor`            | 5             |
| **Total**          | **16**        |

---

## 3. Full Section Inventory

| Section name | `voice_type` |
|--------------|--------------|
| Soprano      | `soprano`    |
| Alto         | `alto`       |
| Tenor        | `tenor`      |
| Bass         | `bass`       |
| Soprano I    | `soprano`    |
| Soprano II   | `soprano`    |
| Alto I       | `alto`       |
| Alto II      | `alto`       |
| I Tenor      | `tenor`      |
| II Tenor     | `tenor`      |
| Baritone     | `baritone`   |
| Bass         | `bass`       |
| I Tenor      | `tenor`      |
| II Tenor     | `tenor`      |
| Baritone     | `baritone`   |
| Bass         | `bass`       |

The 16 sections belong to multiple orgs (names repeat across orgs — "I Tenor", "II Tenor", "Baritone", "Bass" each appear twice). That's expected; sections are per-org.

---

## 4. Anomalies

**None detected.**

- No empty strings
- No whitespace-only values
- No case duplicates (all values are lowercase)
- No trailing/leading whitespace

---

## 5. Commentary

All 5 values are standard Western choral voice types:

- `soprano`, `alto`, `tenor`, `bass` — the four SATB standard voices
- `baritone` — standard extended voice, commonly added to SATB for SSATBB or SATBB ensembles

No non-standard values (e.g. `alto1`, `T1`, `bass-divisi`, abbreviations, typos).

---

## 6. Implication for Phase B §1.3

The backfill lookup will succeed for every section as long as the `voice` entity instances created in Phase B include exactly these 5 names:

- `alto`
- `baritone`
- `bass`
- `soprano`
- `tenor`

The `voice` entity TYPE exists from Phase A (created 2026-05-20 03:46 UTC, see `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.json`). Phase B's §1.3 must create the 5 `voice` INSTANCES before backfilling — order: create voices → add `section.voice` property → backfill → delete `section.voice_type`.

Zero `unmatched_voice_type` failures expected at execution time.

---

(*MVOX:Finn*) (Probe + tabulation)
(*MVOX:Palestrina*) (Committed to repo for persistence per session 6 lesson 3)
