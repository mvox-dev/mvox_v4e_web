# Finn — Research Coordinator Scratchpad

<!-- Pruned 2026-08-06 (S43): S32-39 detail compressed to bullets below; full text in git
history of this file. S2-30 already pruned 2026-06-14 — durable facts live in MEMORY.md. -->

## [GOTCHA] 2026-08-06 (S44) — `probe-person-sharing-census-2026-07-19.ts` has a field-name
bug that silently reports 0/21 person prop-defs sharing-shared when the REAL number is 21/21

Script queries HTTP `props=name,sharing` (script:105,111). Entu's real system field is
`_sharing` (underscore). `sharing` (no underscore) matches no property on any entity — the
query silently returns null for every def. **False negative, not true absence.** Verified
by re-querying the same defs with `props=name,_sharing`: person TYPE + **all 21** person
prop-defs (incl. `email`, `preferred_contact_email`) carry `_sharing: domain`. Per
`entu-api/utils/aggregate.js:94,112-121,148-149,269-275`, this means a domain-tier person
entity's `email` value (when set) IS written into and retained in its domain bucket, and
IS returned to any authenticated non-owner reader (`cleanupEntity`,
`entu-api/utils/entity.js:573-586`). Live proof point: person `6a2fc05e4cd971291c5d5ddc`
(domain-tier) has `email` set — its domain bucket contains it right now. **Reverses the
"nothing readable at domain tier" conclusion drawn from the buggy census** — flagged
urgently to team-lead 2026-08-06, since that conclusion may already have reached the PO.
Fix the script (`props=name,_sharing` + read `.` `_sharing` not `.sharing`) before anyone
reruns it for provenance again.

## [CHECKPOINT] 2026-08-06 (S43) — T4.2/#23: invite bind = TOKEN-POSSESSION, not identity-match

Full citations sent to team-lead (message thread), not restated here. Core facts:

- Admin-set `entu_user.string = invitee_email` at person-create is **deleted synchronously**
  and replaced by `entu_user.invite` (a 7-day JWT keyed `{db, entityId}`, no email) —
  `entu-api/utils/entity.js:462-466`. Email never persists for later comparison.
- Redemption = `/auth?invite=<jwt>` post-OAuth (`entu-api/routes/auth/index.get.js:198-233`).
  Binds whoever's OAuth session is active — no email check anywhere in this path.
  Gate is redeem-once (`findStoredInvite` returns null once consumed), not email-match.
  **A forwarded link redeemed by a different email BINDS, doesn't refuse** — this is
  forced by entu-api's mechanics, not a design choice mvox can make either way.
- The email-string identity-match path that DOES exist elsewhere in `/auth`
  (`entu-user.string === session.user.email`, lines 164-183) is structurally dead for
  invite-created persons, because step 1 already deleted `.string`.
- **Citation fix needed on #21/#23**: `src/lib/auth/guard.ts:44` doesn't exist. Real gate
  is `src/lib/server/auth/session-cookie.ts:46` `isProtectedPath()`, wired via
  `src/hooks.server.ts:9`.
  - **⚠️ SUPERSEDED 2026-08-06 (team-lead annotation): this finding was WRONG — read from the
    HARVEST repo (`~/workspace` = mvox_v4e_web), not the work repo. In mvox-app the `/invite/`
    allowlist is `src/lib/auth/guard.ts:43` (off-by-one on the line, not the file). `session-cookie.ts`
    / `hooks.server.ts` do NOT exist in mvox-app (no server; `ssr=false`). Correcting the origin so it
    can't re-propagate. Lesson: mvox-app citations are against `~/workspace-app`, not `~/workspace`. (*MVOX:Palestrina*)
- **Two invite mechanisms now coexist in-repo**: the entu-native `entu_user`+JWT one above,
  and an OLDER, unrelated one already live at `src/routes/invite/[token]/+page.svelte`
  (client-decoded self-describing token → `application`/`invitation` entities, from parked
  `feat/invite-join`). T4.5 builder must explicitly decide repurpose/replace/delete — don't
  let both run.
- T4.8 secondary: confirmed NO field on `person` is readable-by-others once the pivot lands
  (`entu_user` private+system; `email` private+"never for identity"; `name` moves to
  lazily-created profile entities). The empty-profile-username fallback has no source —
  needs a T4.3 follow-up (either keep a domain-visible name-equivalent on `person`, or drop
  the fallback requirement).

**[GOTCHA] cwd trap:** this Bash tool's default cwd (`/home/ai-teams/workspace-app`) is a
DIFFERENT git repo (remote `mvox-dev/mvox-app.git`, GitHub org+repo `gh` resolves against)
from this one (`~/workspace`, remote `mvox_v4e_web.git` — same codebase under an old/redirected
name, but a distinct local `.git`). An absolute-path Write without an explicit
`~/workspace/...` prefix lands in the wrong repo silently (it has its own `.git`, so no
error, just a stray untracked file nobody else sees). Always spell out
`~/workspace/teams/mvox-dev/memory/finn.md` in full — never assume bare cwd.

(*MVOX:Finn*)

---

## Active / Durable findings (S40-42, single-collective pivot — source-verified)

- **Entu = one platform, many Mongo dbs.** One shared `mongodbUrl`+`jwtSecret`
  (`.config/nitro.ts:6-29`). `/auth` (no `?db=`) enumerates EVERY db (`listDatabases()`)
  and adds `accounts[dbName]` per db with a matching person (`routes/auth/index.get.js:132,
  141-190`). One JWT CAN span multiple collective-dbs if the same OAuth identity has a
  person in more than one — not a leak, just means "one JWT ⇒ one collective" needs
  `?db=` forced at every `/auth` call if that invariant is wanted. `/refresh` does NOT
  re-enumerate dbs (`routes/auth/refresh.get.js:106-133`).
- **`entu.userStr`** set only if `token.accounts[urlDbName]` exists (`middleware/auth.js:
  46-48`) — db boundary = collective boundary holds structurally.
- **Per-property `sharing`** on a prop-def picks domain/public bucket, capped by the
  entity TYPE's own `_sharing`, then again by the ENTITY's own `_sharing`
  (`utils/aggregate.js:86,94,113-121,148-154,269-275`). Buckets are write-time snapshots —
  changing a prop-def's `sharing` does not retroactively re-aggregate existing instances.
- **`_sharing` create-time parent-copy** (`utils/entity.js:296-327` `inheritParentProperties`)
  is separate from `_inheritrights` cascade. Fires only if payload has `_parent` AND omits
  `_sharing`; copies parent's `public`>`domain` sharing, one-time, at create only. Any
  explicit `_sharing` in the create payload (even `'private'`) suppresses it — the only
  opt-out.
- **No native change-feed.** Webhooks (`utils/plugin.js`) are the only push primitive and
  hard-require public HTTPS (blocks localhost/private ranges) — structurally needs a server.
  No poll-since param on `GET /entity` either.

## Durable findings (S32-39, compressed — full detail in git history of this file)

- **v4E entity shapes** (pre-pivot, superseded by epic #21 for invite specifically):
  `rsvp`/`invitation`/`member`/`attendance` shapes, `event_type` enum values,
  `rsvp_lockout_hours` on `organization`. `invitation`+`application` model is the one
  T4.2 above flags as the OLD mechanism still live at `/invite/[token]`.
- **`_inheritrights` absent = false**, strict `=== true` check (`utils/aggregate.js`).
  Blocks upward lookup only, not downward cascade to children that DO have it true.
- **`_sharing` is `_owner`-tier**, not `_editor`-tier — `_editor` can't touch rights
  properties or delete the entity.
- **No entity-to-entity rights grants** — `_viewer`/`_editor`/`_owner` only ever reference
  a person `_id`, never an org. No org-as-viewer shortcut exists; `_inheritrights` cascade
  is the only transitive-visibility primitive.
- **Entu formula engine**: string/number/boolean output only, 23 operators, no filtered/
  grouped COUNT (sentinel-ref is the only workaround).
- **OAuth callback JWT is client-tainted** (pre-hooks.server.ts hardening) — superseded by
  the CHORE-79 `session-cookie.ts`/`hooks.server.ts` gate now in place (see S43 above).
- **Credential-synthesis via `entu_api_key` on an OAuth person** — UNRESOLVED contradiction
  (worked once, failed twice on the same technique/person). Don't rely on it without a
  fresh controlled probe.

## [DEFERRED] /library filter voicing/language field name mismatch (S26, still open)

`work.voicing` fetched but schema field is `original_voicing`; same for `language` →
`original_language`. Needs a live DB probe before filter UI lands.

(*MVOX:Finn*)
