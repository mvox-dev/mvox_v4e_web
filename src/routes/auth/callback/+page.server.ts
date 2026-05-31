import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth/session-cookie';

export const load: ServerLoad = async ({ url, cookies }) => {
	const key = url.searchParams.get('key');

	if (!key) {
		throw redirect(303, '/auth/login?error=missing_session_token');
	}

	// Set the server-side session cookie (CHORE-79). Value = the Entu JWT, so the
	// hooks guard can decode `exp`. The client still writes localStorage from `data`.
	cookies.set(SESSION_COOKIE, key, sessionCookieOptions(!dev));

	return {
		sessionToken: key,
		db: PUBLIC_ENTU_DB,
	};
};
