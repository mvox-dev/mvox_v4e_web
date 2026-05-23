import { ENTU_API_BASE } from '../entu-config.ts';
import type { EntuAccount, EntuUser } from './storage';

export interface ExchangeSuccess {
	ok: true;
	token: string;
	accounts: EntuAccount[];
	user: EntuUser;
}

export interface ExchangeFailure {
	ok: false;
	error: 'missing_session_token' | 'entu_auth_failed';
}

export async function exchangeSession({
	sessionToken,
	db,
}: {
	sessionToken: string;
	db: string;
}): Promise<ExchangeSuccess | ExchangeFailure> {
	if (!sessionToken) {
		return { ok: false, error: 'missing_session_token' };
	}

	try {
		const res = await fetch(`${ENTU_API_BASE}auth?db=${encodeURIComponent(db)}`, {
			headers: {
				Authorization: `Bearer ${sessionToken}`,
				Accept: 'application/json',
			},
		});

		if (!res.ok) {
			return { ok: false, error: 'entu_auth_failed' };
		}

		const data = (await res.json()) as {
			token?: string;
			accounts?: EntuAccount[];
			user?: EntuUser;
		};

		if (!data.token) {
			return { ok: false, error: 'entu_auth_failed' };
		}

		return {
			ok: true,
			token: data.token,
			accounts: data.accounts ?? [],
			user: data.user ?? ({ _id: '' } as EntuUser),
		};
	} catch {
		return { ok: false, error: 'entu_auth_failed' };
	}
}
