import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, isProtectedPath, isSessionValid } from '$lib/server/auth/session-cookie';

// Server-side auth gate (CHORE-79). On full page loads / SSR, redirect any request
// for a protected path to /auth/login when there's no valid session cookie. Data
// fetching stays browser-direct — this only answers "is the user logged in?".
export const handle: Handle = async ({ event, resolve }) => {
	if (isProtectedPath(event.url.pathname)) {
		const token = event.cookies.get(SESSION_COOKIE);
		if (!isSessionValid(token, Date.now())) {
			const target = event.url.pathname + event.url.search;
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(target)}`);
		}
	}
	return resolve(event);
};
