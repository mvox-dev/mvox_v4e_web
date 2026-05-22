<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import * as m from '$lib/paraglide/messages.js';

	let { children } = $props();

	const session = $derived($page.data?.session ?? null);
</script>

<header class="bg-white border-b border-gray-200 px-4 py-3">
	<nav class="max-w-5xl mx-auto flex items-center justify-between">
		<a href="/" class="text-xl font-bold text-gray-900">mvox</a>
		<div class="flex items-center gap-4">
			{#if session}
				<span class="text-sm text-gray-600">{session.jwt ? '●' : ''}</span>
				<a href="/auth/logout" data-testid="nav-sign-out" class="text-sm text-gray-700 hover:text-gray-900">
					{m.nav_sign_out()}
				</a>
			{:else}
				<a href="/auth/login" data-testid="nav-sign-in" class="text-sm text-gray-700 hover:text-gray-900">
					{m.nav_sign_in()}
				</a>
			{/if}
		</div>
	</nav>
</header>

<main class="max-w-5xl mx-auto px-4 py-6">
	{@render children()}
</main>

<footer class="border-t border-gray-200 mt-8 px-4 py-4 text-center text-sm text-gray-500">
	mvox
</footer>
