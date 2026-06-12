# Auth Trusted-Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-trusted `mvox_identity` cookie minted at OAuth callback via server-side Entu exchange. Spec: `docs/superpowers/specs/2026-06-12-auth-trusted-identity-issuance-design.md`.

**Branch:** `feat/auth-trusted-identity` off main.
**Chain (single-tree protocol — tree on the feature branch for the chain's duration, one actor at a time):** Tallis (RED) → Josquin (GREEN, server-only) → Bentham (security review) → Josquin (merge + deploy) → PO login probe on preview.

## File Map

| File | Action | Owner |
|---|---|---|
| `src/lib/server/auth/identity-cookie.ts` | Create (stub in RED) | Josquin |
| `src/lib/server/auth/identity-cookie.spec.ts` | Create | Tallis |
| `src/routes/auth/callback/+page.server.ts` | Server exchange + dual cookie set | Josquin |
| `src/routes/auth/callback/page.server.spec.ts` | Extend | Tallis |
| `src/routes/auth/logout/*` (server handler) | Clear `mvox_identity` too | Josquin |
| `.env.example` | `MVOX_SESSION_SECRET=dev-only-placeholder-change-me` | Josquin |

### Task 1: RED (Tallis)

- [ ] Stub `identity-cookie.ts`:

```ts
export interface IdentityPayload {
	personId: string;
	iat: number;
	exp: number;
}
export async function signIdentity(_payload: IdentityPayload, _secret: string): Promise<string> {
	throw new Error('not implemented');
}
export async function verifyIdentity(
	_cookieValue: string,
	_secret: string,
	_nowMs: number,
): Promise<{ personId: string } | null> {
	throw new Error('not implemented');
}
```

- [ ] `identity-cookie.spec.ts` (async — Web Crypto): round-trip sign→verify returns `{personId}`; payload tamper → null; signature tamper → null; `exp` in past → null; malformed (no dot, bad base64) → null; verify with different secret → null.
- [ ] Extend callback `page.server.spec.ts` — mock global fetch for the Entu exchange:
  - exchange 200 + `accounts: { testdb: 'person-77' }` → `cookies.set` called for BOTH `mvox_session` (=key, existing opts) and `mvox_identity` (value verifies via `verifyIdentity` against the test secret → `personId === 'person-77'`).
  - exchange 401 → NO `cookies.set` calls; throws redirect 303 to `/auth/login?error=server_exchange_failed`.
  - exchange 200 but `accounts` lacks the db → same loud failure.
  - missing `key` param → existing redirect behavior unchanged (regression pin).
  - Mock `$env/static/private` `MVOX_SESSION_SECRET` per existing env-mock pattern in the file.
- [ ] Extend logout spec: `mvox_identity` cleared (delete/expire) alongside `mvox_session`.
- [ ] Targeted vitest RED for right reasons; `pnpm check` 0. Commit `test(auth): RED — identity cookie + server-side callback exchange (stubs per L120)` → push.

### Task 2: GREEN (Josquin)

- [ ] Implement `identity-cookie.ts` with Web Crypto:

```ts
const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function b64url(bytes: ArrayBuffer): string {
	return Buffer.from(bytes).toString('base64url');
}

export async function signIdentity(payload: IdentityPayload, secret: string): Promise<string> {
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
	return `${body}.${b64url(sig)}`;
}

export async function verifyIdentity(cookieValue: string, secret: string, nowMs: number) {
	const dot = cookieValue.lastIndexOf('.');
	if (dot <= 0) return null;
	const body = cookieValue.slice(0, dot);
	const sigB64 = cookieValue.slice(dot + 1);
	let sig: Buffer;
	try { sig = Buffer.from(sigB64, 'base64url'); } catch { return null; }
	const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(body));
	if (!ok) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IdentityPayload;
		if (typeof payload.personId !== 'string' || typeof payload.exp !== 'number') return null;
		if (payload.exp * 1000 <= nowMs) return null;
		return { personId: payload.personId };
	} catch { return null; }
}
```

(If `Buffer` proves unavailable under the CF runtime build, switch to a small base64url helper over `Uint8Array` — keep tests green either way; CF Pages with SvelteKit polyfills Buffer in node-compat but verify via `pnpm build`.)

- [ ] Callback `+page.server.ts`: after the existing `key` guard, add the server exchange per spec §1 (fetch `${ENTU_API_BASE}auth?db=${PUBLIC_ENTU_DB}` with Bearer key — mirror the response parsing in `src/lib/auth/exchange.ts`); on failure `console.error` + redirect 303 `/auth/login?error=server_exchange_failed`; on success set both cookies (`mvox_identity` via `signIdentity` with `MVOX_SESSION_SECRET` from `$env/static/private`, iat/exp = now / now+48h in SECONDS).
- [ ] Logout: clear `mvox_identity` (same attributes as the session-cookie clear).
- [ ] `.env.example` + local `.env`: add `MVOX_SESSION_SECRET`. NOTE for deploy: `wrangler pages secret put MVOX_SESSION_SECRET --project-name=multivox` BEFORE the preview deploy (generate via `openssl rand -base64 32`; never log it).
- [ ] Full suite + `pnpm check` + `pnpm build` green. Commit `feat(auth): server-side exchange at callback + HMAC mvox_identity cookie` → push.

### Task 3: REVIEW (Bentham — security-critical files)

- [ ] Thorough pass on `src/lib/server/auth/` + callback + logout. Checklist: taint actually closed (no cookie set before exchange verifies); fail-loudly both paths (no cookie + redirect on server-fail; client-fail surfaces via existing exchange error); HMAC construction (sign over body only, constant-time verify via crypto.subtle.verify, secret never in client bundle — `$env/static/private` import in server-only module); exp enforced in verify; logout clears; no change to client-side data flow; regression pins on existing callback behavior. Verdict → team-lead.

### Task 4: MERGE + deploy + probe (Josquin, then PO)

- [ ] Squash-merge to main: `feat(auth): trusted identity at issuance — server-side exchange + HMAC identity cookie`, body per spec, `Closes` nothing (no issue — spec-driven; reference spec path).
- [ ] Set the CF secret (Task 2 note), build, deploy preview.
- [ ] Report build hash → team-lead pings PO for the ONE OAuth login probe. Outcome table in spec §3 governs next step.

(*MVOX:Palestrina*)
