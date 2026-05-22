import type { ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ENTU_API_BASE } from '../../../lib/entu-config.ts';

const PROVIDERS: ReadonlyArray<{ id: string; label: string }> = [
	{ id: 'smart-id', label: 'Smart-ID' },
	{ id: 'mobile-id', label: 'Mobile-ID' },
	{ id: 'id-card', label: 'ID-card' },
	{ id: 'google', label: 'Google' },
	{ id: 'apple', label: 'Apple' },
	{ id: 'e-mail', label: 'e-mail' },
];

export const load: ServerLoad = async ({ cookies, url }) => {
	const csrfState = crypto.randomUUID();

	cookies.set('csrf_state', csrfState, {
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600,
		path: '/auth',
	});

	const baseUrl = env.ENTU_BASE_URL ?? ENTU_API_BASE;
	const callbackBase = `${url.origin}/auth/callback?state=${csrfState}&key=`;

	const providers = PROVIDERS.map(({ id, label }) => ({
		id,
		label,
		url: `${baseUrl}auth/${id}?next=${encodeURIComponent(callbackBase)}&state=${csrfState}`,
	}));

	return { providers };
};
