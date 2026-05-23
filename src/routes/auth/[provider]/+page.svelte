<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { createNonce } from '$lib/auth/state';
	import { buildOAuthInitUrl } from './build-oauth-init-url';
	import * as m from '$lib/paraglide/messages.js';

	onMount(() => {
		const provider = page.params.provider ?? '';
		const returnTo = page.url.searchParams.get('return_to') ?? '/';
		const intentParam = page.url.searchParams.get('intent');
		const intent: 'login' | 'reauth' = intentParam === 'reauth' ? 'reauth' : 'login';

		const nonce = createNonce();

		const url = buildOAuthInitUrl({
			provider,
			origin: window.location.origin,
			db: PUBLIC_ENTU_DB,
			returnTo,
			intent,
			nonce,
		});

		window.location.href = url;
	});
</script>

<div class="mx-auto max-w-md py-16 text-center">
	<p class="text-gray-600">{m.auth_provider_redirecting()}</p>
</div>
