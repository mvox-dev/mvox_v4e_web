import { ENTU_API_BASE } from '../entu-config.ts';

export async function exchangeSession({
	sessionToken,
	db,
}: {
	sessionToken: string;
	db: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!sessionToken) {
		return { ok: false, error: 'missing_session_token' };
	}

	let jwt: string;
	try {
		const entuRes = await fetch(`${ENTU_API_BASE}auth?db=${encodeURIComponent(db)}`, {
			headers: {
				Authorization: `Bearer ${sessionToken}`,
				Accept: 'application/json',
			},
		});
		if (!entuRes.ok) {
			return { ok: false, error: 'entu_auth_failed' };
		}
		const data = (await entuRes.json()) as { token?: string };
		jwt = data.token ?? '';
	} catch {
		return { ok: false, error: 'entu_auth_failed' };
	}

	try {
		const cookieRes = await fetch('/auth/cookie', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: jwt }),
		});
		if (!cookieRes.ok) {
			return { ok: false, error: 'cookie_set_failed' };
		}
	} catch {
		return { ok: false, error: 'cookie_set_failed' };
	}

	return { ok: true };
}
