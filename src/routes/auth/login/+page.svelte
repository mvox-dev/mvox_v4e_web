<script lang="ts">
	import { page } from '$app/stores';
	import * as m from '$lib/paraglide/messages.js';

	const { data } = $props<{ data: { providers: Array<{ id: string; label: string; url: string }> } }>();

	const error = $derived($page.url.searchParams.get('error'));
</script>

<div class="max-w-md mx-auto py-16 text-center">
	<h1 class="text-2xl font-bold text-gray-900 mb-8">{m.auth_login_heading()}</h1>

	{#if error}
		<div class="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
			{#if error === 'csrf_mismatch'}
				{m.auth_error_csrf_mismatch()}
			{:else if error === 'missing_session_token'}
				{m.auth_error_missing_session_token()}
			{:else}
				{m.common_error()}
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-3">
		{#each data.providers as provider (provider.id)}
			<a
				href={provider.url}
				data-testid="provider-{provider.id}"
				class="inline-block w-full rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
			>
				{provider.label}
			</a>
		{/each}
	</div>
</div>
