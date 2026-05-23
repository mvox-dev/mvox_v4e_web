import { ENTU_API_BASE } from '../../../lib/entu-config';
import { getUser } from '../../../lib/auth/storage';
import { encodeState } from '../../../lib/auth/state';

export interface OAuthInitArgs {
	provider: string;
	origin: string;
	db: string;
	returnTo: string;
	intent: 'login' | 'reauth';
	nonce: string;
}

export function buildOAuthInitUrl(args: OAuthInitArgs): string {
	const state = encodeState({ nonce: args.nonce, return_to: args.returnTo, intent: args.intent });
	const next = `${args.origin}/auth/callback?state=${encodeURIComponent(state)}`;

	const params = new URLSearchParams({ next });

	const user = getUser();
	if (user?.email) {
		params.set('login_hint', user.email);
	}

	return `${ENTU_API_BASE}auth/${args.provider}?${params.toString()}`;
}
