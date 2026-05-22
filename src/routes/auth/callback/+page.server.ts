import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url, cookies }) => {
	const stateInUrl = url.searchParams.get('state');
	const stateInCookie = cookies.get('csrf_state');
	const key = url.searchParams.get('key');

	if (!stateInUrl || !stateInCookie || stateInUrl !== stateInCookie) {
		throw redirect(303, '/auth/login?error=csrf_mismatch');
	}

	if (!key) {
		throw redirect(303, '/auth/login?error=missing_session_token');
	}

	cookies.delete('csrf_state', { path: '/auth' });

	return {
		sessionToken: key,
		db: process.env.ENTU_DB ?? 'polyphony',
	};
};
