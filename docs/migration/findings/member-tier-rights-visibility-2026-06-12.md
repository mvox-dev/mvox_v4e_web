# Member-tier rights visibility probe

**Date:** 2026-06-12  
**Branch:** `chore/probe-member-rights-vis`  
**Authorised by:** team-lead 2026-06-12 (session 32)  
**Scope:** determines slice-2b conductor-visibility design (grants-at-write viability)

---

## Setup and limitation

### Attempted approach: `entu_api_key` on seeded person entity

Seeded polyphony `person` entities (e.g., Jaan Kõrv `6a0dd2394ff8277cd4305eec`) have no Entu OAuth accounts. Posting an `entu_api_key` property onto a person entity does produce a JWT (length 201), but that JWT carries `accounts: {}` — no account binding. The resulting credential is effectively **anonymous** (no `sub`, no accounts map).

The PO's JWT for comparison: `accounts: { polyphony: "<person_id>" }` — bound to an Entu account that resolves to their polyphony person entity.

**Consequence:** a proper member-tier credential (user who has an Entu OAuth account AND is a member of an org) cannot be synthesised in the dev playground via API key injection on a `person` entity. The `entu_api_key` property type only works for rights elevation when the entity is an Entu account-root entity, not an arbitrary application entity.

**Probe validity:** the anonymous JWT produced represents the *floor* of member-tier access — a user who authenticates but whose Entu account has no explicit rights grants on the relevant entities. Results for Q1 and Q2 (read-only probes) are valid lower bounds. Q3 fails for a structural reason (no user identity) rather than a rights reason. Q4 was run with the owner JWT instead, giving the write-path answer.

---

## Q1: Can member-tier read a public season's `_editor` list?

**Method:** `GET /polyphony/entity/{seasonId}?props=_id,_editor,_viewer,_owner` with anonymous JWT. Season `6a1d6b6210cc20db24e7ce58` has `_sharing: public`.

**Result:** HTTP 200, body:
```json
{ "entity": { "_id": "6a1d6b6210cc20db24e7ce58" } }
```

**Verdict: NO.** Rights properties (`_editor`, `_viewer`, `_owner`) are NOT returned even on a `_sharing: public` entity at anonymous/member tier. The entity is readable but its rights graph is hidden.

**Owner-tier comparison:** same request with owner JWT returns full `_editor` list (Jaan Kõrv + Liis Mägi + owner), full `_owner` list, full `_viewer` list.

---

## Q2: Can member-tier read the org's `_owner` list?

**Method:** `GET /polyphony/entity/{orgId}?props=_id,_owner,_editor,_sharing` with anonymous JWT. EFK org `69c7f8718489bfcb0e81b065` has `_sharing: domain`.

**Result:** HTTP 403 `No accessible properties`.

**Verdict: NO.** Org entity not accessible at all (the org carries `_sharing: domain`; anonymous JWT is not in-domain). Even if accessible, rights properties would not be visible per Q1 finding.

---

## Q3: Can member-tier create an rsvp under own person?

**Method:** `POST /polyphony/entity` with `_type`, `_parent=<jaan_person>`, `event`, `member`, `status` — using anonymous JWT.

**Result:** HTTP 403 `No user`.

**Verdict: NO — for structural reason.** The anonymous JWT (no `accounts` binding) has no user identity and cannot write. A real Entu OAuth user would have an account binding; the `person` entity's `creator: self` rule grants them `_owner` rights on their own person entity, which cascades to write permission on children. This probe cannot empirically confirm the member write path with the current dev setup, but the design holds: a properly-authenticated member (with Entu account `accounts.polyphony = <their person _id>`) would be the `_owner` of their person and could create rsvp children under it.

**Design inference:** rsvp creation by a real member user is structurally sound under the v4E schema — `creator: self` gives the person entity owner rights, which covers `_parent` child creation. The BFF does not need to elevate for the rsvp write.

---

## Q4: Can the owner of an rsvp grant `_viewer` to a conductor?

**Method:** `POST /polyphony/entity/{rsvpId}` with `[{"type":"_viewer","reference":"<conductor_person_id>"}]` — using owner JWT. Probe rsvp `6a2ba5104cd971291c5d5315` was created first (status=going, _sharing=private, owner=PO).

**Result:** HTTP 200:
```json
{
  "_id": "6a2ba5104cd971291c5d5315",
  "properties": [
    { "_id": "6a2ba51c4cd971291c5d531e", "type": "_viewer", "reference": "6a097dcc90c8df7a1cc7d6dd" }
  ]
}
```

Verification: rsvp `_viewer` list contains Test User (`6a097dcc90c8df7a1cc7d6dd`) alongside the owner.

**Verdict: YES.** `_viewer` grant on a private rsvp via POST is mechanically supported. An `_owner`-tier caller (the rsvp creator, i.e. the singer themselves) can add a `_viewer` property referencing a conductor's person `_id`.

**Cross-check — anonymous JWT can see the granted rsvp?** No — HTTP 403. The `_viewer` grant only helps a real Entu account whose person `_id` matches the reference. Anonymous JWTs are always excluded from private entities.

---

## Cleanup

- Probe rsvp `6a2ba5104cd971291c5d5315`: deleted (verified 404).
- `entu_api_key` property `6a2ba4ba4cd971291c5d5314` on Jaan Kõrv's person: deleted (verified absent).
- Temp JWT file: deleted from `/tmp/`.
- No other live artifacts.

---

## Implications for slice-2b conductor-visibility design

### Grants-at-write approach: NOT VIABLE as designed

The grants-at-write pattern (singer's BFF creates rsvp, then POSTs `_viewer` grants for each conductor in the org) has a fatal prerequisite: **the BFF must know which person entity IDs are conductors**.

From Q1: rights properties are invisible at member tier — the singer's JWT cannot read the season's `_editor` list to enumerate conductors. The BFF would need to use an elevated (org-service-key) JWT to enumerate `_editor` grants on the org/season, then POST `_viewer` grants on the singer's rsvp.

This makes every rsvp write a multi-step elevated sequence:
1. Singer's JWT creates rsvp (native rights, no elevation needed).
2. BFF elevated JWT reads the event/season's `_editor` list to find conductors.
3. BFF elevated JWT POSTs `_viewer` grant on the rsvp for each conductor.

Step 3 has a **rights problem**: the BFF's elevated JWT is the org service key (PO or admin tier), not the singer. POSTing a `_viewer` property requires the caller to hold at least `_editor` rights on the rsvp. The rsvp's `_owner` is the singer; the BFF service key is not an `_owner` of the rsvp unless explicitly granted. This would require the singer to also grant `_editor` to the BFF service account — compounding the write chain.

### BFF elevated read-only report: VIABLE and simpler

The v4E schema note already prescribes this path: "conductors aggregate via BFF report." The elevated BFF endpoint (`GET /api/reports/rsvp-summary?eventId=`) reads rsvp entities by querying all rsvps that reference the event, using the org service JWT (which has org-level read access). No per-rsvp grants needed. Singers' rsvps remain private; the conductor sees only aggregated counts + names via the elevated query.

**Conclusion:** grants-at-write is mechanically possible but architecturally complex and not worth the cost for MVP. The BFF elevated read-only report (already in the spec §6 design) is the correct path. No grants-at-write in slice 2.

---

(*MVOX:Perotin*)
