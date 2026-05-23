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

	const text = await res.text();
	try {
		return JSON.parse(text) as T;
	} catch {
		return text as unknown as T;
	}
}
