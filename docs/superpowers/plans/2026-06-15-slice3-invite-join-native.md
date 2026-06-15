# Slice-3 Invite/Join (Native Keyless) Implementation Plan

> **For agentic workers:** Executed by the mvox-dev TDD chain (Tallis RED → Byrd+Josquin GREEN → Comenius i18n → Bentham REVIEW → Josquin merge). Steps use checkbox (`- [ ]`) syntax. Only the current branch owner commits; ownership transfers via handoff message to team-lead. Single-tree serialization: one branch (`feat/invite-join-native`), no worktrees.

**Goal:** Admin invites a singer (copy-a-link); the singer signs in and joins the org. Bilateral consent (`invitation` + `application`) → a `member`. Entirely on user rights — **no `ENTU_SERVICE_KEY`, no new BFF data routes, no v4E schema change** (validated by probe #92, GREEN).

**Architecture:** Native keyless, **admin-initiated**, browser-direct (Path C). The admin creates an org-owned `invitation` carrying their own person id as `inviter`. The URL token is **self-describing** (base64url of `{orgId, orgName, inviterPersonId, sections, exp}`) so the unauthed landing renders with zero API calls. The singer OAuths in (`add_user` auto-creates their `person`), creates a private `application` under themselves, and grants the admin `_editor` on it. The admin's LIST surfaces it (probe #92), approves → creates the `member` on their own `_owner` JWT → deletes invitation + application.

**Tech stack:** SvelteKit 2 + Svelte 5 runes, TS strict, Tailwind v4, Paraglide (en/et/lv/uk), Vitest + Playwright, Biome. Entu API via the existing client; all calls on the user's JWT.

**Source design:** Josquin's S37 build design (team-lead inbox 2026-06-15) + #91 (architecture) + #92 (probe, GREEN) + the parked branch `feat/invite-join` @ `8b5ec86` (salvage source).

---

## Locked decisions (team-lead, 2026-06-15)

- **OD-1 — application cleanup:** singer grants admin **`_editor`** (not `_viewer`) on the application → admin gets LIST-discovery *and* delete-at-approve. GREEN smoke must verify `_editor` both surfaces in LIST and permits DELETE; fallback if DELETE fails = skip the delete, rely on the 30-day `expires_at` (note a cleanup-cron follow-up).
- **OD-2 — token:** plain **base64url** (not signed) for MVP. Tamper = spam-only, no privilege escalation. HMAC-signing is a documented production follow-up.
- **OD-3 — new-person `_sharing`:** OUT OF SCOPE (issue #93). Do not build `bootstrapPerson.ts` here.
- **OD-4 — scope:** admin-initiated only (invitation + application). No standalone cold-apply.
- **Schema-correctness (Josquin catches):** `application.status` = `'pending'` (NOT `'active'`); `member` has **NO `name` prop** — never POST one.

## Plan corrections (Josquin review 2026-06-15) — READ BEFORE WRITING TESTS

The RED-test snippets below use a `cfg.post('entity', {keyed-object})` / `get` / `del` shorthand for readability. **The real codebase convention is different — Tallis must author RED against the real shape:**

- **C1 — Entu calls use raw `fetch`, not a client object.** Data fns (`entuSeasons.ts`, `rsvpData.ts`, salvaged `inviteData.ts`) call `fetch(\`${ENTU_API_BASE}${db}/entity...\`, { method, headers: authHeaders(token), body })`. Specs `vi.stubGlobal('fetch', vi.fn()...)` and assert on `fetchMock.mock.calls[i][0]` (URL **string** — use `.toContain('_type.string=application')`) and `JSON.parse(call[1].body)` (the body).
- **C2 — POST body is an ARRAY of prop objects**, not a keyed object: `[{ type:'_type', reference: ID }, { type:'_parent', reference:'org123' }, { type:'inviter', reference:'p456' }, ...]`. Assert with `expect(body).toContainEqual({ type:'_parent', reference:'org123' })` per prop (or a single `toEqual` on the full ordered array). Keep full-shape rigor per `feedback_partial_assertions_hide_bugs`.
- **C3 — `expires_at` is type `date`**, posted `{ type:'expires_at', date:'YYYY-MM-DD' }` (NOT `datetime`).
- **C4 — `application` MUST explicitly POST `{ type:'_sharing', string:'private' }`** (load-bearing): `application` is a child of `person`, whose instance default is `_sharing: public` (schema §4); per `project_entu_sharing_create_time` a child materialises a non-private parent's sharing at create — so without the explicit `private`, the application is born **public**. Do NOT copy `rsvpData.ts`'s `_sharing` skip.
- **C5 — keep token codec client-side.** `inviteToken.ts` `btoa/atob` run in the browser (admin builds the URL; singer decodes the landing). Don't import it into a `+server.ts`/SSR path (CF Workers `atob`/base64url gap — use `Buffer.from(..,'base64url')` if ever moved server-side).

So every `post`/`get`/`del` assertion in Tasks 1.1 / 2.1 / 3.1 below is **intent-correct but shape-wrong** — translate to the `fetch` + array convention above. Josquin will hand Tallis the exact corrected shapes at chain start.

## File structure

**Branch:** `feat/invite-join-native` off current `main`. Salvage = **recreate/port** file-by-file from `8b5ec86` (do NOT branch from or cherry-pick the parked branch — it predates the About work and carries the service-key core).

| Action | File | Notes |
|---|---|---|
| CREATE | `src/lib/invite/inviteToken.ts` | encode/decode self-describing base64url token |
| CREATE/port | `src/lib/invite/inviteData.ts` | `createInvitation`, `buildInviteUrl`, `listOrgInvitations`, `createApplication` (port + fix `status:'pending'`); NEW `grantEditorToAdmin`, `listPendingApplications`, `approveApplication` |
| MODIFY | `src/lib/types.ts` | `InviteToken`, `PendingApplication`, `CreateInvitationInput/Result`, `CreateApplicationInput` (drop `InviteProjection`) |
| port | `src/routes/members/+page.svelte` | admin: invite form + pending-applications list + approve |
| port | `src/routes/invite/[token]/+page.svelte` | landing: decode token client-side, render, sign-in→accept |
| port | `src/lib/components/CopyLink.svelte`, `src/lib/components/members/InviteForm.svelte` | rewired to new data fns |
| MODIFY | `src/lib/components/MvoxNav.svelte` + `currentTab.ts` | Members tab (salvage) |
| MODIFY | `src/lib/server/auth/session-cookie.ts` | add `/invite/` to public `isProtectedPath` allowlist |
| MODIFY (carry token) | OAuth `state` plumbing (existing Path C) | carry `token` through login round-trip back to `/invite/<token>` |
| DELETE/never-port | `src/lib/server/entu/elevated.ts`(+spec), `src/routes/api/invite/[token]/+server.ts`, `.../accept/+server.ts`(+specs), `ENTU_SERVICE_KEY` in `src/app.d.ts`, elevated-ops append in `architecture-decisions.md` | service-key core — must not exist on this branch |

**BFF surface added: ZERO data routes.** Only the `isProtectedPath` allowlist edit (guard config, not a data route).

---

## SUB-CHAIN 0 — Branch + teardown scaffold (team-lead + Josquin)

- [ ] **0.1 (team-lead):** `git checkout main && git pull && git checkout -b feat/invite-join-native`. Commit this plan.
- [ ] **0.2 (Josquin):** **CONFIRMED no-op (Josquin review P6):** `main` has none of `elevated.ts`, `/api/invite/**`, `src/lib/invite/`, `src/routes/{members,invite}`, `ENTU_SERVICE_KEY`, or the elevated-ops append (grep count 0). Nothing to delete — record and move on.
- [ ] **0.3:** Verify baseline green: `pnpm check` (0), `pnpm test:unit` (current count). Handoff to Tallis.

---

## SUB-CHAIN 1 — Invite (admin creates invitation)

### Task 1.1 — RED (Tallis): `inviteToken` + `createInvitation`

**Files:** `src/lib/invite/inviteToken.spec.ts`, `src/lib/invite/inviteData.spec.ts`

- [ ] **Write `inviteToken.spec.ts`:**

```ts
import { describe, it, expect } from 'vitest';
import { encodeInviteToken, decodeInviteToken } from './inviteToken';

const sample = {
	orgId: 'org123',
	orgName: 'Eesti Filharmoonia Kammerkoor',
	inviterPersonId: 'p456',
	sections: ['sopr1', 'alto2'],
	exp: 1781000000000,
};

describe('inviteToken', () => {
	it('round-trips the full payload', () => {
		expect(decodeInviteToken(encodeInviteToken(sample))).toEqual(sample);
	});
	it('is URL-safe (no +, /, = in output)', () => {
		expect(encodeInviteToken(sample)).not.toMatch(/[+/=]/);
	});
	it('returns null on malformed input', () => {
		expect(decodeInviteToken('not-base64url!!')).toBeNull();
	});
	it('returns null when a required field is missing', () => {
		const bad = btoa(JSON.stringify({ orgId: 'x' })).replace(/=/g, '');
		expect(decodeInviteToken(bad)).toBeNull();
	});
});
```

- [ ] **Add to `inviteData.spec.ts`** (mock the Entu client like existing data-fn specs; assert FULL request shape with `toEqual`):

```ts
// createInvitation: org-parented, inviter set, status/token/expiry present
it('createInvitation posts an org-child invitation with inviter + token', async () => {
	const post = vi.fn().mockResolvedValue({ entity: { _id: 'inv1' } });
	const cfg = makeCfg({ post });
	const res = await createInvitation(cfg, {
		orgId: 'org123', email: 'a@b.ee', sections: ['sopr1'],
		inviterPersonId: 'p456', message: 'welcome',
	});
	expect(post).toHaveBeenCalledWith('entity', expect.objectContaining({
		_type: [{ reference: INVITATION_TYPE_ID }],
		_parent: [{ reference: 'org123' }],
		inviter: [{ reference: 'p456' }],
		email: [{ string: 'a@b.ee' }],
		sections: [{ reference: 'sopr1' }],
	}));
	// token + expires_at present
	const body = post.mock.calls[0][1];
	expect(body.token?.[0]?.string).toBeTruthy();
	expect(body.expires_at?.[0]?.datetime).toBeTruthy();
	expect(res).toEqual({ invitationId: 'inv1', token: expect.any(String) });
});
```

- [ ] **Run:** `pnpm test:unit -- src/lib/invite/` → both fail (modules/fns absent). Commit RED. Handoff to Josquin.

### Task 1.2 — GREEN (Josquin): `inviteToken.ts` + `createInvitation`

- [ ] **`inviteToken.ts`:**

```ts
import type { InviteToken } from '$lib/types';
const REQUIRED = ['orgId', 'orgName', 'inviterPersonId', 'sections', 'exp'] as const;

export function encodeInviteToken(t: InviteToken): string {
	return btoa(JSON.stringify(t)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeInviteToken(s: string): InviteToken | null {
	try {
		const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
		const obj = JSON.parse(atob(b64));
		for (const k of REQUIRED) if (!(k in obj)) return null;
		return obj as InviteToken;
	} catch {
		return null;
	}
}
```

- [ ] **`inviteData.ts` `createInvitation`** — port from `8b5ec86`, parent=org, set `inviter`, generate `token` (the base64url payload via `encodeInviteToken` using orgId/orgName/inviterPersonId/sections/exp = now+30d), `expires_at`, `email`, `sections`. Return `{ invitationId, token }`. Run on the caller's JWT (`cfg` carries the user token). Add types to `src/lib/types.ts`.
- [ ] **Run** `pnpm test:unit -- src/lib/invite/` → pass. `pnpm check` 0. `pnpm format`. Commit GREEN. Message Byrd: API ready for invite UI.

### Task 1.3 — GREEN (Byrd): invite UI on `/members`

- [ ] Port `InviteForm.svelte` + `CopyLink.svelte` + the `/members` invite section, wired to `createInvitation`/`buildInviteUrl`/`listOrgInvitations`. `inviterPersonId` from the session person id (`accounts[db]`). Show the copyable `/invite/<token>` link. Tests (port component specs). Run unit + `pnpm check`. Commit. Handoff to Comenius (defer i18n to end) or continue to sub-chain 2 — team-lead sequences.

---

## SUB-CHAIN 2 — Landing + Accept (singer)

### Task 2.1 — RED (Tallis): landing decode + `createApplication` + `grantEditorToAdmin`

- [ ] **`inviteData.spec.ts` additions:**

```ts
it('createApplication posts a private person-child application with status pending', async () => {
	const post = vi.fn().mockResolvedValue({ entity: { _id: 'app1' } });
	const res = await createApplication(makeCfg({ post }), { personId: 'p789', orgId: 'org123' });
	expect(post).toHaveBeenCalledWith('entity', expect.objectContaining({
		_type: [{ reference: APPLICATION_TYPE_ID }],
		_parent: [{ reference: 'p789' }],
		target_org: [{ reference: 'org123' }],
		status: [{ string: 'pending' }],          // NOT 'active'
		_sharing: [{ string: 'private' }],
	}));
	expect(res).toEqual({ applicationId: 'app1' });
});

it('grantEditorToAdmin posts an _editor grant for the admin person (idempotent skip if present)', async () => {
	const post = vi.fn().mockResolvedValue({});
	await grantEditorToAdmin(makeCfg({ post }), { applicationId: 'app1', adminPersonId: 'p456' });
	expect(post).toHaveBeenCalledWith('entity/app1', [{ type: '_editor', reference: 'p456' }]);
});
```

- [ ] **Landing page spec** (`src/routes/invite/[token]/page.spec.ts`): decodes the token client-side and renders org name + invite copy WITHOUT any fetch; an invalid token renders an error state. (Mock messages; assert rendered org name from a known token.)
- [ ] Run → fail. Commit RED. Handoff.

### Task 2.2 — GREEN (Josquin): data fns

- [ ] `createApplication` — port, fix `status:'pending'`, set `_sharing:'private'`, `target_org`, parent=singer person. `grantEditorToAdmin` — POST `[{type:'_editor', reference: adminPersonId}]` on the application (mirror `assignConductor` grant pattern; idempotent check-then-skip). Types in `src/lib/types.ts`. Run unit + check + format. Commit. Message Byrd.

### Task 2.3 — GREEN (Byrd): landing + accept UI + OAuth state carry

- [ ] `/invite/[token]/+page.svelte`: `decodeInviteToken(params.token)` client-side → render org/invite (no fetch). If null → error state. "Sign in to accept" → OAuth, carrying `token` in the existing Path C `state` payload so we return to `/invite/<token>` authed. Once authed: call `createApplication({personId: session.personId, orgId: token.orgId})` then `grantEditorToAdmin({applicationId, adminPersonId: token.inviterPersonId})`; show "request sent — an admin will approve."
- [ ] `session-cookie.ts`: add `/invite/` to the public `isProtectedPath` allowlist (Josquin owns this server file — coordinate; small guard edit).
- [ ] Run unit + check. Commit. Handoff.

---

## SUB-CHAIN 3 — Approve (admin) → member

### Task 3.1 — RED (Tallis): `listPendingApplications` + `approveApplication`

- [ ] **`inviteData.spec.ts` additions:**

```ts
it('listPendingApplications queries by type+target_org+status and resolves applicant names', async () => {
	const get = vi.fn()
		.mockResolvedValueOnce({ entities: [{ _id: 'app1', _parent: [{ reference: 'p789' }], message: [{ string: 'hi' }] }] })
		.mockResolvedValueOnce({ entity: { _id: 'p789', name: [{ string: 'Mari Maa' }] } });
	const res = await listPendingApplications(makeCfg({ get }), 'org123');
	expect(get.mock.calls[0][0]).toContain('_type.string=application');
	expect(get.mock.calls[0][0]).toContain('target_org.reference=org123');
	expect(get.mock.calls[0][0]).toContain('status.string=pending');
	expect(res).toEqual([{ applicationId: 'app1', personId: 'p789', applicantName: 'Mari Maa', message: 'hi', sections: undefined }]);
});

it('approveApplication creates a member with NO name prop, syncs org _viewer, deletes both entities', async () => {
	const post = vi.fn().mockResolvedValue({ entity: { _id: 'mem1' } });
	const del = vi.fn().mockResolvedValue({});
	await approveApplication(makeCfg({ post, del }), {
		applicationId: 'app1', invitationId: 'inv1', orgId: 'org123',
		personId: 'p789', sections: ['sopr1'],
	});
	// member: org + section parents, person ref, status active, NO name
	const memberBody = post.mock.calls.find(c => c[0] === 'entity')?.[1];
	expect(memberBody).toEqual(expect.objectContaining({
		_type: [{ reference: MEMBER_TYPE_ID }],
		_parent: expect.arrayContaining([{ reference: 'org123' }, { reference: 'sopr1' }]),
		person: [{ reference: 'p789' }],
		status: [{ string: 'active' }],
	}));
	expect(memberBody).not.toHaveProperty('name');
	// org _viewer sync for the new member person
	expect(post).toHaveBeenCalledWith('entity/org123', [{ type: '_viewer', reference: 'p789' }]);
	// cleanup
	expect(del).toHaveBeenCalledWith('entity/inv1');
	expect(del).toHaveBeenCalledWith('entity/app1');
});
```

- [ ] Run → fail. Commit RED. Handoff.

### Task 3.2 — GREEN (Josquin): `listPendingApplications` + `approveApplication`

- [ ] `listPendingApplications(cfg, orgId)` → GET `?_type.string=application&target_org.reference=<orgId>&status.string=pending&props=_parent,target_org,message,_viewer&limit=500`; two-fetch name resolve via `_parent` person (pattern: `listOrgMembers`). Map to `PendingApplication[]`.
- [ ] `approveApplication(cfg, {...})` — on the admin's own `_owner` JWT: (1) POST `member` child-of-org(+sections), `person` ref, `status:'active'`, **no `name`**; (2) POST `[{type:'_viewer', reference: personId}]` on the org (membership-rights sync, README §6.2); (3) `del('entity/'+invitationId)`; (4) `del('entity/'+applicationId)`.
- [ ] **GREEN smoke (Josquin, live) — DEFERRED, PO-authorized (Josquin review P5):** verify end-to-end that an `_editor`-granted application (a) appears in the admin LIST and (b) is DELETE-able. **MUST run with the genuine non-omniscient second account (`6a2f3f964cd971291c5d5ca2`), NOT the PO db-root key** — else (b) is meaningless (db-root can always delete). This is a live data-mutating op → requires the explicit auth-gate ("I authorize this run") routed through team-lead. **Because this needs PO authorization (PO asleep during the overnight build), it is DEFERRED:** the chain proceeds to GREEN+preview on the near-certain assumption (`_editor ⊇ _viewer` read, which probe #92 confirmed surfaces in LIST; `_editor` permits DELETE). Unit tests (mocked) don't need it. Run the smoke when PO can authorize; if DELETE fails → drop the application-delete step (4), rely on 30-day `expires_at`, file a cleanup-cron follow-up.
- [ ] Run unit + check + format. Commit. Message Byrd.

### Task 3.3 — GREEN (Byrd): pending-applications list + approve UI on `/members`

- [ ] `/members`: render `listPendingApplications`, an Approve button per row → `approveApplication`, optimistic removal on success. Tests. Run unit + check. Commit. Handoff to Comenius.

---

## SUB-CHAIN 4 — i18n + Review + Merge

### Task 4.1 — i18n (Comenius)
- [ ] Re-apply the salvaged invite/members/landing key SET (en/et/lv/uk) onto current `main`'s message files — invite form, copy-link, landing ("you've been invited", sections), pending list, approve, request-sent. 4-locale parity, no `TODO:`/Lorem. `pnpm check`, `pnpm format`, commit. Handoff to Bentham.

### Task 4.2 — REVIEW (Bentham)
- [ ] Verify: **no `elevated.ts`/`ENTU_SERVICE_KEY`/`/api/invite` BFF data route anywhere**; all Entu writes on user JWTs; `application.status='pending'`; `member` has no `name`; membership-rights `_viewer` sync present; `/invite/` landing is public + leaks no private data (token carries only public org/section/inviter-name + ids); full-shape assertions; i18n complete; bg-rule (if any new public UI) green. RED/YELLOW/GREEN. Revert the elevated-ops append in `architecture-decisions.md` if any remains.

### Task 4.3 — MERGE (Josquin, after Bentham GREEN + team-lead approval)
- [ ] `pnpm check` + `pnpm test` green. Squash-merge per common-prompt procedure. Commit body: `Closes #21`, `Closes #11`. Team-lead closes #21 + #11, deletes branch, verifies preview/prod per PO direction.

---

## Self-review (team-lead vs design)

- **Salvage/delete/create** all mapped to tasks (file table + sub-chain 0). ✓
- **Four flows** → sub-chains 1–3 with rights-per-step. ✓
- **Token self-describing** (OD-2 plain base64url) → Task 1.1/1.2 + 2.3. ✓
- **`_editor` grant** (OD-1) → Task 2.1/2.2 + GREEN smoke verifies LIST+DELETE → Task 3.2. ✓
- **Schema correctness** (`status:'pending'`, no member `name`) → asserted in Tasks 2.1 + 3.1. ✓
- **Zero BFF data routes / no service key** → file table + Bentham 4.2. ✓
- **OD-3 carved out** (#93), not built here. ✓
- **Type consistency:** `InviteToken`, `PendingApplication`, `createInvitation/createApplication/grantEditorToAdmin/listPendingApplications/approveApplication` named identically across tasks. ✓

(*MVOX:Palestrina*)
