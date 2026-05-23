// Thin browser-side wrapper around fetch.
// - Injects Authorization: Bearer from localStorage
// - On 401: clears token/user/accounts (preserves mvox.last_provider) and
//   navigates to /auth/<last_provider> for re-auth, OR /auth/login if no
//   provider memory.
// - Otherwise throws on !res.ok with status in the message.
//
// The goto used for navigation is parameterized via a global hook for
// testability — production calls SvelteKit's goto from $app/navigation.

import { goto as sveltekitGoto } from '$app/navigation';
import { clearAll, getLastProvider, getToken } from '../auth/storage';

export interface ApiRequestInit extends RequestInit {
	headers?: Record<string, string>;
}

type GotoFn = (url: string) => void | Promise<void>;

function getGotoFn(): GotoFn {
	const test = (globalThis as Record<string, unknown>).__mvox_test_goto;
	if (typeof test === 'function') return test as GotoFn;
	return sveltekitGoto;
}

function buildReauthUrl(): string {
	const returnTo = `${window.location.pathname}${window.location.search}`;
	const encoded = encodeURIComponent(returnTo);
	const provider = getLastProvider();
	if (provider) {
		return `/auth/${provider}?return_to=${encoded}&intent=reauth`;
	}
	return `/auth/login?return_to=${encoded}`;
}

export async function apiRequest<T = unknown>(url: string, init: ApiRequestInit = {}): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = { ...(init.headers ?? {}) };
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(url, { ...init, headers });

	if (res.status === 401) {
		clearAll({ preserveProvider: true });
		await getGotoFn()(buildReauthUrl());
		throw new Error('apiRequest 401 — triggered re-auth');
	}

	if (!res.ok) {
		throw new Error(`apiRequest ${url} failed: ${res.status}`);
	}

	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return (await res.json()) as T;
	}
	return (await res.text()) as unknown as T;
}
