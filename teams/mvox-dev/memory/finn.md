# Finn — Research Coordinator Scratchpad

<!-- Sessions 2–30 findings pruned 2026-06-14: all durable Entu mechanics, Path C architecture, OAuth wire shape, linting versions, etc. are captured in MEMORY.md (project_entu_*, project_cf_*, project_wrangler_*). See git history for full session records. -->

## Active / Durable findings (S32–S37)

### [LEARNED] `_inheritrights` absent = false — source-verified (S37)

**Source:** `entu/api/utils/aggregate.js`, `aggregateEntity()` (read via gh API 2026-06-15):

```js
if (newEntity.private._parent?.length > 0 && newEntity.private._inheritrights?.at(0)?.boolean === true) {
    parentRights = await getParentRights(...)
}
```

Strict `=== true` check — absent property → `undefined !== true` → no parent rights pulled. **Absent = does NOT inherit.** Must be explicitly `true`.

Child re-aggregation also confirms: only children where `_inheritrights.boolean === true` are re-queued when a parent's rights change.

**Create-time propagation** (`utils/entity.js`, `inheritParentProperties()`): `_inheritrights: true` is written onto a new entity only if a parent has it `true`. If parent is an org (`_inheritrights: false`), child gets ABSENT → effectively false. This means **events created under an org without explicit `_inheritrights: true` do NOT inherit org rights**.

**Wall semantics:** `_inheritrights: false` blocks upward lookup (entity does not pull from its parent), but does NOT block downward propagation (the entity's own grants still cascade to children that have `_inheritrights: true`).

**`add_user` on database entity** (S36): controls whether new OAuth sign-ins auto-create a `person`. Reference property pointing to parent container. Default = absent (no auto-create). Explicit `=== true` gate in `createUserForAccount`. Auto-created persons get `_editor: self`, NOT `_owner: self`.

(*MVOX:Finn*)

---

## Active / Durable findings (S32–S36)

### [LEARNED] v4E entity shapes — invitation/application/member/rsvp/attendance (S32)

- **`rsvp`**: parent=`person`, `_sharing: private`, creator=`{kind: 'self'}`. Props: `event` (ref, req), `member` (ref, req), `status` (`going|not_going|maybe`, req), `notes`. Person sees own ONLY — conductor RSVP summary requires BFF elevated rights, NOT user-rights direct query.
- **`invitation`**: parent=`organization`, `_sharing: private`, creator=`{kind: 'parent_right', right: '_owner'}`. Props: `email`, `sections[]` (ref, optional), `token` (UUID), `expires_at`, `inviter` (system), `message`. No `status` — deleted on acceptance. Accept flow = BFF atomic: create member + delete invitation + delete application.
- **`member`**: multi-parent (org required + section optional), instance default `sharing: private`. Creator=`{kind: 'bilateral'}`. Props: `person` (ref, req), `current_section` (ref, optional), `status` (`active|archived`, req).
- **`attendance`**: parent=`event`, `_sharing: private`, creator=`{kind: 'parent_right', right: '_editor'}`. Props: `member` (ref, req), `status` (`present|absent|late`, req), `notes`.
- **`event_type` enum** (on `event` and `event_series`): `rehearsal|concert|festival|retreat|workshop|meeting|social|other` — NOT separate entity types.
- **`rsvp_lockout_hours`** lives on `organization`, not on `rsvp` or `event`.
- Event series→event field inheritance is BFF-mediated, not Entu-native.

(*MVOX:Finn*)

---

### [GOTCHA] OAuth callback JWT is CLIENT-TAINTED (S32)

`src/routes/auth/callback/+page.server.ts` `load` reads `key` from `url.searchParams` (browser-supplied) and writes verbatim to `mvox_session` cookie. `isSessionValid` only checks `exp` via unverified JWT decode — no signature/issuer/audience check.

Attack path: `/auth/callback?key=<crafted-JWT>` → server trusts it. `mvox_session` is a SOFT GATE only. Cannot be trust anchor for identity claims in elevated endpoints (e.g. `/api/reports/rsvp-summary`).

Remediation options: (A) Re-exchange with Entu at cookie-set time; (B) service-entity API key (rejected, Path A); (C) server calls Entu at issuance, stores Entu-verified personId in HMAC-signed cookie.

(*MVOX:Finn*)

---

### [LEARNED] Slice-3 feat/invite-join branch — state at S35 conserve

Branch `feat/invite-join` (tip `8b5ec86`, origin pushed), Bentham-GREEN. 1127/1127 unit tests, `pnpm check` 0. NOT merged — blocked on #91 architecture decision.

Reusable: `createInvitation`/`createApplication` patterns, `CopyLink.svelte`, `InviteForm.svelte`, MvoxNav Members tab, i18n keys.

**`CopyChip.svelte` is NOT clipboard**: props `{ n: string; checked: boolean }` = pencil-checkbox attendance cell. The invite-link clipboard component is `CopyLink.svelte` (new, built in the branch).

**`createEntity` + `EntuProp` not exported from entuSeasons.ts**: both are private to that module. New data modules must declare own `authHeaders` + inline POST-to-`/entity`. `rsvpData.ts` is the canonical exemplar.

(*MVOX:Finn*)

---

### [LEARNED] #91 architecture tension — three keyless options (S35)

Core blocker: `application._sharing: private`, parent = person entity, NO `person` prop (identity via `_parent`). `_inheritrights: false` on org = private application invisible to org admin.

Three options without an API key:
1. `application._sharing: domain` — leaky at multi-org scale
2. Singer POSTs explicit `_viewer` grant on application to org owners — needs probe: does viewer-granted private entity appear in list queries?
3. Add `invitation.person` reference property + remove `application` entity entirely

(*MVOX:Finn*)

---

### [LEARNED] Entu formula engine — complete (S32, source-verified)

23 operators. Output types: string, number, boolean ONLY — no JSON/array output.

Variadic reducers: CONCAT, CONCAT_WS, SUM, SUBTRACT, MULTIPLY, DIVIDE, COUNT, AVERAGE, MIN, MAX, IN, NIN. Binary (arity 2): EQ, NE, GT, GTE, LT, LTE. Per-value: ABS, ROUND. Other: EXISTS (1), IF (3), WHEN (2).

**Filtered/grouped COUNT is ABSENT.** `opCount` sees flat primitives only. `_referrer.rsvp.status 'going' EQ COUNT` = always 1. Sentinel-ref workaround is only path. Reverse-ref `_referrer.TypeName.prop` matches ANY property holding a reference to entityId — not property-name-specific.

(*MVOX:Finn*)

---

### [DEFERRED] /library filter voicing/language field name mismatch (S26, still open)

`work.voicing` fetched but v4E schema field is `original_voicing`; `work.language` fetched but schema field is `original_language`. Live DB probe needed before filter UI lands.

(*MVOX:Finn*)

---

## [CHECKPOINT] 2026-06-14 — S36 Carus/Sven tone-calibration

### [LEARNED] PO's publisher-outreach register (for future About/outreach copy)

From Carus thread (`19e3f59f52444354`, 10 msgs, 2026-05-11 to 2026-06-02) and "isiklik" letter to Sven Peterson (`19e27cc9ff5325f3`, 2026-05-14).

**PO's register when owning a misstep** — key markers:
- Names the mission first, then the failure
- Owns specific action ("I had typeset... I have since stopped")
- Defers to the other party on terms ("you know your catalogue")
- Frames the conversation as a choice, not forced disclosure ("I personally chose to bring it there")
- No hedging verbs, no passive constructions

**Verbatim exemplars (English, Carus thread):**
> "We acknowledge that the above constitutes actionable infringement on Carus's catalogue, and would very much like to settle it in a friendly manner. We are not proposing terms ourselves -- you know your catalogue and what would feel right; we welcome your suggestion."

> "The conversation -- with you, with Ute before -- is on the table because I personally chose to bring it there. The Sven Peterson trigger was the visible cause; the deeper motivation was to raise awareness and seek a better future."

> "I will personally donate development hours from my software-engineering profession toward building the infrastructure, as a small way to compensate for the mess I caused on the ¡NI side."

**Carus's warm-response language (Adelheid Dücker):**
> "We are pleased that you address the copyright infringement openly and proactively and are seeking a resolution."
> "We realize that without your initiative, we would not be aware of this issue, and we greatly appreciate your efforts to raise awareness among choirs about illegal copying."

**"isiklik" letter — human-level register (Estonian, key sentence):**
> "Et Sa teaksid, et kuiva korrektsuse taga on missiooniga inimene." ("So that you'd know that behind the dry correctness is a person with a mission.")

**Avoid in public copy:** legalistic scope-qualification ("infringement scope", "quantum"), victim-posture/budget framing ("terrible hole in our budget"), naming specific disputes or third parties.

(*MVOX:Finn*)
