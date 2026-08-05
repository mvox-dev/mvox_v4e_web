# Finn — Research Coordinator Scratchpad

<!-- Sessions 2–30 findings pruned 2026-06-14: all durable Entu mechanics, Path C architecture, OAuth wire shape, linting versions, etc. are captured in MEMORY.md (project_entu_*, project_cf_*, project_wrangler_*). See git history for full session records. -->

## Active / Durable findings (S41, single-collective pivot — multi-db platform topology)

### [LEARNED] Entu is one platform, many Mongo dbs = many "collectives" — single host, path-routed, no per-db registration gate

Source-verified `~/projects/entu-api`, full detail sent to team-lead (not restated here — see message thread for citations):
- **One shared `mongodbUrl` + one `jwtSecret`** for the whole deployment (`.config/nitro.ts:6-29`, `.env.example`). All "collectives" are separate Mongo databases on ONE connection, served by ONE Nitro host. DB selection is purely the URL's first path segment (`middleware/auth.js:21`, `middleware/mongodb.js:17`) — `<samehost>/<dbname>/entity/...`. No per-collective host/endpoint anywhere.
- **`/auth` (no `?db=` param) enumerates EVERY non-system db on the connection** (`routes/auth/index.get.js:132,141-144`) and adds an `accounts[dbName]` entry for each one where a matching `person` entity exists inside that specific db. **One token CAN span multiple collective-dbs** if the same OAuth identity has a person entity in more than one. Pass `?db=`/`?account=` at `/auth` time to scope a token to exactly one db.
- **No db-registration step for reads.** `connectDb` (`utils/mongodb.js:8-46`) just checks `listDatabases()` live — any Mongo db that exists on the connection with a valid name (`^[a-z][a-z0-9_]*$`, not a Mongo system db) is immediately usable. The only GATED creation path is the Stripe-billing `routes/new.put.js` → `initializeNewDatabase` (seeds from a literal `template` db) — irrelevant if a collective db is created by a raw Mongo-level clone of `polyphony` instead (which is what mvox's single-collective plan actually does).
- **`/refresh` does NOT re-enumerate dbs** — it only re-validates accounts already in the presented token (`routes/auth/refresh.get.js:106-133`). A new collective membership requires a fresh `/auth` call, not `/refresh`.

(*MVOX:Finn*)

---

## Active / Durable findings (S40, single-collective pivot — domain-sharing source verification)

### [LEARNED] `entu.userStr` (domain-tier gate) is per-db, gated by a genuine person entity in THAT db — source-verified, not doc-relayed

Full chain read directly from `~/projects/entu-api`, no repo doc used as authority (per team-lead's explicit instruction after the 2026-07-19 wrong-doc incident):
- `middleware/auth.js:21` — target db comes from the URL path segment, not the JWT.
- `middleware/auth.js:35-36` — ONE shared `jwtSecret` for the whole Entu platform (all dbs). Signature alone proves nothing about which db(s) a token is valid for.
- `middleware/auth.js:46-48` — `entu.userStr` is set ONLY if `token.accounts[urlDbName]` exists. No Bearer token at all → whole block skipped → `userStr` stays `undefined` (anonymous correctly excluded).
- `routes/auth/index.get.js:132` — `/auth` exchange enumerates **every Mongo db on the platform** (`listDatabases()`), and for each one independently checks (separate `connectDb` per db, line 145) whether a `person` entity matching this OAuth identity exists **inside that specific db**. `accounts` map only gets an entry for dbs where a real match was found (lines 141-190, 254).
- Same gate independently re-implemented for GraphQL: `utils/graphql/schema.js:109-111`.

**Bottom line for "db boundary = collective boundary":** holds — a user can't get `userStr` (and therefore domain-tier reads) in install Y just by being authenticated against install X; `accounts.Y` requires a real person entity in Y. **Nuance:** nothing stops the SAME identity from having a genuine person entity in TWO installs and getting BOTH in one JWT if `/auth` is called without a `?db=` param (line 124 `onlyForAccount`) — that's correct multi-membership, not a leak, but means "one JWT ⇒ one collective" isn't structurally enforced, only "one JWT ⇒ only collectives you're genuinely in." If the design needs strict one-JWT-one-db, force `?db=` at every `/auth` call.

### [LEARNED] Per-property `sharing` on a prop-def controls domain/public bucket placement — source-verified independently (not relayed from the 2026-07-19 doc, which agrees)

`utils/aggregate.js`: prop-def's own `_sharing` read via aggregation pipeline (`sharing: {$arrayElemAt:['$private._sharing.string',0]}`, line 86); capped by the owning type's `_sharing` (line 94, 113-121 — unset type `_sharing` ⇒ property never exposed at domain/public regardless of prop-def setting; `domain`-type caps a `public`-marked prop-def down to `domain`); written to buckets at line 148-154 (prop-def with no `sharing` never reaches `newEntity.domain`/`.public`, only `.private`); bucket retention double-gated again by the ENTITY's own `_sharing` at line 269-275. This is the exact mechanism a "contact info visible, sensitive fields private" per-field design on one person type depends on — confirmed real, not aspirational. Full context: `docs/migration/findings/entu-property-bucket-visibility-2026-07-19.md`, corroborated independently 2026-08-05.

**Standing practice reminder (recurrence of the 2026-07-19 lesson):** for Entu mechanics questions, read `~/projects/entu-api` source directly every time, even when a findings doc already seems to answer it — cite the doc as corroboration only, never as the basis.

(*MVOX:Finn*)

---

## Active / Durable findings (S38-39, issue #93 rights probes)

### [PATTERN] Non-omniscient second-account probe setup (reusable) — CORRECTED 2026-07-19, stale ID fixed

**Stale entity ID (corrected):** the "genuine 2nd OAuth admin" person I previously cited, `6a2f3f964cd971291c5d5ca2` ("Mihkel Putrinš by Gmail"), is **deleted — 404s as of 2026-07-19**. The PO's second Google OAuth account re-provisioned under a new id: `6a2fc05e4cd971291c5d5ddc` (same Google uid, `_sharing:domain`, has `entu_user`). Any doc still citing the old id (including `slice3-list-visibility-definitive-2026-06-15.md`) is now referencing a deleted entity.

**Credential-synthesis technique — UNRESOLVED, do not treat as reliable.** The pattern was: POST `entu_api_key` onto an OAuth-linked person, exchange for JWT, get a properly account-bound in-domain credential. Pérotin's session-39 scratchpad recorded this failing **twice** on this exact technique — `entu_api_key` on a person yielded `accounts:[]` (unbound/anonymous), "regardless of whether that person has OAuth." On 2026-07-19 the identical technique on the identical person (`6a2fc05e4cd971291c5d5ddc`) yielded a properly bound JWT. Both results are internally consistent and neither has been retracted — this is a live, unreconciled contradiction, not a settled "it works now." Full writeup + a live hypothesis (seeded person → unbound vs. genuinely-OAuth-bound person → bound, untested) at `docs/migration/findings/entu-property-bucket-visibility-2026-07-19.md` flagged discrepancy #4. **Don't cite this technique as a reusable pattern without re-running a controlled probe first.**

The rest of the original entry (auto-provisioned persons get `_sharing:domain` by default; the two-key `ENTU_API_KEY`+`ENTU_ADMIN_KEY` env pattern) still stands and is unaffected by the above.

(*MVOX:Finn*)

---

## Active / Durable findings (S38-39 continued)

### [LEARNED] `_sharing` is `_owner`-tier, not `_editor`-tier (source-verified S38)

`entu/api` source is cloned locally at `~/projects/entu-api` (not entu-research — separate repo). `routes/[db]/property/[_id]/index.delete.js` and `utils/entity.js` both define a `rightTypes` array — `['_noaccess','_viewer','_expander','_editor','_owner','_sharing','_parent','_inheritrights']` — and gate any POST/DELETE touching a property whose `type` is in that list behind `_owner` membership (`403 User not in _owner property` otherwise). `_editor` can freely POST/DELETE ordinary (non-rights) properties and LIST the entity, but cannot touch `_sharing`, `_viewer`, `_owner`, `_editor`, `_parent`, or `_inheritrights` values, and cannot `DELETE /entity/{id}` (needs `_owner`). Verified by reading the route file directly (grep for `rightTypes` in `~/projects/entu-api`).

### [LEARNED] No entity-to-entity `_viewer`/`_owner`/`_editor` grants — person-only, no group primitive

Every observed `_viewer`/`_editor`/`_owner` reference in the codebase and in live probes points at a PERSON `_id`, never an organization or other entity. `docs/migration/findings/member-tier-rights-visibility-2026-06-12.md` confirms mechanically: POSTing `_viewer` referencing a person's `_id` works and grants that person read access; anonymous/non-matching JWTs still get 403. No probe or source reference found where a rights property references a non-person entity to create transitive "anyone in org O can see this" access. The **only** transitive-visibility primitive in v4E is the `_inheritrights` parent→child cascade (see `architecture-decisions.md` "Entities created directly under an organization MUST set `_inheritrights:true`"). If a design needs "org members can resolve person X's name," it must either (a) grant `_viewer` to each person individually, or (b) restructure via `_parent`/`_inheritrights` cascade — there is no org-as-viewer shortcut.

### [LEARNED] CORRECTED 2026-07-19 — Per-property `sharing` IS first-class; `_sharing` gates three write-time buckets, not existence-only

**My prior entry here was wrong.** It relied on `docs/migration/v4e-divergence-2026-05-19.md` §5.2 ("per-property sharing not a first-class Entu concept") without checking `~/projects/entu-api` source directly. That doc's claim is itself wrong and is now formally superseded. Team-lead relayed my wrong version to the PO twice on #93 before a live probe caught it — the doc looked authoritative and I didn't verify it against source, which is exactly the failure this correction exists to prevent.

**The actual model** (full citations in `docs/migration/findings/entu-property-bucket-visibility-2026-07-19.md` — cite that doc, don't restate this summary as if independently re-derived):
- Per-property sharing lives on the **property-definition** entity's own `sharing` field (`private`/`domain`/`public`), not on instance values.
- At write time, `aggregateEntity` (`utils/aggregate.js`) builds three buckets (`private`/`domain`/`public`) per entity. A property's bucket placement = its definition's `sharing`, **capped** by the entity type's own `_sharing` (a `domain`-shared type downgrades a `public`-shared property to `domain`; an unshared type exposes nothing at domain/public tier regardless of what the property definition says).
- At read time, `cleanupEntity` (`utils/entity.js:569-612`) returns exactly ONE whole bucket based on the reader's rights: explicit grant → full `private` bucket; else authenticated + domain access → full `domain` bucket; else public access → full `public` bucket; else 403 "No accessible properties."
- **This means a reader who matches the `domain` or `public` tier gets a real property leak (e.g. `name`), not just a signal that the entity exists.** My original "entity-level only, existence-signal only" framing was categorically wrong.
- **Load-bearing gotcha:** buckets are write-time snapshots. Changing a property definition's `sharing` does NOT retroactively update already-aggregated instances — `startRelativeAggregation` only re-triggers on name/rights/formula changes to the changed entity itself, never propagates from a definition edit to that type's instances. A stale bucket persists until something else writes to that specific instance.

**Standing lesson for me:** repo docs (`docs/migration/*.md`, findings docs, even architecture-decisions) are convenience summaries, not ground truth for Entu mechanics — `~/projects/entu-api` source is the authority. When a question is about a specific Entu behavior (not just "what did the team decide"), read the source directly before reporting, even if a findings doc already seems to answer it.

(*MVOX:Finn*)

---

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
