import type { ServerLoad } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/auth/session-cookie';

export const load: ServerLoad = async ({ cookies }) => {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	cookies.delete('mvox_identity', { path: '/' });
	return {};
};
