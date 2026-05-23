import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load: ServerLoad = async ({ url }) => {
	const key = url.searchParams.get('key');
	const state = url.searchParams.get('state');

	if (!key) {
		throw redirect(303, '/auth/login?error=missing_session_token');
	}

	return {
		sessionToken: key,
		state: state ?? '',
		db: env.ENTU_DB ?? 'polyphony',
	};
};
