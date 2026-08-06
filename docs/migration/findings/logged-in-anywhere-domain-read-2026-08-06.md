# SECURITY: logged-in-anywhere → domain-read of any db with `add_user` set — CONFIRMED (2026-08-06)

(*MVOX:Perotin*)

**Severity: HIGH. This is a real, reachable path, not just an unenforced policy gap.** Any person
with a Google account — zero prior relationship to polyphony, EFK, or mvox — can read every
domain-shared entity and field in the entire `polyphony` db within one browser visit. Verified
against source, not reasoned. `~/projects/entu-api`.

## The chain, confirmed step by step

**1. `POST /{db}/entity` gate — is it db-scoped or global?** Db-scoped, but that's exactly the
problem, not a mitigation — see step 2 for why db-scoping doesn't stop anything.
`routes/[db]/entity/index.post.js:96-101`: `if (!entu.user) throw 403`. `entu.user` is set in
`middleware/auth.js:46-48`:

```js
if (entu.account && entu.token.accounts?.[entu.account]) {
  entu.user = getObjectId(entu.token.accounts[entu.account])
  entu.userStr = entu.token.accounts[entu.account]
}
```

`entu.account` is the TARGET db, parsed from the URL path (`middleware/auth.js:19`,
`formatDatabaseName(event.path.split('/').at(1))`). So yes — `entu.user` requires the JWT's
`accounts` map to have an entry for THIS SPECIFIC db. A valid token minted for some OTHER db does
NOT satisfy this. **But this scoping is not a wall — anyone can get a `polyphony` entry added to
their own token's `accounts` map for free, on demand, at any time (step 2).**

**2. Can a user self-add an `accounts[targetDb]` entry, then read domain-tier?** Yes.

`routes/auth/index.get.js:236-241` (the auto-provision path traced in the earlier probe):

```js
if (onlyForAccount && accounts.length === 0 && session && !inviteAttempted) {
  const person = await createUserForAccount(onlyForAccount, session)
  if (person) {
    addAccount(onlyForAccount, person._id, person.name, { new: true })  // :240
  }
}
```

`addAccount` (`:136-138`) writes into `accountUsersIds[account] = userId` — and
`tokenData.accounts = accountUsersIds` (`:254`) is what gets signed into the JWT returned to the
caller. **`GET /auth?db=polyphony` is itself an unauthenticated-to-polyphony endpoint** — anyone
completes normal Google OAuth, hits this route with `db=polyphony`, and (confirmed in the prior
probe: polyphony's db entity HAS `add_user` set and valid) gets a brand-new `person` auto-created
on the spot, with `addAccount` immediately adding `polyphony` to their token's `accounts` map in
the SAME request/response. Every subsequent call — including the very next one — resolves
`entu.user`/`entu.userStr` for polyphony via `middleware/auth.js:46-48`. **db-scoping doesn't
protect anything when the db in question freely self-provisions accounts for any Google login.**

**3. Does holding ANY `userStr` for a db (not org-membership, not any explicit grant) unlock
domain-tier reads?** Yes — confirmed at the actual read/list query, not inferred from the write
gate. `routes/[db]/entity/index.get.js:566-570`:

```js
if (entu.user) {
  filter.access = { $in: [entu.user, 'domain', 'public'] }
}
else {
  filter.access = 'public'
}
```

`entity.access` is precomputed per-entity at write time by `getAccessArray`
(`utils/aggregate.js:219`, function body `utils/rights.js` — pushes the literal string `'domain'`
whenever `entity._sharing === 'domain'`, alongside explicit `_viewer`/`_expander`/`_editor`/
`_owner` references). **The Mongo filter is `{$in: [entu.user, 'domain', 'public']}` — matching
either the caller's OWN id (explicit grant) OR the literal string `'domain'`. There is no
additional check for org membership, section membership, or any relationship to the specific
entity beyond "does the caller hold ANY `userStr` for this db at all."**

## VERDICT

**The chain holds completely — this is a real, three-step, unauthenticated-to-authenticated
privilege escalation, reachable by any Google account holder, requiring no invitation, no
approval, no pre-existing relationship to mvox or any organization inside polyphony:**

1. `GET /auth?db=polyphony` with any Google OAuth → auto-provisioned `person`
   (`routes/auth/index.get.js:236-241`, gated only by polyphony's `add_user` being present, which
   it is).
2. That same response's JWT carries `accounts.polyphony = <new person id>`
   (`routes/auth/index.get.js:254`).
3. Every subsequent `/polyphony/...` call resolves `entu.user` for polyphony
   (`middleware/auth.js:46-48`) → `GET /polyphony/entity?...` matches `access: {$in: [entu.user,
   'domain', 'public']}` (`routes/[db]/entity/index.get.js:566-570`) → reads every
   `_sharing:domain` entity/field in the db.

**Combined with the already-reported findings this session, the actual exposure is large:**
person `name`/`email`/`notes`/`preferred_contact_email` are ALL `_sharing:domain` at the prop-def
level (confirmed earlier probe — canonical v4E wants three of those four private), `member` rosters
are `_sharing:domain` on instances, `season`/`event`/`event_series` were found `_sharing:public`
(even broader than domain) in the agenda probe. A stranger with a Google account can read the
entire membership roster, real names, emails, and notes of every domain-shared person in
polyphony, with zero relationship to any organization inside it, within one browser visit.

**This is separate from, but compounds, the earlier creation-rights finding** (anyone can also
CREATE `invitation`/`member` entities with no rights check) — that finding was about write-side
unenforced `creators` rules; this one is about read-side domain-tier access requiring nothing more
than "logged in to Entu at all," which itself requires nothing more than "has a Google account,"
because `add_user` freely self-provisions. Two independent problems compounding into one severe
one.

Not proposing a fix — this needs Mihkel/Gama eyes immediately, per the urgent framing. Flagging
one relevant fact for their triage: polyphony is documented as synthetic/no-real-data (per
`polyphony-dev-collective` team convention) for THIS db specifically — but the underlying
mechanism (self-provision → domain-read) is db-agnostic and would apply identically to any future
real-collective clone that inherits the same `add_user` + domain-sharing configuration, which is
the deployment model documented in architecture-decisions.md.
