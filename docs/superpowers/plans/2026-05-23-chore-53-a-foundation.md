# CHORE-A — Path C Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the new client-side foundation libraries (`storage.ts`, `state.ts`, `wrapper.ts` skeleton) and move the Entu client out of `server/`, with zero user-facing behavior change. Foundation ready for CHORE-B to consume.

**Architecture:** Five new files in `src/lib/auth/` + `src/lib/api/` + `src/lib/entu/`, all client-safe. The existing BFF routes still proxy data through the (broken) cookie+Entu path; nothing user-facing changes. Subsumes CHORE-52 (defensive `!res.ok` throw added during the client lib revise).

**Tech Stack:** SvelteKit 2, Svelte 5 Runes, TypeScript strict, Vitest, happy-dom for localStorage tests, pnpm.

**Reference spec:** [`docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`](../specs/2026-05-23-chore-53-path-c-design.md). Closes: #52 (subsumed).

**Branch:** `feat/chore-53a-foundation`. One PR.

---

## File Structure

| File | Role | Action |
|---|---|---|
| `src/lib/auth/storage.ts` | localStorage helpers — single source of truth for keys (token, accounts, user, mvox.last_provider, mvox.token_version) | NEW |
| `src/lib/auth/storage.spec.ts` | Unit tests for storage helpers (state-machine focus: clearAll preserveProvider behavior, token-version cache busting) | NEW |
| `src/lib/auth/state.ts` | OAuth state payload encode/decode + CSRF nonce store/verify (sessionStorage-backed) | NEW |
| `src/lib/auth/state.spec.ts` | Unit tests for state encoding round-trip + nonce verify-then-consume semantics | NEW |
| `src/lib/api/wrapper.ts` | `apiRequest` wrapper skeleton — exported, exercised by tests, but NOT yet wired into 401 re-auth (that's CHORE-B). For CHORE-A: just wraps `fetch` and proxies `Authorization` header construction | NEW |
| `src/lib/api/wrapper.spec.ts` | Unit tests for the wrapper — Authorization header injection, response passthrough | NEW |
| `src/lib/entu/client.ts` | Entu client — moved from `src/lib/server/entu/client.ts`; constructor signature changes (accepts `{jwt, db, baseUrl}` config rather than reading env); adds defensive `!res.ok` throw to `search()` (subsumes CHORE-52) | MOVE + REVISE |
| `src/lib/entu/client.spec.ts` | Moved + revised tests; new constructor shape | MOVE + REVISE |
| `src/routes/api/organizations/+server.ts` | Updated to import from new client location + pass env-derived config | REVISE (import + constructor call) |
| `src/routes/api/organizations/[id]/sections/+server.ts` | Same | REVISE (import + constructor call) |
| `src/lib/server/entu/client.ts` | Deleted after move | DELETE |
| `src/lib/server/entu/client.spec.ts` | Deleted after move | DELETE |

---

## Task A1: Create `src/lib/auth/storage.ts` (TDD)

**Files:**
- Create: `src/lib/auth/storage.ts`
- Test: `src/lib/auth/storage.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/storage.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAll,
	getAccounts,
	getLastProvider,
	getToken,
	getUser,
	setAccounts,
	setLastProvider,
	setToken,
	setUser,
} from './storage';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('storage', () => {
	it('returns null token when nothing stored', () => {
		expect(getToken()).toBeNull();
	});

	it('stores and retrieves token, writing token_version=1', () => {
		setToken('jwt-abc');
		expect(getToken()).toBe('jwt-abc');
		expect(localStorage.getItem('mvox.token_version')).toBe('1');
	});

	it('treats a stale token_version as no-token + force-clears related keys', () => {
		setToken('jwt-abc');
		setUser({ _id: 'u1', email: 'a@b.c' });
		localStorage.setItem('mvox.token_version', '99');
		expect(getToken()).toBeNull();
		expect(getUser()).toBeNull();
	});

	it('stores and retrieves user (incl. email field)', () => {
		setUser({ _id: 'u1', email: 'a@b.c', name: 'Alice' });
		expect(getUser()).toEqual({ _id: 'u1', email: 'a@b.c', name: 'Alice' });
	});

	it('stores and retrieves accounts array', () => {
		setAccounts([{ _id: 'a1', name: 'Acme' }]);
		expect(getAccounts()).toEqual([{ _id: 'a1', name: 'Acme' }]);
	});

	it('getAccounts returns empty array when nothing stored', () => {
		expect(getAccounts()).toEqual([]);
	});

	it('stores and retrieves last_provider', () => {
		setLastProvider('google');
		expect(getLastProvider()).toBe('google');
	});

	it('clearAll with preserveProvider=true keeps mvox.last_provider, clears everything else', () => {
		setToken('jwt');
		setUser({ _id: 'u1' });
		setAccounts([{ _id: 'a1' }]);
		setLastProvider('google');
		sessionStorage.setItem('mvox.oauth_nonce', 'nonce-abc');

		clearAll({ preserveProvider: true });

		expect(getToken()).toBeNull();
		expect(getUser()).toBeNull();
		expect(getAccounts()).toEqual([]);
		expect(getLastProvider()).toBe('google');
		expect(sessionStorage.getItem('mvox.oauth_nonce')).toBeNull();
	});

	it('clearAll with preserveProvider=false clears everything incl. last_provider', () => {
		setToken('jwt');
		setLastProvider('google');

		clearAll({ preserveProvider: false });

		expect(getToken()).toBeNull();
		expect(getLastProvider()).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/michelek/workspace && pnpm test src/lib/auth/storage.spec.ts
```

Expected: FAIL with module-not-found on `./storage`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth/storage.ts
//
// localStorage helpers — single source of truth for mvox auth key names.
// Mirrors entu/webapp's pattern for token/accounts/user; adds mvox-prefixed
// keys for last_provider + token_version.

const KEYS = {
	token: 'token',
	accounts: 'accounts',
	user: 'user',
	lastProvider: 'mvox.last_provider',
	tokenVersion: 'mvox.token_version',
} as const;

const CURRENT_TOKEN_VERSION = '1';

export interface EntuUser {
	_id: string;
	email?: string;
	name?: string;
	[key: string]: unknown;
}

export interface EntuAccount {
	_id: string;
	name?: string;
	[key: string]: unknown;
}

function isStaleVersion(): boolean {
	const stored = localStorage.getItem(KEYS.tokenVersion);
	return stored !== null && stored !== CURRENT_TOKEN_VERSION;
}

export function getToken(): string | null {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return null;
	}
	return localStorage.getItem(KEYS.token);
}

export function setToken(token: string): void {
	localStorage.setItem(KEYS.token, token);
	localStorage.setItem(KEYS.tokenVersion, CURRENT_TOKEN_VERSION);
}

export function getUser(): EntuUser | null {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return null;
	}
	const raw = localStorage.getItem(KEYS.user);
	return raw ? (JSON.parse(raw) as EntuUser) : null;
}

export function setUser(user: EntuUser): void {
	localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function getAccounts(): EntuAccount[] {
	if (isStaleVersion()) {
		clearAll({ preserveProvider: false });
		return [];
	}
	const raw = localStorage.getItem(KEYS.accounts);
	return raw ? (JSON.parse(raw) as EntuAccount[]) : [];
}

export function setAccounts(accounts: EntuAccount[]): void {
	localStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
}

export function getLastProvider(): string | null {
	return localStorage.getItem(KEYS.lastProvider);
}

export function setLastProvider(provider: string): void {
	localStorage.setItem(KEYS.lastProvider, provider);
}

export function clearAll(opts: { preserveProvider: boolean }): void {
	localStorage.removeItem(KEYS.token);
	localStorage.removeItem(KEYS.accounts);
	localStorage.removeItem(KEYS.user);
	localStorage.removeItem(KEYS.tokenVersion);
	if (!opts.preserveProvider) {
		localStorage.removeItem(KEYS.lastProvider);
	}
	sessionStorage.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/michelek/workspace && pnpm test src/lib/auth/storage.spec.ts
```

Expected: PASS (all 9 cases).

Note: requires Vitest config to use `happy-dom` or `jsdom`. Verify by reading `vitest.config.ts` — if `environment: 'happy-dom'` isn't set already, add it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/storage.ts src/lib/auth/storage.spec.ts
git commit -m "feat(#53): add src/lib/auth/storage.ts — localStorage helpers"
```

---

## Task A2: Create `src/lib/auth/state.ts` (TDD)

**Files:**
- Create: `src/lib/auth/state.ts`
- Test: `src/lib/auth/state.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/state.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
	consumeNonce,
	createNonce,
	decodeState,
	encodeState,
	storeNonce,
	verifyNonce,
} from './state';

beforeEach(() => {
	sessionStorage.clear();
});

describe('OAuth state', () => {
	it('createNonce returns a UUID-shaped string', () => {
		const n = createNonce();
		expect(n).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('encodes + decodes a state payload round-trip', () => {
		const payload = { nonce: 'abc', return_to: '/orgs?q=foo', intent: 'login' as const };
		const encoded = encodeState(payload);
		expect(decodeState(encoded)).toEqual(payload);
	});

	it('encoded state is base64url-safe (no +, /, =)', () => {
		const payload = { nonce: '?+/=&', return_to: '/path?with&special=chars', intent: 'reauth' as const };
		const encoded = encodeState(payload);
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it('storeNonce + consumeNonce returns the nonce once, then null', () => {
		storeNonce('abc-123');
		expect(consumeNonce()).toBe('abc-123');
		expect(consumeNonce()).toBeNull();
	});

	it('verifyNonce returns true when stored matches received', () => {
		storeNonce('abc-123');
		expect(verifyNonce('abc-123')).toBe(true);
	});

	it('verifyNonce returns false on mismatch + consumes the stored nonce', () => {
		storeNonce('abc-123');
		expect(verifyNonce('different')).toBe(false);
		expect(consumeNonce()).toBeNull();
	});

	it('verifyNonce returns false when nothing stored', () => {
		expect(verifyNonce('anything')).toBe(false);
	});

	it('verifyNonce called twice rejects the second attempt (replay protection)', () => {
		storeNonce('abc-123');
		expect(verifyNonce('abc-123')).toBe(true);
		expect(verifyNonce('abc-123')).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/michelek/workspace && pnpm test src/lib/auth/state.spec.ts
```

Expected: FAIL with module-not-found on `./state`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth/state.ts
//
// OAuth state payload encoding for CSRF protection + return URL preservation.
// The payload rides inside the OAuth `state` parameter; the nonce inside the
// payload is verified against a sessionStorage value set at OAuth initiation.

const NONCE_KEY = 'mvox.oauth_nonce';

export interface OAuthState {
	nonce: string;
	return_to: string;
	intent: 'login' | 'reauth';
}

export function createNonce(): string {
	return crypto.randomUUID();
}

export function encodeState(payload: OAuthState): string {
	const json = JSON.stringify(payload);
	return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(encoded: string): OAuthState {
	const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const json = atob(base64);
	return JSON.parse(json) as OAuthState;
}

export function storeNonce(nonce: string): void {
	sessionStorage.setItem(NONCE_KEY, nonce);
}

export function consumeNonce(): string | null {
	const nonce = sessionStorage.getItem(NONCE_KEY);
	if (nonce) sessionStorage.removeItem(NONCE_KEY);
	return nonce;
}

export function verifyNonce(received: string): boolean {
	const stored = consumeNonce();
	return stored !== null && stored === received;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/michelek/workspace && pnpm test src/lib/auth/state.spec.ts
```

Expected: PASS (all 8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/state.ts src/lib/auth/state.spec.ts
git commit -m "feat(#53): add src/lib/auth/state.ts — OAuth state CSRF + return URL"
```

---

## Task A3: Create `src/lib/api/wrapper.ts` skeleton (TDD)

**Files:**
- Create: `src/lib/api/wrapper.ts`
- Test: `src/lib/api/wrapper.spec.ts`

Scope clarification: in CHORE-A the wrapper handles Authorization header injection only. The 401 re-auth flow integration is CHORE-B (it needs `goto` from SvelteKit + the OAuth init URL construction). For now we ship a unit-tested skeleton that's importable but not wired into anything user-facing yet.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/wrapper.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../auth/storage';
import { apiRequest } from './wrapper';

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('apiRequest', () => {
	it('passes Authorization: Bearer header from localStorage token', async () => {
		setToken('jwt-abc');
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/entity');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer jwt-abc' }),
			}),
		);
	});

	it('omits Authorization header when no token in storage', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(null, { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/entity');

		const callArgs = fetchMock.mock.calls[0][1];
		const headers = callArgs?.headers ?? {};
		expect((headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it('returns the parsed JSON response on 200', async () => {
		setToken('jwt');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		));

		const result = await apiRequest<{ entity: { _id: string } }>(
			'https://api.entu.app/polyphony/entity/x',
		);

		expect(result).toEqual({ entity: { _id: 'x' } });
	});

	it('throws on !res.ok with status code in the error message', async () => {
		setToken('jwt');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		await expect(
			apiRequest('https://api.entu.app/polyphony/entity/x'),
		).rejects.toThrow(/403/);
	});

	it('forwards caller-supplied init options (method, body, additional headers)', async () => {
		setToken('jwt');
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('{}', { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		await apiRequest('https://api.entu.app/polyphony/property', {
			method: 'POST',
			body: JSON.stringify({ entity: 'x', type: 'name', string: 'hi' }),
			headers: { 'Content-Type': 'application/json' },
		});

		const callArgs = fetchMock.mock.calls[0][1];
		expect(callArgs?.method).toBe('POST');
		expect(callArgs?.body).toContain('"name"');
		expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
		expect((callArgs?.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/michelek/workspace && pnpm test src/lib/api/wrapper.spec.ts
```

Expected: FAIL with module-not-found on `./wrapper`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/api/wrapper.ts
//
// Thin browser-side wrapper around fetch. Injects Authorization: Bearer
// from localStorage. Throws on !res.ok with status in the message.
//
// CHORE-B will extend this with a 401 interceptor that triggers the
// involuntary-re-auth flow (clear storage, redirect to /auth/<saved-provider>
// with state-encoded return URL). For CHORE-A we ship only the header +
// passthrough behavior, unit-tested.

import { getToken } from '../auth/storage';

export interface ApiRequestInit extends RequestInit {
	headers?: Record<string, string>;
}

export async function apiRequest<T = unknown>(
	url: string,
	init: ApiRequestInit = {},
): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = { ...(init.headers ?? {}) };
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(url, { ...init, headers });

	if (!res.ok) {
		throw new Error(`apiRequest ${url} failed: ${res.status}`);
	}

	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return (await res.json()) as T;
	}
	return (await res.text()) as unknown as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/michelek/workspace && pnpm test src/lib/api/wrapper.spec.ts
```

Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/wrapper.ts src/lib/api/wrapper.spec.ts
git commit -m "feat(#53): add src/lib/api/wrapper.ts — apiRequest skeleton (Authorization injection only)"
```

---

## Task A4: Move + revise Entu client to `src/lib/entu/client.ts` (TDD)

**Files:**
- Move from: `src/lib/server/entu/client.ts`
- Move to: `src/lib/entu/client.ts`
- Test: `src/lib/entu/client.spec.ts` (moved + revised)

Three changes from the source file:

1. **Constructor signature**: accepts `{ jwt, db, baseUrl? }` config object instead of reading `$env/dynamic/private`. Allows the same client to be constructed server-side (CHORE-A, from BFF routes reading env) or browser-side (CHORE-B, with config inlined).
2. **Defensive throw on `!res.ok` in `search()`**: subsumes CHORE-52. Mirrors the existing `get()` behavior. Avoids the misleading 500 → TypeError chain we hit in session 15.
3. **Drop `$env/dynamic/private` import**: the file is no longer server-only.

- [ ] **Step 1: Write the failing test (combined move + revise)**

```ts
// src/lib/entu/client.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntuClient } from './client';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('EntuClient', () => {
	const baseConfig = { jwt: 'jwt-abc', db: 'polyphony' };

	it('constructs with explicit baseUrl override', () => {
		const c = new EntuClient({ ...baseConfig, baseUrl: 'https://custom.example/' });
		expect(c).toBeInstanceOf(EntuClient);
	});

	it('defaults baseUrl to api.entu.app when not supplied', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.get('x');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/entity/x',
			expect.any(Object),
		);
	});

	it('get() sends Authorization: Bearer header', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entity: { _id: 'x' } }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.get('x');

		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer jwt-abc' }),
			}),
		);
	});

	it('get() throws with status code on !res.ok', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		const c = new EntuClient(baseConfig);
		await expect(c.get('x')).rejects.toThrow(/403/);
	});

	it('search() builds query string from query object', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entities: [] }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.search({ '_type.string': 'organization', limit: 50 });

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain('https://api.entu.app/polyphony/entity?');
		expect(calledUrl).toContain('_type.string=organization');
		expect(calledUrl).toContain('limit=50');
	});

	it('search() throws with status code on !res.ok (CHORE-52 defensive throw)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response('forbidden', { status: 403 }),
		));

		const c = new EntuClient(baseConfig);
		await expect(c.search({ '_type.string': 'organization' })).rejects.toThrow(/403/);
	});

	it('search() omits undefined values from the query string', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ entities: [] }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.search({ '_type.string': 'organization', limit: undefined });

		const calledUrl = fetchMock.mock.calls[0][0] as string;
		expect(calledUrl).not.toContain('limit=');
	});

	it('setProperty() POSTs to /property with content-type and body', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ _id: 'prop-1' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetchMock);

		const c = new EntuClient(baseConfig);
		await c.setProperty('entity-1', 'name', 'Acme');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.entu.app/polyphony/property',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer jwt-abc',
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({ entity: 'entity-1', type: 'name', string: 'Acme' }),
			}),
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/michelek/workspace && pnpm test src/lib/entu/client.spec.ts
```

Expected: FAIL with module-not-found on `./client` (file doesn't exist at new path yet).

- [ ] **Step 3: Create the new client file**

```ts
// src/lib/entu/client.ts
//
// Entu API client. Constructor accepts config explicitly (jwt + db + optional
// baseUrl) — no env reads here, the caller is responsible for sourcing config
// (BFF routes read $env/dynamic/private; CHORE-B browser code will read
// $env/dynamic/public + storage).
//
// Throws on !res.ok in all methods. The thrown Error includes the status code
// so the apiRequest wrapper layer (or the route handler) can react appropriately.

import { ENTU_API_BASE } from '../entu-config.ts';

export interface EntuEntity {
	_id: string;
	[key: string]: unknown;
}

export interface EntuSearchQuery {
	[key: string]: unknown;
}

export interface EntuClientConfig {
	jwt: string;
	db: string;
	baseUrl?: string;
}

export class EntuClient {
	private readonly jwt: string;
	private readonly baseUrl: string;
	private readonly db: string;

	constructor(config: EntuClientConfig) {
		this.jwt = config.jwt;
		this.baseUrl = config.baseUrl ?? ENTU_API_BASE;
		this.db = config.db;
	}

	private authHeaders(): HeadersInit {
		return { Authorization: `Bearer ${this.jwt}` };
	}

	private entityUrl(entityId: string): string {
		return `${this.baseUrl}${this.db}/entity/${entityId}`;
	}

	async get(entityId: string): Promise<EntuEntity> {
		const res = await fetch(this.entityUrl(entityId), {
			headers: this.authHeaders(),
		});
		if (!res.ok) {
			throw new Error(`Entu get ${entityId} failed: ${res.status}`);
		}
		const body = (await res.json()) as { entity: EntuEntity };
		return body.entity;
	}

	async search(query: EntuSearchQuery): Promise<EntuEntity[]> {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(query)) {
			if (v !== undefined) params.set(k, String(v));
		}
		const url = `${this.baseUrl}${this.db}/entity?${params.toString()}`;
		const res = await fetch(url, { headers: this.authHeaders() });
		if (!res.ok) {
			throw new Error(`Entu search failed: ${res.status}`);
		}
		const body = (await res.json()) as { entities: EntuEntity[] };
		return body.entities;
	}

	async setProperty(entityId: string, prop: string, value: string): Promise<{ _id: string }> {
		const url = `${this.baseUrl}${this.db}/property`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				...this.authHeaders(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ entity: entityId, type: prop, string: value }),
		});
		if (!res.ok) {
			throw new Error(`Entu setProperty failed: ${res.status}`);
		}
		return res.json() as Promise<{ _id: string }>;
	}
}
```

- [ ] **Step 4: Update BFF route consumers to import from the new path + pass env-derived config**

```ts
// src/routes/api/organizations/+server.ts (revise top of file)
// Before: import { EntuClient } from '$lib/server/entu/client';
// After:
import { env } from '$env/dynamic/private';
import { EntuClient } from '$lib/entu/client';
// Where the EntuClient was previously constructed as `new EntuClient(jwt)`,
// replace with `new EntuClient({ jwt, db: env.ENTU_DB ?? '', baseUrl: env.ENTU_BASE_URL })`.
```

Read the file before editing to find the exact constructor call:

```bash
cd /home/michelek/workspace && cat src/routes/api/organizations/+server.ts
```

Then update both `src/routes/api/organizations/+server.ts` and `src/routes/api/organizations/[id]/sections/+server.ts` with the new import path + constructor shape.

- [ ] **Step 5: Delete the old client + old spec**

```bash
cd /home/michelek/workspace && rm src/lib/server/entu/client.ts src/lib/server/entu/client.spec.ts
rmdir src/lib/server/entu 2>/dev/null || true
```

- [ ] **Step 6: Run full test suite + type check**

```bash
cd /home/michelek/workspace && pnpm check && pnpm test
```

Expected: 0 type errors. All tests pass (including the new client spec + the updated BFF route specs that now point at the new location).

If BFF route specs still reference the old `'$lib/server/entu/...'` import path in their `vi.mock(...)` calls, update those too. Find with:

```bash
cd /home/michelek/workspace && grep -rn "server/entu" src/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(#53): move EntuClient out of server/ + add defensive search throw

Subsumes CHORE-52. Client now accepts explicit {jwt, db, baseUrl?} config
rather than reading $env/dynamic/private — allows the same code to be
constructed by BFF routes (today, reading env) and browser code (CHORE-B,
reading PUBLIC_ENTU_DB + storage). Defensive !res.ok throw added to
search() mirrors the existing get() pattern, closing the gap that produced
the misleading 500 → TypeError chain in session 15.

Closes #52

mihkel.putrinsh@gmail.com
EOF
)"
```

---

## Task A5: Verify full suite still green + smoke prod

**Files:** (verification only)

- [ ] **Step 1: Run the full check + test suite**

```bash
cd /home/michelek/workspace && pnpm check && pnpm test && pnpm lint
```

Expected: 0 type errors. All tests pass. Lint clean.

- [ ] **Step 2: Verify no `src/lib/server/entu` references remain**

```bash
cd /home/michelek/workspace && grep -rn "server/entu" src/ docs/
```

Expected: no matches (or only matches in spec doc references, which are intentional history).

- [ ] **Step 3: Smoke verify nothing user-facing changed**

```bash
cd /home/michelek/workspace && pnpm build
```

Expected: build succeeds without errors. Production output structure unchanged (same routes, same bundle shapes).

- [ ] **Step 4: Push branch + open PR**

```bash
cd /home/michelek/workspace && git push -u origin feat/chore-53a-foundation
gh pr create --title "CHORE-A: Path C foundation libraries" --body "$(cat <<'EOF'
## Summary

Foundation for the CHORE-53 Path C rewrite. No user-facing behavior change.

- New: `src/lib/auth/storage.ts` — localStorage helpers, single source of truth for key names
- New: `src/lib/auth/state.ts` — OAuth state encode/decode + CSRF nonce store/verify
- New: `src/lib/api/wrapper.ts` — apiRequest skeleton (Authorization injection only)
- Moved: `src/lib/server/entu/client.ts` → `src/lib/entu/client.ts`. Constructor accepts explicit `{jwt, db, baseUrl?}` config. Adds defensive `!res.ok` throw to `search()` (subsumes #52).
- Updated consumer import paths in two BFF routes (unchanged functional behavior).

## Test plan

- [x] `pnpm check` — 0 errors
- [x] `pnpm test` — all tests pass (new + existing)
- [x] `pnpm lint` — clean
- [x] `pnpm build` — succeeds

This PR ships nothing user-facing. CHORE-B (the rewrite) consumes these foundations next.

Refs #53
Closes #52

mihkel.putrinsh@gmail.com
EOF
)"
```

- [ ] **Step 5: After Bentham GREEN, merge locally (per Merge Procedure in common-prompt.md)**

```bash
cd /home/michelek/workspace && git checkout main && git pull
git merge --squash feat/chore-53a-foundation
git commit -m "$(cat <<'EOF'
feat(#53): CHORE-A — Path C foundation libraries

[squashes feat/chore-53a-foundation]

Adds src/lib/auth/{storage,state}.ts + src/lib/api/wrapper.ts (skeleton).
Moves EntuClient out of src/lib/server/. Defensive !res.ok throw on
client.search() subsumes #52. No user-facing behavior change.

Refs #53
Closes #52

mihkel.putrinsh@gmail.com
EOF
)"
git push
gh pr close <PR-number> && git push origin --delete feat/chore-53a-foundation
```

Then deploy via the standard pipeline (`pnpm run deploy` after sourcing `~/.config/mvox/credentials.env` per session-14 L57).

- [ ] **Step 6: Production smoke**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://multivox.pages.dev/
curl -s -o /dev/null -w "%{http_code}\n" https://multivox.pages.dev/auth/login
```

Expected: both 200. No user-facing change.

---

## Self-review

Spec coverage (Section 9.1 CHORE-A):
- ✅ `src/lib/auth/storage.ts` — Task A1
- ✅ `src/lib/auth/state.ts` — Task A2
- ✅ `src/lib/api/wrapper.ts` skeleton — Task A3
- ✅ EntuClient move + revise (subsumes #52) — Task A4
- ✅ Import path updates — Task A4 step 4
- ✅ Unit tests for all new helpers — Tasks A1-A4
- ✅ Full suite verification — Task A5
- ✅ Closes #52 — commit + PR body

No placeholders. All TDD cycles include actual test code + actual implementation code. File paths exact. Commands exact.
