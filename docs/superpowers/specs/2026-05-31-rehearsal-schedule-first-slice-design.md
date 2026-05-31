# Design Spec — "Lay out the rehearsal schedule" (first buildable slice)

- **Date:** 2026-05-31 (session 28)
- **Status:** Draft — awaiting PO review
- **Author:** Palestrina, with data-model verdict by Bentham + AC by Victoria
- **Domain:** Rehearsal / concert / season / RSVP — *conductor/admin-first* surface
- **Schema basis:** v4E `schema.ts` (verified by Bentham): `season` L626, `event_series` L663, `event` L726, `organization` L151. No schema mutation required — this builds to an already-landed shape (schema-alignment carve-out; **no `Schema-Change` trailer needed**).

---

## 1. Why this slice

The conductor/admin "create" side of the season is where the v4E data model already has the most design landed, and where mvox currently has **zero** wiring. Existing GitHub issues (#19 create-season, #20 create-event) are thin shells: they describe *create* but not the screen a conductor actually lives in. This slice delivers the first coherent end-to-end conductor flow:

> **Open a season → define a recurring rehearsal series → the individual rehearsals are generated → see them as a list → cancel/edit a single one → or delete the whole series.**

It is deliberately the smallest slice that feels like a real product: a conductor can sit down and lay out a term's worth of Tuesday rehearsals, then manage them.

## 2. Scope

### In scope (6 capabilities)

1. **Create season** — `season` entity under the org.
2. **Create rehearsal series** — recurring `event_series` (`event_type = rehearsal`) under the season.
3. **Generate event instances (eager)** — BFF materialises one `event` per occurrence at series-creation time.
4. **View the rehearsal list** — the conductor's primary screen.
5. **Cancel / edit a single instance** — delete one rehearsal, or override one rehearsal's fields.
6. **Delete the series (cascade)** — best-effort delete of all generated events, then the series.

### Out of scope (deferred to later slices)

- Concerts + **programs** (`program_item`) and **repertoire** (`repertoire_item`).
- **RSVP** (singer side) + **attendance** recording.
- **Editing the series *pattern*** after creation, and the **regeneration** logic that implies (re-materialising on pattern change).
- **Section-scoped** series (the optional `section` parent) and **public/private visibility toggles** on individual events.
- **Singer-facing** views of the schedule.
- **Per-org timezone** configuration (hardcode `Europe/Tallinn` for v1 — see §5).

## 3. Data model (verified against v4E `schema.ts`)

| Entity | Parents | Key props (this slice) | `_sharing` (instance) | Create right |
|---|---|---|---|---|
| `season` | `organization` (req) | `name`, `start_date`, `end_date` (req); `description` (opt) | `public` | `_owner` on org |
| `event_series` | `organization` (req) + `season` | `name`, `event_type=rehearsal`, `interval_days`, `start_time` (`"HH:MM"`), `duration_minutes`, `start_date`, `end_date` (req); `default_location`, `default_description` (opt) | `private` | `_editor` |
| `event` | `organization` (req) + `season` + `event_series` | `start_datetime` (req); `name`/`event_type`/`duration_minutes`/`location`/`description` inherited from series if unset | `private` | `_editor` |

**Explicit `_sharing` at create (mandatory).** Per `project_entu_sharing_non_inherit`, the BFF sets `_sharing` on every POST — Entu does not inherit it. season=`public`, series=`private`, event=`private` (matches schema instance-default notes).

### 3.1 Rights cascade — the load-bearing invariant

`organization` is the **only** `inheritsRights: false` entity in the schema (the rights "island"). `season`, `event_series`, and `event` are all `inheritsRights: true`. Therefore:

- Granting the conductor **`_editor` on the season** cascades down to its `event_series` and all generated `event`s automatically.
- The demo persona needs **exactly two explicit grants**: `_owner` on the org (admin, to create the season) + `_editor` on the season (conductor, to run rehearsals). In a single-person demo these are held by the same user.
- **Do NOT mint per-event `_editor` grants.** They are redundant (rights already cascade from the season) and would pollute the membership-rights-pairing audit. This must be encoded so Tallis tests the cascade and no one "helpfully" adds per-event grants.
- The org island stops any of this leaking *up* to an umbrella org.

### 3.2 Inheritance is BFF logic, never a formula

Event fields left unset (`name`, `event_type`, `location`, `description`, `duration_minutes`) fall back to the parent series' values **at read time, in the BFF** — the schema declares these as notes, not as `formula` properties. **RED trap to avoid:** do not "optimise" any inherited field into an Entu `formula` (e.g. `event_series.*.default_location`). The formula evaluator bypasses rights, and these are raw strings — projecting a `private` series' `default_description` onto an event read would leak across the rights boundary. Inheritance stays in the BFF merge.

## 4. Materialisation algorithm (eager)

On successful `event_series` creation, **synchronously within the BFF response cycle** (no background job in v1):

1. Compute occurrence dates: start at series `start_date`, step by `interval_days`, collect every date `<= end_date`. Count is deterministic: `floor((end_date − start_date) / interval_days) + 1`.
2. For each occurrence, POST one `event`:
   - `_parent` = org + season + the new series
   - `event_type = rehearsal`
   - `start_datetime` = occurrence date combined with series `start_time` (see §5 for timezone)
   - `duration_minutes` = series value
   - `location` = series `default_location` (may be absent)
   - `description` = series `default_description` (may be absent)
   - `_sharing = private`
3. The series-create response (201) returns only after all events are created.

**Partial failure (no rollback in v1):** if an event POST fails mid-batch, the BFF returns 500 and reports how many events were created before the failure. The conductor deletes the partial series (Capability 6) and retries. Acceptable for v1; a transaction/rollback is a later concern. Flag for `test-gaps.md`.

**Scale:** a weekly Sep→May season ≈ 35 events = ~35 serial Entu POSTs as the authenticated conductor (user-rights default, **not** an elevated op — the user could do each POST by hand in any Entu frontend). Fine for v1; batching is a future UX optimisation, never a reason to elevate.

## 5. Time handling (DST-correct)

The series stores wall-clock local time as a string (`start_time: "19:00"`); each `event.start_datetime` is a real `datetime`. A weekly Sep→May series **crosses the EET↔EEST daylight-saving boundary twice**, so naive `date + "19:00"` arithmetic would drift the displayed time.

**Decision:** the series time is interpreted as **wall-clock in `Europe/Tallinn`**. At materialisation, the BFF computes, for each occurrence date, the UTC instant corresponding to `19:00` local **on that date** (DST-aware), and stores `start_datetime` as UTC. The UI converts back to local for display. Result: a rehearsal reads **19:00 in winter and 19:00 in summer**.

`Europe/Tallinn` is **hardcoded for v1**; a per-org timezone field is a deferred enhancement. (Implementation note for the plan: use a DST-aware conversion available in the Cloudflare Workers runtime, e.g. `Intl.DateTimeFormat` with `timeZone`, or a tz-aware date utility — not raw offset math.)

## 6. UI / route shape

- New top-level route **`/seasons`** = the conductor's home: create a season, see the org's seasons, drill into one.
- **Org** comes from the existing nav picker (`selectedOrgIdStore`), as everywhere else in the app.
- The **selected season** rides in the URL as **`?season=<id>`**, consistent with the library's existing `?work=<id>` pattern and the **URL-overrides-persisted** architecture rule.
- The rehearsal list renders server-side (`+page.server.ts` load).
- Past rehearsals are shown but visually de-emphasised (not hidden).
- This slice shows **no** RSVP counts, attendance, or programme.

## 7. Acceptance criteria

> Rights note for all capabilities: singer (no `_editor`/`_owner`) → 403 on every write below.

### Capability 1 — Create season *(updates #19 ADMIN-1)*
Right: `_owner` on org.
1. Form fields: `name` (req), `start_date` (req), `end_date` (req), `description` (opt).
2. `end_date >= start_date` — BFF validates; 400 + field-level `end_date` error on violation; UI shows inline error without clearing other fields.
3. `name` not blank/whitespace-only — BFF validates; 400 + `name` error.
4. On success: create `season` with `_parent = org`, `_sharing = public`; respond 201 with `_id`.
5. New season appears in the org's season list ordered by `start_date`.
6. Non-`_owner` POST → 403.
7. Empty state: no seasons → admin sees "create your first season" CTA; non-admin sees "Season not yet set up."
- **Tests:** valid → 201; `end<start` → 400 (`end_date`); `end=start` → 201; blank name → 400 (`name`); non-owner → 403.

### Capability 2 — Create rehearsal series *(updates #20 ADMIN-2, series half)*
Right: `_editor` (or `_owner`) on org/season.
1. Form available only within an existing season context (Capability 1 gates it).
2. Required: `name`, `interval_days` (int ≥ 1), `start_time` (`HH:MM` 24h), `duration_minutes` (int ≥ 1), `start_date`, `end_date`. Optional: `default_location`, `default_description`.
3. `event_type` is fixed to `rehearsal` — not user-selectable; BFF enforces (any other value in payload silently forced to `rehearsal`).
4. Series `start_date`/`end_date` must fall within the parent season's range — BFF validates; 400 otherwise.
5. `end_date >= start_date` — BFF validates; 400 on violation.
6. On success: create `event_series`, `_parent` = org + season, `_sharing = private`; respond 201 with `_id`, then run Capability 3.
- **Tests:** valid → 201; `interval_days` 0 / −1 → 400; series `start_date` < season start → 400; series `end_date` > season end → 400; singer → 403; `event_type` override → forced to `rehearsal`.

### Capability 3 — Generate event instances (eager) *(NEW — file ADMIN-6)*
Right: same as series creator. Trigger: synchronous on series create.
1. Occurrence dates computed per §4; count = `floor((end−start)/interval_days)+1`.
2. Each `event`: `_parent` = org+season+series; `event_type=rehearsal`; `start_datetime` per §5; `duration_minutes` from series; `location`/`description` from series defaults (may be absent); `_sharing=private`.
3. Partial failure → 500 + count created before failure; no rollback (§4).
4. Manually deleted events are never recreated (no regeneration in this slice).
- **Tests:** `2026-09-01`→`2026-09-29` step 7 → 5 events on 09-01/08/15/22/29; single-day (`start=end`) → 1 event; `start`→`start+7` step 7 → 2 events (boundary inclusive); each event's `start_datetime` correct incl. **a winter and a summer occurrence both displaying 19:00** (DST regression test); `_parent` includes org+season+series; `event_type=rehearsal`; `_sharing=private`.

### Capability 4 — View rehearsal list *(NEW — file ADMIN-7)*
Right: `_editor`/`_owner`. Singer view out of scope.
1. Route `/seasons` with `?season=<id>`; list rendered in `+page.server.ts`.
2. BFF queries `event` where `_parent` includes org, `event_type=rehearsal`, scoped to the selected season; ordered by `start_datetime` asc.
3. Each row: date (locale-formatted), time, `duration_minutes`, `location` (or "—"), series name.
4. Grouped by `event_series` (series name as section header); any standalone events under "Ungrouped."
5. Past events visible but de-emphasised.
6. Empty state: no rehearsals → "No rehearsals scheduled yet" + CTA to create a series.
7. No RSVP/attendance/programme shown.
- **Tests:** ordered by `start_datetime` asc; filtered to `event_type=rehearsal` (concerts excluded); empty → 200 + empty array (not 404). **Playwright (deferrable):** conductor → list → events grouped by series with correct dates.

### Capability 5 — Cancel / edit a single instance *(NEW — file ADMIN-8)*
Right: `_editor`/`_owner`.
**5a. Cancel (delete) one event:**
1. Conductor selects one rehearsal → confirm cancel.
2. BFF `DELETE /entity/{eventId}`.
3. Sibling events (same series) unaffected; series entity not deleted.
4. Deleting the last event in a series leaves the series (orphaned series is a valid v1 state).
5. Deleted row disappears from the list (re-fetch or optimistic removal).
- **Tests:** delete → 200, siblings remain; singer → 403; non-existent `_id` → 404.

**5b. Edit one instance (override inherited fields):**
1. Select one rehearsal → edit form pre-populated with current (effective) values.
2. Editable: `start_datetime`, `duration_minutes`, `location`, `description`. Not editable: `event_type`, `_parent`.
3. BFF replaces the property values (clear existing `_id`s then POST new — Entu POST-appends semantics, `project_entu_post_appends_multi_value`).
4. Edited instance keeps its overrides across reloads — does not re-inherit series defaults.
5. Siblings unaffected.
6. Series-level fields are not editable here (deferred).
- **Tests:** PATCH `location` → GET reflects it, siblings unchanged; PATCH `start_datetime` → override holds, siblings at original times; singer → 403; non-existent → 404.

### Capability 6 — Delete series (cascade) *(NEW — file ADMIN-9)*
Right: `_editor`/`_owner`. **PO-requested addition.**
1. Conductor selects a series → confirm delete (confirmation states "this will delete the series and its N rehearsals").
2. BFF fetches all `event`s whose `_parent` includes the series.
3. BFF deletes the child events **first**, serially (`DELETE /entity/{eventId}` each — Entu has no bulk delete, `project_entu_no_bulk_delete`), tracking success/failure per event.
4. **All children deleted** → BFF deletes the `event_series` entity → 200 with deleted count.
5. **Partial failure** (some event deletes fail) → BFF **keeps the series**, returns a partial result: "deleted X of N rehearsals — retry to finish." This prevents orphaned events pointing at a deleted-series parent.
6. Best-effort semantics (PO: "attempt to delete all generated events too"): a retry re-fetches remaining children and continues.
- **Tests:** delete series with N events, all succeed → series + all N gone, 200 + count N; singer → 403; simulated mid-batch event-delete failure → series NOT deleted, partial count reported, remaining events still queryable; retry after partial → completes.

## 8. Open questions / probes before implementation

1. **Delete rights:** this spec assumes `_editor` (cascaded from the season) suffices to `DELETE` an `event` and an `event_series`. If Entu requires `_owner` for entity deletion, Capabilities 5a/6 need the org-admin right instead. **Probe on the live polyphony playground (Pérotin) before the GREEN phase** — create a throwaway series+events as an `_editor`-only persona and attempt delete.
2. **Series→season date containment** (Capability 2 AC4): confirm we want a hard 400, vs a soft warning, when a series spills outside the season's dates. Spec currently says hard 400.
3. **Partial-failure UX** (Capabilities 3 + 6): v1 surfaces a count and asks for retry. Confirm no rollback is acceptable for first ship.

## 9. Issue disposition (Victoria; team-lead files after PO approves this spec)

| Capability | Action |
|---|---|
| 1 Create season | **Update #19** (replace stub AC) |
| 2 Create rehearsal series | **Update #20** (append series AC, narrow scope to rehearsal) |
| 3 Generate events (eager) | **File ADMIN-6** |
| 4 View rehearsal list | **File ADMIN-7** (the "primary screen" gap) |
| 5 Cancel/edit single instance | **File ADMIN-8** (5a + 5b; split only if they land in different cycles) |
| 6 Delete series (cascade) | **File ADMIN-9** (PO-requested) |

Recommended labels: `admin`, `conductor`; no milestone (consistent with #19/#20).

## 10. Deferred follow-ups (for `test-gaps.md` / later slices)

- Series **pattern editing + regeneration** with a cancelled-dates ledger (Bentham YELLOW-1).
- Materialisation **rollback / transaction** on partial failure.
- **Per-org timezone** field (replacing the hardcoded `Europe/Tallinn`).
- Singer-facing schedule + **RSVP** + **attendance** (the next slices).
- Concert events + **programme** + **repertoire**.

---

*(*MVOX:Palestrina*) — data-model verdict (*MVOX:Bentham*), acceptance criteria (*MVOX:Victoria*)*
