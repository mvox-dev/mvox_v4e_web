import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { MVOX_SESSION_SECRET } from '$env/static/private';
import { ENTU_API_BASE } from '$lib/entu-config';
import { SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth/session-cookie';
import { signIdentity } from '$lib/server/auth/identity-cookie';

const IDENTITY_COOKIE = 'mvox_identity';

export const load: ServerLoad = async ({ url, cookies }) => {
	const key = url.searchParams.get('key');

	if (!key) {
		throw redirect(303, '/auth/login?error=missing_session_token');
	}

	// Server-side Entu exchange: verify the key and extract personId
	let personId: string;
	try {
		const res = await fetch(`${ENTU_API_BASE}auth?db=${encodeURIComponent(PUBLIC_ENTU_DB)}`, {
			headers: {
				Authorization: `Bearer ${key}`,
				Accept: 'application/json',
			},
		});

		if (!res.ok) {
			console.error(`Entu exchange failed: ${res.status}`);
			throw redirect(303, `/auth/login?error=exchange_http_${res.status}`);
		}

		const data = (await res.json()) as {
			accounts?: Array<{ _id: string; user?: { _id: string } }>;
		};
		const pid = data.accounts?.find((a) => a._id === PUBLIC_ENTU_DB)?.user?._id;

		if (!pid) {
			console.error('Entu exchange: accounts missing db entry');
			throw redirect(303, '/auth/login?error=exchange_no_account');
		}

		personId = pid;

		// Mint the HMAC-signed identity cookie with the server-verified personId
		const nowS = Math.floor(Date.now() / 1000);
		const identityValue = await signIdentity(
			{ personId, iat: nowS, exp: nowS + 48 * 60 * 60 },
			MVOX_SESSION_SECRET,
		);

		// Atomic: set BOTH cookies only after signIdentity succeeds (YELLOW-EC.1)
		cookies.set(SESSION_COOKIE, key, sessionCookieOptions(!dev));
		cookies.set(IDENTITY_COOKIE, identityValue, sessionCookieOptions(!dev));
	} catch (err) {
		// Re-throw redirects (they are throw-based in SvelteKit)
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Entu exchange error:', err);
		throw redirect(303, '/auth/login?error=identity_sign_failed');
	}

	return {
		sessionToken: key,
		db: PUBLIC_ENTU_DB,
	};
};
