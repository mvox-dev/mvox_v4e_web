<script lang="ts">
	import { goto } from '$app/navigation';
	import { exchangeSession } from '$lib/auth/exchange';
	import * as m from '$lib/paraglide/messages.js';

	const { data } = $props<{ data: { sessionToken: string; db: string } }>();

	type ExchangeState = 'pending' | 'success' | 'failed';
	let exchangeState: ExchangeState = $state('pending');

	$effect(() => {
		exchangeSession({ sessionToken: data.sessionToken, db: data.db }).then((result) => {
			if (result.ok) {
				exchangeState = 'success';
				goto('/');
			} else {
				exchangeState = 'failed';
				goto(`/auth/login?error=${result.error}`);
			}
		});
	});
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
