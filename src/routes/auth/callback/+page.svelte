<script lang="ts">
	import { goto } from '$app/navigation';
	import { exchangeSession } from '$lib/auth/exchange';
	import { setAccounts, setLastProvider, setToken, setUser } from '$lib/auth/storage';
	import { decodeState } from '$lib/auth/state';
	import { OAUTH_STATE_KEY } from '../[provider]/build-oauth-init-url';
	import { hydrateUserStore } from '$lib/auth/userStore';
	import * as m from '$lib/paraglide/messages.js';

	const { data } = $props<{ data: { sessionToken: string; db: string } }>();

	type ExchangeState = 'pending' | 'success' | 'failed';
	let exchangeState: ExchangeState = $state('pending');

	$effect(() => {
		runExchange();
	});

	async function runExchange() {
		const stateBlob = localStorage.getItem(OAUTH_STATE_KEY);
		if (!stateBlob) {
			exchangeState = 'failed';
			goto('/auth/login?error=csrf_mismatch&picker=1');
			return;
		}

		let decoded: { nonce: string; return_to: string; intent: 'login' | 'reauth'; provider: string };
		try {
			decoded = decodeState(stateBlob);
		} catch {
			exchangeState = 'failed';
			localStorage.removeItem(OAUTH_STATE_KEY);
			goto('/auth/login?error=csrf_mismatch&picker=1');
			return;
		}

		const result = await exchangeSession({ sessionToken: data.sessionToken, db: data.db });
		if (!result.ok) {
			exchangeState = 'failed';
			localStorage.removeItem(OAUTH_STATE_KEY);
			goto(`/auth/login?error=${result.error}`);
			return;
		}

		setToken(result.token);
		setAccounts(result.accounts);
		setUser(result.user);

		localStorage.removeItem(OAUTH_STATE_KEY);

		setLastProvider(decoded.provider);

		await hydrateUserStore();

		exchangeState = 'success';
		goto(decoded.return_to || '/');
	}
</script>

<div class="max-w-md mx-auto py-16 text-center">
	{#if exchangeState === 'pending'}
		<p class="text-gray-600">{m.auth_callback_pending()}</p>
	{:else if exchangeState === 'success'}
		<p class="text-gray-600">{m.auth_callback_success()}</p>
	{:else}
		<p class="text-red-600">{m.auth_callback_failed()}</p>
		<a href="/auth/login" class="mt-4 inline-block text-blue-600 hover:underline">
			{m.auth_login_heading()}
		</a>
	{/if}
</div>
