import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { PUBLIC_ENTU_DB } from '$env/static/public';

export const load: ServerLoad = async ({ url }) => {
	const key = url.searchParams.get('key');

	if (!key) {
		throw redirect(303, '/auth/login?error=missing_session_token');
	}

	return {
		sessionToken: key,
		db: PUBLIC_ENTU_DB,
	};
};
