# Librarian Bundle Seed Strategy — 2026-05-23

**Author:** Pérotin (MVOX data manager)
**Task:** CHORE-60 parallel seed workstream
**Target db:** polyphony (playground — per [[polyphony-is-playground]])
**Source:** `docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip` → `Data.jsx`
**Schema ref:** `~/projects/entu-research/docs/schema/v4E/schema.ts` (verified against live polyphony prop-defs)
**Date:** 2026-05-23

---

## 1. Live state at strategy time

Verified via direct Entu API queries 2026-05-23 ~19:35.

| Entity type | Live count in polyphony | Type entity ID |
|---|---|---|
| organization | 6 | `69c7ea478489bfcb0e819e3d` |
| section | 20+ | `69c7ea498489bfcb0e819ea3` |
| member | 235 | `69c7ea4a8489bfcb0e819edd` |
| person | 122 | `69bcfd8e9c031ab8e6ce805f` |
| library | **0** | `6a0d2e8090c8df7a1cc7dd9d` |
| work | **0** | `69c7ea4c8489bfcb0e819f3e` |
| edition | **0** | `69c7ea4e8489bfcb0e819f9c` |
| copy | **0** | `6a0d2e8190c8df7a1cc7ddb0` |
| lending | **0** | `6a0d2e8190c8df7a1cc7dde8` |

The library subtree is completely empty — no existing data to conflict with.

---

## 2. Bundle content summary

From `Data.jsx`:

- **Choir:** Estonian Philharmonic Chamber Choir (EPCC), slug `epcc`, 48-singer rehearsal size
- **Members:** 8 synthetic Estonian singers (S1/S2/A/T1/T2/B1/B2 voice parts)
- **Works:** 13 works with editions, copies, loan state, locations
- **Active loans:** 4 overdue lendings on Pärt Magnificat (copies #14/#15 to Henn Kuusik, #22/#23 to Margus Roos, since 2025-11-12, 195 days overdue as of mock TODAY 2026-05-26)

---

## 3. Entity mapping: bundle → v4E

### 3.1 Choir → organization (REUSE)

**Decision: REUSE** the existing EFK entity.

`Eesti Filharmoonia Kammerkoor` (EFK) in polyphony IS the Estonian Philharmonic Chamber Choir (EPCC). The bundle uses "EPCC" as a shorthand; the real organization is EFK. Both names refer to the same ensemble.

- **EFK entity `_id`:** `69c7f8718489bfcb0e81b065`
- **EFK sections:** Soprano, Alto, Tenor, Bass (4 sections, existing)
- **EFK members:** 54 existing seed members

The seed will attach the library to this existing EFK org entity. No new organization entity is created.

**Rationale:** Creating a second "EPCC" organization alongside EFK would be confusing noise on a playground db. The mock-fixture swaps are easier if the live entity IS the one the app already knows about.

### 3.2 Members → person + member (CREATE NEW, namespaced)

The bundle has 8 synthetic members:

| id | name | voice |
|---|---|---|
| mt | Maris Tamm | S1 |
| ls | Liina Saar | S2 |
| al | Ave Lepp | A |
| kp | Kärt Põld | A |
| tm | Toomas Mägi | T1 |
| av | Andres Vahar | T2 |
| mr | Margus Roos | B1 |
| hk | Henn Kuusik | B2 |

**Decision: CREATE NEW person + member entities** for these 8.

EFK already has 54 seeded members (session 8). The bundle's 8 are a distinct small set chosen specifically for the librarian design. The two sets don't overlap — EFK's seed members have names like "Marika Kask", "Priit Saar" etc. from the collectives seed manifest.

The 8 bundle members will be created as new person entities with `name` set, then linked as `member` entities under EFK. They will NOT be duplicate-checked against the 54 existing members by name (the names are distinct enough; the idempotency check will be: does a member entity already exist whose `person.*.name` matches?).

**Voice assignment:** The bundle uses fine-grained voice parts (S1, S2, A, T1, T2, B1, B2). The existing EFK sections are coarser (Soprano, Alto, Tenor, Bass). The 8 bundle members will be:
- Created as `person` with `voice` reference to the matching global voice entity (soprano/alto/tenor/bass from the 5 seeded voices)
- Assigned to the coarse EFK section as `member` parent (S1 → Soprano section, T1/T2 → Tenor section, B1/B2 → Bass section)
- The fine `S1`/`S2`/`T1`/`T2`/`B1`/`B2` distinction is stored in the `person.voice` reference (using the nearest available voice: soprano for S1/S2, tenor for T1/T2, bass for B1/B2). No new sub-sections created.

**Idempotency:** Check `person.name.string=<name>` existence before creating. If found, use existing. Member idempotency: check `_parent.reference=<EFK_id>` + `person.reference=<person_id>` — if a member already exists for this person in EFK, skip.

### 3.3 Library → library (CREATE NEW)

**Decision: CREATE ONE library entity** as a child of EFK.

- Parent: EFK (`69c7f8718489bfcb0e81b065`)
- Name: `"EPCC Library"` (distinct label so it's identifiable in Entu UI)
- `_sharing: private` (per v4E spec)

**Idempotency:** Check `_type.string=library&_parent.reference=<EFK_id>` — if any library already exists under EFK, skip creation and reuse it.

### 3.4 Works → work (CREATE NEW, library-scoped)

13 works from the bundle. All new (polyphony has 0 existing work instances).

**Decision: CREATE NEW** work entities as children of the library entity.

| bundle id | composer | title | v4E properties used |
|---|---|---|---|
| tallis-spem | Thomas Tallis | Spem in alium | name, composer, original_language(Latin), genre(sacred,motet) |
| part-magnificat | Arvo Pärt | Magnificat | name, composer, original_language(Latin), genre(sacred,Estonian,tintinnabuli) |
| tormis-raua | Veljo Tormis | Raua needmine | name, composer, original_language(Estonian), genre(Estonian,runo) |
| kreek-onnis | Cyrillus Kreek | Õnnis on inimene | name, composer, original_language(Estonian), genre(Estonian,sacred,psalm) |
| esenvalds-stars | Ēriks Ešenvalds | Stars | name, composer, original_language(English), genre(Latvian,contemporary) |
| part-beatitudes | Arvo Pärt | The Beatitudes | name, composer, original_language(English), genre(sacred) |
| esenvalds-sleep | Ēriks Ešenvalds | Only in Sleep | name, composer, original_language(English), genre(Latvian) |
| byrd-ave | William Byrd | Ave verum corpus | name, composer, original_language(Latin), genre(sacred,English) |
| byrd-mass5 | William Byrd | Mass for Five Voices | name, composer, original_language(Latin), genre(sacred,English,mass) |
| hildegard-pastor | Hildegard von Bingen | O Pastor Animarum | name, composer, original_language(Latin), genre(sacred,plainchant) |
| whitacre-sleep | Eric Whitacre | Sleep | name, composer, original_language(English) |
| nystedt-immortal | Knut Nystedt | Immortal Bach | name, composer, original_language(German) |
| lauridsen-om | Morten Lauridsen | O Magnum Mysterium | name, composer, original_language(Latin), genre(sacred) |

**Schema gap note:** The bundle has `work.year` (composition year). v4E `work` has no `year` property — year belongs to `edition` (publication year). Composition year will be stored as `edition.year` on the "original" edition record, which is the closest available slot. This is schema-correct: `edition.year` = year of publication/edition, so e.g. "Tallis Spem in alium Chester Novello 1928" records 1928 on that edition.

**Idempotency:** Check `_type.string=work&_parent.reference=<library_id>&name.string=<title>` — if found, skip.

### 3.5 Editions → edition (CREATE NEW)

The bundle has 21 edition records across 13 works. All created as children of their respective work entity.

**Key schema gaps and resolutions:**

| Bundle field | v4E edition property | Resolution |
|---|---|---|
| `label` | `name` | Direct map |
| `voicing` | `voicing` | Direct map |
| `publisher` | `publisher` | Direct map |
| `year` | `year` | Direct map |
| `isbn` (UE-19400, FG-552, MB-2089) | no `isbn` property | Stored in `license_note` as "ISBN/catalogue: UE-19400" |
| `location` (Cabinet B · shelf 1, etc.) | no `location` property on edition | Stored in `notes` (available on `copy` not `edition`; see §3.6) |
| `limitless` (digital/unlimited copies) | no `limitless` property | Stored as `edition_type: "supplementary"` + `license_note: "unlimited — no physical copies"` |
| `total` / `on_loan` / `overdue` / `returned_today` | no copy-count properties | Derived from individual `copy` + `lending` entities (see §3.6) |

**`edition_type` mapping:**
All bundle editions are choral vocal scores. Use `edition_type: "vocal_score"` for all physical editions. For `limitless` editions (O Pastor Animarum, UE Magnificat with organ — actually physical), use existing totals; the `mag-org` edition has `total:0,limitless:true` so set as `supplementary`.

**Idempotency:** Check `_type.string=edition&_parent.reference=<work_id>&name.string=<label>` — if found, skip.

### 3.6 Copies → copy (CREATE NEW)

Each edition's `total` count maps to that many `copy` entities. Named "Copy #N", sequential `copy_number: N`.

**Location handling:** v4E `edition` has no `location` property. `copy` has `notes` (text). Location strings from the bundle (`"Cabinet B · shelf 1"`, `"Cabinet A · shelf 4"`, `"Cabinet C · shelf 2"`) will be stored in `copy.notes` on ALL copies of that edition (since location is edition-level in the bundle). Not ideal but pragmatic — no `location` property exists anywhere in the v4E copy/edition schema.

**Q [open for team-lead]:** Should we add `location: string` to `edition` in entu/research schema.ts? Or accept `copy.notes` as the location carrier for now? Polyphony-is-playground means we can work around it; but if the live-wiring CHORE needs queryable `edition.location`, we'll need the schema change.

**Copy counts:**
Total copies created = sum of `edition.total` across non-limitless editions:
- tallis-40: 12 copies
- tallis-8: 6 copies
- mag-ue (Pärt Magnificat UE): 30 copies
- mag-rh (Pärt Magnificat Hyperion): 24 copies
- raua-fg: 52 copies
- raua-pl: 18 copies
- onnis-sp: 42 copies
- stars-mt: 50 copies
- beat-ue: 32 copies
- sleep-mb: 48 copies
- ave-st: 60 copies
- mass5-cs: 24 copies
- wh-sleep: 56 copies
- im-no: 50 copies
- om-pe: 48 copies
- **Total: 552 copies** (plus 3 limitless editions with `total:0` → 0 copies each)

**Note on "returned_today" (Tallis tallis-40):** The bundle shows `returned_today:12` — all 12 copies are back. In v4E, "returned" means `lending.returned_at` is set. Since these copies are NOT currently on loan (they were returned TODAY in the mock), we model them with NO active lending entities. The "returned this morning" narrative is captured in `work.notes` text only; no time-stamped lending records for completed returns (would require retroactive data that complicates the seed and doesn't add value for UI smoke-testing).

**Idempotency:** Check `_type.string=copy&_parent.reference=<edition_id>&copy_number.number=<N>` — if found, skip.

### 3.7 Loans → lending (CREATE NEW, 4 active overdue)

Only 4 active lending records exist in the bundle (the 4 overdue Pärt Magnificat loans). All other `on_loan` counts reference non-bundle members (Whitacre Sleep has 6 on loan — but the bundle doesn't name who has them; Kreek Õnnis has 2 on loan).

**Decision:** Create lending records ONLY for the 4 explicitly named loans (Pärt Magnificat copies #14, #15 → Henn Kuusik; #22, #23 → Margus Roos). For the unnamed on-loan copies (Whitacre 6, Kreek 2), do NOT create lending records — the mock fixture renders `on_loan` as a count, not a list, for those editions. Creating 8 more unnamed lendings would require making up member identities.

| Copy | Member | Assigned at | Status |
|---|---|---|---|
| Pärt Magnificat UE #14 | Henn Kuusik (hk) | 2025-11-12 | on loan, overdue |
| Pärt Magnificat UE #15 | Henn Kuusik (hk) | 2025-11-12 | on loan, overdue |
| Pärt Magnificat UE #22 | Margus Roos (mr) | 2025-11-12 | on loan, overdue |
| Pärt Magnificat UE #23 | Margus Roos (mr) | 2025-11-12 | on loan, overdue |

- `assigned_at: 2025-11-12`
- `assigned_until`: not set (no due date in bundle data)
- `returned_at`: absent (still out)
- Parent: library entity (lending lives under library, not under edition/copy)

**Idempotency:** Check `_type.string=lending&_parent.reference=<library_id>&copy.reference=<copy_id>` — if found, skip.

**Teardown path:** All lending entities for the library can be deleted first, then copies, then editions, then works, then the library itself, then the 8 bundle-created members and their person entities. The script will include a `--teardown` flag for clean re-runs.

---

## 4. Reuse vs create summary table

| Bundle record | Decision | Rationale |
|---|---|---|
| EPCC choir | **REUSE** EFK (`69c7f8718489bfcb0e81b065`) | Same ensemble, different short name |
| EFK sections (S/A/T/B) | **REUSE** existing | Already exist; coarse grouping sufficient |
| 8 bundle members | **CREATE** person + member | Distinct from 54 existing seed members |
| Library | **CREATE** 1 library under EFK | None exists yet |
| 13 works | **CREATE** under library | No existing work instances |
| 21 editions | **CREATE** under works | No existing edition instances |
| 552 physical copies | **CREATE** under editions | No existing copy instances |
| 3 limitless editions | **CREATE** (0 copies, notes flag) | No existing |
| 4 overdue lendings | **CREATE** under library | No existing lending instances |
| Whitacre/Kreek on-loan counts | **SKIP** (no named borrower) | Cannot create lending without member identity |

---

## 5. Idempotency strategy

Script runs are check-then-create at every level:

1. **Library:** query `_type.string=library&_parent.reference=<EFK_id>` → if count>0, use existing `_id`
2. **Persons (8):** query `_type.string=person&name.string=<name>` → if found, use existing
3. **Members (8):** query `_type.string=member&_parent.reference=<EFK_id>` + `person.reference=<person_id>` → if found, skip
4. **Works (13):** query `_type.string=work&_parent.reference=<library_id>&name.string=<title>` → if found, use existing
5. **Editions (21):** query `_type.string=edition&_parent.reference=<work_id>&name.string=<label>` → if found, use existing
6. **Copies (552):** query `_type.string=copy&_parent.reference=<edition_id>&copy_number.number=<N>` → if found, skip
7. **Lendings (4):** query `_type.string=lending&_parent.reference=<library_id>&copy.reference=<copy_id>` → if found, skip

**Teardown (`--teardown` flag):** Deletes in reverse order: lendings → copies → editions → works → library → the 8 bundle members → the 8 bundle persons. Does NOT touch the 54 pre-existing EFK members or the EFK org entity itself.

---

## 6. Schema gaps and open questions

| Gap | Bundle field | v4E slot | Proposed resolution | Q for team-lead |
|---|---|---|---|---|
| Edition catalogue number | `isbn` (UE-19400, FG-552, MB-2089) | None on edition | Store in `edition.license_note` as "Catalogue: <id>" | Accept? |
| Physical location | `location` (Cabinet B · shelf 1) | None on edition or copy | Store in `copy.notes` for all copies of the edition | Accept for now? Or add `edition.location: string` to schema? |
| Limitless/digital editions | `limitless: true` | No flag | Set `edition_type: "supplementary"`, 0 copies, `license_note: "unlimited"` | Accept? |
| Unnamed on-loan copies | `on_loan: 6` on Whitacre | Would need member identity | Skip — do not create anonymous lendings | Agreed (no named borrower in bundle) |
| Work composition year | `work.year` (1570, 1989, etc.) | No `year` on work | Store in earliest/primary edition's `year` field | Accept? |

---

## 7. Privacy boundary register

| Data source | Classification | Decision |
|---|---|---|
| "Estonian Philharmonic Chamber Choir" (EPCC / EFK) | Real public organization | Acceptable — publicly named Estonian choir; already in polyphony as EFK |
| Veljo Tormis, Arvo Pärt, Cyrillus Kreek, Ēriks Ešenvalds, Thomas Tallis, William Byrd, etc. | Real deceased/public composers | Acceptable — public-domain attribution data |
| Maris Tamm, Liina Saar, Ave Lepp, Kärt Põld, Toomas Mägi, Andres Vahar, Margus Roos, Henn Kuusik | Synthetic Estonian-style names | Generated by Claude Design for the mock; not real individuals; acceptable |
| `@example.ee` emails | Not applicable | No emails in this dataset; no PII risk |
| Publisher names (Chester Novello, Universal Edition, Fennica Gehrman, etc.) | Real publishers | Acceptable — public commercial entities |

---

## 8. Entity counts (total creation plan)

| Type | Create | Reuse |
|---|---|---|
| organization | 0 | 1 (EFK) |
| library | 1 | — |
| person | 8 | — |
| member | 8 | — |
| work | 13 | — |
| edition | 21 | — |
| copy | 552 | — |
| lending | 4 | — |
| **Total new** | **607** | |

---

## 9. Seed script plan

**Script:** `scripts/migrations/seed-librarian-bundle-data.ts`
**Source manifest:** `scripts/migrations/seed-sources/librarian-bundle.json`
**Result artifact:** `scripts/migrations/seed-results/seed-librarian-bundle-<ISO-ts>.json`

Phases:
1. Auth + dry-run guard (use `isDryRun()` from perotin-toolkit)
2. Resolve EFK `_id` (lookup, error if not found)
3. Seed library (idempotent)
4. Seed 8 persons (idempotent by name)
5. Seed 8 members under EFK (idempotent by person+org)
6. For each work: seed work, then editions, then copies (idempotent at each level)
7. Resolve Henn Kuusik + Margus Roos member IDs (from step 5)
8. Resolve copies #14, #15, #22, #23 of mag-ue (from step 6)
9. Seed 4 lending records (idempotent by copy ref)
10. Write result artifact
11. (If `--teardown`): reverse deletion sequence

(*MVOX:Perotin*)
