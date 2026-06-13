import type { ServerLoad } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/auth/session-cookie';

// Clear the server-side session cookie on logout (CHORE-79), in lockstep with the
// client-side localStorage clear in perform-logout.ts. The page then lands on `/`.
export const load: ServerLoad = async ({ cookies }) => {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return {};
};
