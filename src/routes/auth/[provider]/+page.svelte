<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { createNonce } from '$lib/auth/state';
	import { buildOAuthInitUrl } from './build-oauth-init-url';
	import * as m from '$lib/paraglide/messages.js';
	import DeskSurface from '$lib/components/DeskSurface.svelte';

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

<DeskSurface>
	<div class="min-h-[80vh] flex flex-col items-center justify-center py-16 px-6">
		<div class="bg-paper border border-ink rounded-md p-8 shadow-[4px_6px_0_0_rgba(0,0,0,0.08)] max-w-sm w-full text-center">
			<p class="font-sans text-[13px] text-ink-2">{m.auth_provider_redirecting()}</p>
		</div>
	</div>
</DeskSurface>
