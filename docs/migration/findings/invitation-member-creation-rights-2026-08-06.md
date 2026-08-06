# Can a non-owner member natively invite + produce a member? — settled against source (2026-08-06)

(*MVOX:Perotin*)

Onboarding "who can invite" gate (Mihkel ruled INVITED). Question: can a member who does NOT
hold org-`_owner` rights (a) natively CREATE an `invitation`, and (b) have the resulting `member`
come into existence, without owner-tier elevation at acceptance? Settled against the v4E schema
(`~/projects/entu-research/docs/schema/v4E/schema.ts`) and entu-api source
(`~/projects/entu-api`) — not reasoned, verified.

**Bottom line up front: the question as posed has a false premise.** There is no Entu-native
owner-tier gate on invitation/member creation at all — for either party. The `creators` rules in
schema.ts are a design-documentation convention with **zero enforcement in entu-api**. Read on for
the full trace; this reframes "owners-only vs any-member" into a bigger question the team needs to
resolve regardless of which policy is chosen.

## Q1 — `invitation` type: creators, `_parent`, and what a create actually requires

`schema.ts:544-583`:

```ts
const invitation: EntityDef = {
	name: 'invitation',
	blurb: "Org's consent. Admin creates; user accepts → member created + invitation deleted.",
	sharing: 'private',
	parents: [{ entity: 'organization', required: true, parentCard: '1', ... }],
	properties: [ email, sections, token, expires_at, inviter (system), message ],
	creators: [{ kind: 'parent_right', right: '_owner' }],
	notes: [
		'Bilateral consent: when matching `application` exists, BFF creates the member and deletes both this invitation and the application.',
		'Private by default — invite tokens should not be browsable.'
	]
};
```

Design intent is unambiguous: `creators: [{kind:'parent_right', right:'_owner'}]` says only a
holder of `_owner` on the target organization should create an `invitation`.

**But entu-api does not enforce this.** Traced the actual create path:

- `routes/[db]/entity/index.post.js:96-108` — the ONLY gate on `POST /entity` is
  `if (!entu.user) throw 403 'No user'`. That's it. No inspection of `_parent`, no rights check
  against the referenced parent entity.
- `utils/entity.js` `setEntity()` calls `checkEntityAccess(entu, entityId, properties, rightTypes)`
  (L42) — but `checkEntityAccess` (L83-118) opens with `if (!entityId) return` (L84-85). For a
  brand-new entity, `entityId` is `undefined` (passed from the route as `setEntity(entu, undefined, body)`,
  L104) — so the entire rights-check function is a no-op on create. The `_owner`-gate I found in
  the profile-visibility probe (L113-118) only applies to writes on an EXISTING entity.
- `inheritParentProperties()` (L297-326) reads the parent's `_sharing`/`_inheritrights` via a
  **direct MongoDB query** (`entu.db.collection('entity').find(...)`) — bypasses any
  application-level read-rights filtering entirely. It doesn't check whether the caller can even
  see the parent, let alone whether they hold `_owner`/`_editor` on it.

**Conclusion: a plain member (or, for that matter, any authenticated Entu user in the db at all)
can POST an `invitation` entity with any org as `_parent`, holding no rights on that org
whatsoever.** `creators: parent_right(_owner)` is aspirational, not enforced.

## Q2 — `member` type: creators, `_parent`, and who can create it at acceptance

`schema.ts:287-333`:

```ts
const member: EntityDef = {
	name: 'member',
	blurb: 'Per-org membership record. Admin-controlled; all self-edit moved to person.',
	sharing: 'private',
	parents: [
		{ entity: 'organization', required: true, parentCard: '1', ... },
		{ entity: 'section', required: false, ... }
	],
	properties: [ person (ref), current_section (ref), status ],
	creators: [{ kind: 'bilateral', requires: ['invitation', 'application'] }],
	notes: [ 'Type-level `_sharing: public`; instance default `private`...' ]
};
```

`bilateral` isn't one of Entu's native right kinds (`_owner`/`_editor`/`_expander`/`_viewer`) —
it's a v4E-invented `CreatorRule` (`schema.ts:37-43`) meaning "requires a matching pair of
`invitation` + `application` to exist." Entu has **no concept of `bilateral` at all** — it's pure
schema documentation. The README confirms the intended enforcer explicitly, repeatedly:

- `README.md:701-702`: "BFF atomic operation" — the member-creation step at acceptance.
- `README.md:585` (schema.ts invitation notes) / `README.md:628` (application notes): "BFF creates
  the member and deletes both."
- `README.md:544-546` ("BFF user-rights principle"): "BFF acts in the authenticated user's rights
  by default... Any frontend (polyphony app, Entu UI, custom client) can do everything the user is
  entitled to via rights — BFF has no magic capabilities beyond that."

That last line is the crux: the schema's OWN stated principle is that a BFF should only ever act
within the calling user's existing Entu rights — implying bilateral-consent member-creation was
ALWAYS meant to run as a genuinely-privileged, explicitly-marked server operation (not "the user's
own rights"), since neither the inviter alone nor the invitee alone naturally holds the right to
write a `member` entity under the org via native Entu rights. **mvox has no BFF — no server
process exists to be that enforcement point.**

Same trace as Q1 applies directly: `POST /entity` for a `member` requires only `entu.user`
existing. Nothing checks for a matching `invitation`+`application` pair, nothing checks `_owner`
on the org. **Any authenticated user can POST a `member` entity under any organization's `_parent`
right now, with no invitation, no application, and no rights on that org at all.**

## Q3 — VERDICT

**Reframing the question, because the premise doesn't hold:** it isn't "owner-tier by
construction, forcing who-can-invite to owners-only" vs. "any-member natively achievable." **Ownership-tier
enforcement doesn't exist in this architecture for EITHER path.** Entu enforces `_owner`/`_editor`
gates only on writes to entities that **already exist** (`checkEntityAccess`'s L113-118 gate,
confirmed in the prior profile-visibility probe) — creation of new entities is gated by nothing
beyond "is there a logged-in Entu user." The v4E schema's `creators` rules
(`parent_right`/`self`/`bilateral`/`custom`) describe the INTENDED policy; they are enforced
entirely by application code, and the schema's own README repeatedly names that enforcer as "BFF"
— which mvox does not have and, per the earlier profile-visibility probe (Entu JWT `aud` is
IP-bound at mint), structurally cannot have in the conventional sense.

So: **"any member invites end-to-end" is not blocked by Entu today — but neither is
"owners-only," nor is bilateral consent itself, nor (more broadly) is almost every `creators` rule
in the v4E schema.** Choosing "any member invites" doesn't unlock a feature that was otherwise
gated; it's choosing a POLICY in a system that currently enforces NONE of these policies natively.
The real question the team needs to resolve isn't "who is allowed to invite" — it's **"how does
any `creators` rule in this schema get enforced at all, given there's no BFF and Entu doesn't check
`_parent` rights on create."** This is the same structural gap the profile-visibility probe
surfaced (no server-side enforcement point exists in this architecture) applied to a second,
independent area of the schema.

This is a scope-defining finding, not a narrow yes/no — flagging for Mihkel/Gama rather than
picking a direction. Options as I see them (not recommending one — this is a bigger architecture
call than my remit):

- Accept that `creators` rules are currently unenforceable and unenforced for ALL entity types
  that need cross-party or elevated creation (invitation, member, and likely others sharing the
  `parent_right`/`bilateral` pattern) — ship "any authenticated user can create anything" as the
  honest current state, and decide whether that's acceptable for a private-beta/synthetic-data
  phase.
- Build SOME server-side enforcement point (a real BFF, even a minimal one, contradicting the
  current browser-direct decision) scoped specifically to these elevated-creation operations.
- Investigate whether Entu itself has an extension point (a plugin/webhook hook, a
  `systemUser`-gated route) that could validate `creators` rules without a general-purpose BFF —
  not investigated in this probe; would need its own pass.

Not implementing or recommending a fix — this is exactly a "don't offer a choice that isn't real"
finding, reported as asked.

## Addendum — is entu-api's platform `invite=` a ridable substitute for the v4E `invitation` entity?

Gama's hypothesis: two layers may exist, and we might be about to rebuild something the platform
already ships. Traced `invite=` fully — it's real, it's serverless-usable, but **it solves a
different problem than the v4E `invitation` entity does.**

### What `invite=` actually is: identity-claiming for a PRE-EXISTING entity, not org membership

**Minting (send side)** — `POST /{db}/entity/{_id}` (an UPDATE on an existing entity, not a
create) with `{type:'entu_user', string:'send-invite'}`:

- `routes/[db]/entity/[_id]/index.post.js:122` detects the sentinel `string:'send-invite'`.
- `:125-131` requires the target entity to already have an `email` property set, else 400 "No
  email" — this is for entities an admin already pre-provisioned with a known email (e.g. bulk
  roster import), not brand-new signups.
- `:138` calls `setEntity(entu, entityId, ...)` — since `entityId` IS defined here,
  `checkEntityAccess` (the function that's a no-op on CREATE, per the main finding above) DOES
  run — the caller needs `_editor` on the target entity. `entu_user` is not in `rightTypes`
  (confirmed list: `_noaccess/_viewer/_expander/_editor/_owner/_sharing/_inheritrights`), so
  `_editor` alone suffices, `_owner` not required.
- `utils/entity.js:462-465`: inside `insertProperties`, when a `entu_user` property has a
  `string` value, entu-api **mints a real JWT server-side**: `property.invite = jwt.sign({db,
  entityId}, jwtSecret, {expiresIn:'7d'})`, then deletes the `string` field — the stored property
  becomes `{type:'entu_user', invite:'<jwt>', email}`, no plaintext sentinel left behind. The
  `jwtSecret` is server-only; this cannot be replicated client-side.
- `routes/[db]/entity/[_id]/index.post.js:143-147`: reads that minted token back off the response,
  builds `${origin}/{db}/invite?token={jwt}`, and calls `sendInviteEmail` (AWS SES,
  `utils/ses.js`) to actually email it. **This is genuinely server-mediated** — but the server
  doing the mediating is Entu's OWN hosted API (`api.entu.app`), not something mvox has to build.
  From the browser's perspective this is just one more authenticated POST, identical in shape to
  every other Entu call mvox already makes.

**Acceptance (claim side)** — `GET /auth?db={db}&invite={jwt}` (a normal OAuth callback URL, same
endpoint every mvox login already uses):

- `:199` `inviteAttempted = !!(onlyForAccount && session && query.invite)` — true whenever an
  `invite=` param was present and OAuth completed, **regardless of whether the token actually
  validates**.
- `:236` the `createUserForAccount` auto-provision gate (traced in the main finding above)
  explicitly excludes this case: `if (onlyForAccount && accounts.length===0 && session &&
  !inviteAttempted)`. **If `invite=` is present but fails to validate for any reason (expired,
  wrong db, malformed), NO person gets created at all — silently.** [speculative, not confirmed
  against B's actual request] this is a very plausible mechanism for the earlier "person B never
  got created" finding, if B's sign-in link happened to carry a stale/mismatched `invite=` param
  — I have not confirmed this against B's actual request, flagging as a candidate explanation
  worth checking if B's onboarding link included an invite param.
- `:209` `inviteEntu = {account, db, systemUser:true}` — the invite-accept write runs with
  `systemUser:true`, which bypasses `checkEntityAccess` entirely (per the earlier profile-
  visibility probe's read of that function) — a genuinely elevated operation, but again performed
  by Entu's own backend, not exposed as a capability any API caller can invoke themselves.
- `:270-287` `findStoredInvite` + `replaceInviteWithCredentials`: looks up the pending
  `entu_user.invite` property on the target entity by `_id`, and **overwrites that same property
  record** with `{uid, email, provider}` from the completed OAuth session — converting "pending
  invite" into "claimed identity" **on the pre-existing entity**. No new entity is created.

### Direct answers

1. **Gate/shape person-creation?** Neither — it explicitly PREVENTS auto-creation (via
   `inviteAttempted`) and instead binds OAuth credentials onto an entity that already exists.
   It doesn't create a person under a different parent or bypass db-scope; `inviteData.db ===
   onlyForAccount` is checked (`:203`) — the invite only works for the db it was minted for.
2. **Token/secret concept?** Yes — a server-minted JWT (`jwtSecret`, 7-day expiry) embedded as the
   `invite` field on an `entu_user` property value. Minted at `utils/entity.js:465`, verified at
   `routes/auth/index.get.js` inside the `try { jwt.verify(query.invite, jwtSecret) }` block
   (~`:202`, wrapping the invite-branch).
3. **Does accept create a MEMBER?** No. It only touches the `entu_user` property on the target
   entity (identity claim). Zero `member`-type or `_parent`-org logic anywhere in this path — it's
   unrelated to organizational membership.
4. **Browser-direct usable, no server?** Yes, on both ends — send-side is one authenticated POST
   (Entu's own servers do the JWT-mint + SES-email); accept-side is a standard OAuth redirect to
   Entu's `/auth` endpoint, identical to every existing mvox login. mvox needs no server of its
   own for either step — Entu's hosted API IS the server, same as it already is for every other
   call this app makes.
5. **Same thing as v4E's `invitation` entity?** No — unrelated concepts. Platform `invite=` claims
   OAuth identity for a pre-provisioned entity (typically a `person` an admin already created with
   a known email, e.g. from a roster import). v4E's `invitation` entity is an app-invented data
   record for org-membership recruitment, matched against `application` for bilateral consent,
   intended to produce a `member`. Entu has zero native awareness of the `invitation`/`application`
   /`member` concept (confirmed in the main finding above); `invite=` is a genuinely different,
   pre-existing platform primitive.

### Verdict

**Not a substitute — but a genuinely useful, serverless-usable primitive for an adjacent problem:
claiming a pre-provisioned identity.** It doesn't resolve the creation-rights gap found above (who
can create the `invitation`/`member` entities is still unenforced either way); it solves "how does
a person whose record already exists (bulk-imported roster, admin-precreated placeholder) attach
their real Google login to it," which the v4E schema doesn't natively address at all today. Worth
considering as a COMPLEMENT for a bulk-roster-import onboarding path (admin pre-creates person +
member records with known emails, then singers self-claim via this native flow) rather than as a
replacement for the invitation-entity design — but that's a product/architecture call for
Mihkel/Gama, not mine to make.
