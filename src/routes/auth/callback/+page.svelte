<script lang="ts">
	import { goto } from '$app/navigation';
	import { exchangeSession } from '$lib/auth/exchange';
	import { setAccounts, setLastProvider, setToken, setUser } from '$lib/auth/storage';
	import { decodeState, verifyNonce } from '$lib/auth/state';
	import * as m from '$lib/paraglide/messages.js';

	const { data } = $props<{ data: { sessionToken: string; state: string; db: string } }>();

	type ExchangeState = 'pending' | 'success' | 'failed';
	let exchangeState: ExchangeState = $state('pending');

	$effect(() => {
		runExchange();
	});

	async function runExchange() {
		// 1. Decode + verify the state parameter.
		let decoded: { nonce: string; return_to: string; intent: 'login' | 'reauth' };
		try {
			decoded = decodeState(data.state);
		} catch {
			exchangeState = 'failed';
			goto('/auth/login?error=csrf_mismatch&picker=1');
			return;
		}

		if (!verifyNonce(decoded.nonce)) {
			exchangeState = 'failed';
			goto('/auth/login?error=csrf_mismatch&picker=1');
			return;
		}

		// 2. Exchange session token for JWT (browser-direct to api.entu.app).
		const result = await exchangeSession({ sessionToken: data.sessionToken, db: data.db });
		if (!result.ok) {
			exchangeState = 'failed';
			goto(`/auth/login?error=${result.error}`);
			return;
		}

		// 3. Write to localStorage.
		setToken(result.token);
		setAccounts(result.accounts);
		setUser(result.user);

		// 4. Derive last-used provider from state intent + URL referrer-ish reasoning.
		//    Simpler: encode it in state at init time (already done — see /auth/[provider]/+page.svelte).
		//    For now, parse it off the document.referrer if it's /auth/<provider>.
		//    Cleaner alternative: include provider in the state payload — defer as follow-up if referrer proves unreliable.
		const refMatch = document.referrer.match(/\/auth\/([^/?]+)/);
		if (refMatch && refMatch[1] && refMatch[1] !== 'callback' && refMatch[1] !== 'login') {
			setLastProvider(refMatch[1]);
		}

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
