# Seeding Source Plan — Collectives + Members (v2)

**Author:** Pérotin
**Date:** 2026-05-20
**Branch:** chore/seed-collectives-v2
**Purpose:** Propose a v4E-aligned data manifest shape + seed approach for collectives, sections, and members in dev/staging environments. Supersedes the draft on chore/seeding-source-plan (c15df7a) which used properties deleted by Phase B/B.1 (org_type, contact_email, voice_type, joined_at, member.name).

---

## 1. Context

The polyphony Entu db currently has:

| Entity type | Count | Notes |
|-------------|-------|-------|
| `organization` | 6 | 2 umbrellas + 4 collectives (real Estonian choirs) |
| `section` | 16 | 4 per collective on average (SATB / SSAA / TTBBar etc.) |
| `member` | 116 | Real names from EFK, Sireen, Rahvusmeeskoor, TAM |
| `person` | 2 | PO + Test User only |
| `voice` | 5 | seeded 2026-05-20 (alto, baritone, bass, soprano, tenor) |

**Problem:** Real member names are PII in a development context. A fresh dev/staging deploy has zero seed data. Demos need realistic choral structure with mock members.

**Phase B/B.1 impact:** `org_type`, `contact_email`, `joined_at` deleted from schema. `member.name` never existed in v4E. Old manifest is invalid.

---

## 2. Approach

**Mix approach** — real Estonian choir names + section structures, mock members with Estonian-style names.

| Approach | Pro | Con |
|----------|-----|-----|
| Mine polyphony data | Real names, minimal work | PII — 116 real singer names in staging/demo |
| Public choir info + mock members | Realistic structure, no PII | Names real orgs (publicly listed) |
| Fully synthetic | Zero privacy risk | Weak for demos |
| **Mix (chosen)** | **Realistic org structure; mock members; no PII** | Names real orgs — acceptable (publicly listed on Eesti Kooriühing) |

Privacy note: Member names are random Estonian forename+surname combinations — no real individual is named. Org names (EFK, Sireen, Rahvusmeeskoor, TAM) are already in the repo and associated with polyphony publicly.

---

## 3. Target Shape (v4E-aligned)

### 3.1 Org structure

Seed **2 umbrellas + 4 collectives** matching the polyphony structure:

```
Eesti Kammerkooride Liit (umbrella)
  ├── Eesti Filharmoonia Kammerkoor (collective — SATB)
  └── Kammernaiskoor Sireen (collective — SSAA)

Eesti Meeskooride Liit (umbrella)
  ├── Eesti Rahvusmeeskoor (collective — TTBBar)
  └── Tartu Akadeemiline Meeskoor (collective — TTBBar)
```

Umbrella/collective distinction in v4E is structural (organization recursion), NOT a property. No `org_type` field.

### 3.2 Section structures

| Collective | Sections | Voice (lookup by name) |
|------------|----------|------------------------|
| Eesti Filharmoonia Kammerkoor | Soprano, Alto, Tenor, Bass | soprano, alto, tenor, bass |
| Kammernaiskoor Sireen | Soprano I, Soprano II, Alto I, Alto II | soprano, soprano, alto, alto |
| Eesti Rahvusmeeskoor | I Tenor, II Tenor, Baritone, Bass | tenor, tenor, baritone, bass |
| Tartu Akadeemiline Meeskoor | I Tenor, II Tenor, Baritone, Bass | tenor, tenor, baritone, bass |

Section `voice` is a reference (v4E `ref: true`) — seed script looks up voice entity id by name at runtime.

### 3.3 Organization properties (v4E)

```
name         (string, required)
description  (text, optional)
location     (string, optional — "Tallinn, Estonia" / "Tartu, Estonia")
website      (string, optional)
_sharing     public
_inheritrights false  (rights island)
_parent      <founder person entity id>  [see Open Question 2]
```

Removed from old manifest: `org_type`, `contact_email`. Not in v4E.

### 3.4 Section properties (v4E)

```
name          (string, required)
voice         (reference → voice entity, optional)
display_order (number, optional)
_sharing      public
```

### 3.5 Member shape — OPEN QUESTION (team-lead ruling pending)

v4E `member` has exactly 3 properties:

```
person          (ref → person, REQUIRED)
current_section (ref → section, optional)
status          (string: "active" | "archived", REQUIRED)
```

There is no `name` property. No `contact_email`. No `joined_at`.

The old manifest used orphan members (no `person` ref) with `member.name` as a string. This is a v4E violation — `person` is `required: true`.

**Three options flagged to team-lead:**

- **A — Create person stubs:** Seed ~120 minimal `person` entities (name + status, no OAuth) alongside members. v4E-clean. Largest scope increase.
- **B — Orphan members with `_SEED_ORPHAN` marker:** Keep members without `person` ref, gate behind a marker property. Documents divergence. Members exercise section/org placement code paths but fail v4E spec.
- **C — Drop member seeding:** Only seed orgs + sections. Member seeding deferred until Phase C bilateral flow exists. Simplest; fewest entities to create.

**Ruling from team-lead required before writing manifest member entries or script member-creation logic.**

### 3.6 Counts per environment

| Environment | Orgs | Sections | Members/section |
|-------------|------|----------|-----------------|
| dev | 4 collectives + 2 umbrellas | 16 | 6 |
| staging / demo | 4 collectives + 2 umbrellas | 16 | 8 |

Distribution heuristic: EFK (mixed ~28 dev / ~40 staging): 5–8/section. Sireen (women's ~24/~32): 5–8/section, SS slightly larger. Rahvusmeeskoor (large men's ~44/~56): 8–10/section. TAM (smaller men's ~20/~26): 4–6/section with visible variance.

---

## 4. Open Questions (pending team-lead ruling)

**OQ-1 — Member shape:** Which option (A / B / C) for member entities? See §3.5.

**OQ-2 — Org founder person id:** v4E `organization` has `parents: [{ entity: 'person', required: true }]`. Every org creation needs `_parent.reference = <person entity id>`. Options:
- A) Use PO's existing person entity id (Finn can probe for it)
- B) Create a placeholder "system" person entity as seed founder (one entity, all seed orgs point to it)
- C) Team-lead provides the id directly

**OQ-3 (non-blocking) — Umbrella parent id:** Seed umbrellas first (they have no org parent), then collectives reference umbrella id. Script handles this via dependency ordering — no ruling needed, flagging for awareness.

---

## 5. Toolkit extraction proposal

This is the 3rd migration script (after seed-voices.ts and phase-b-1-cleanup.ts). Common patterns across all three:

- Idempotency check-then-skip (query by name/type before creating)
- Dry-run guard (`--dry-run`)
- JWT auth fetch
- Result artifact accumulator (JSON report at `seed-results/<name>-<ISO>.json`)

Proposal: extract these to `scripts/migrations/perotin-toolkit.ts` and have seed-collectives.ts (and retroactively seed-voices.ts) import from it. Keeps each seed script focused on its data logic.

**This is a proposal — team-lead ruling needed** (low priority; can land as a separate PR after this script ships, or inline if PO prefers).

---

## 6. Idempotency strategy

All creation steps follow check-then-skip:

1. Query by name (`?_type.reference=<typeId>&name.string=<name>`) before creating
2. If entity exists: log SKIP, record id, continue
3. If not: create, log CREATE, record id

Re-running the seed script against an already-seeded db is safe — no duplicates.

---

---

## 7. Dry-run results (2026-05-20)

Script run against live polyphony with `--dry-run`. Exit 0, zero failures.

| Phase | Would Create | Already Exist | Notes |
|-------|-------------|---------------|-------|
| persons | 120 | 0 | All mock persons are new |
| orgs | 0 | 6 | All 6 (2 umbrellas + 4 collectives) already in polyphony |
| sections | 0 | 16 | All 16 sections already in polyphony |
| members | 120 | 0 | All 120 v4E-clean members are new (old 116 used string name) |

Umbrella parent check: existing collectives already have their umbrella parent linked — live run will skip the second POST.

Clarification sent to team-lead: schema.ts shows `person.name` as plain string (no `forename`/`surname`). Script uses `name` directly per schema. Pending team-lead confirmation before live run.

(*MVOX:Perotin*)
