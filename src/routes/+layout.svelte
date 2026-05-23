<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getToken } from '$lib/auth/storage';
	import * as m from '$lib/paraglide/messages.js';

	let { children } = $props();

	let mounted = $state(false);
	let signedIn = $state(false);

	function refreshSignedIn() {
		signedIn = getToken() !== null;
	}

	onMount(() => {
		refreshSignedIn();
		mounted = true;

		// React to storage changes from other tabs (logout in one tab clears all)
		const onStorage = (e: StorageEvent) => {
			if (e.key === 'token' || e.key === null) refreshSignedIn();
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});

	// Re-read on navigation (sign-in/out via internal goto won't fire storage event)
	$effect(() => {
		// Touch $page.url to make this $effect reactive to URL changes
		$page.url;
		refreshSignedIn();
	});
</script>

<header class="bg-white border-b border-gray-200 px-4 py-3">
	<nav class="max-w-5xl mx-auto flex items-center justify-between">
		<a href="/" class="text-xl font-bold text-gray-900">mvox</a>
		<div class="flex items-center gap-4">
			{#if mounted}
				{#if signedIn}
					<a href="/auth/logout" data-testid="nav-sign-out" class="text-sm text-gray-700 hover:text-gray-900">
						{m.nav_sign_out()}
					</a>
				{:else}
					<a href="/auth/login" data-testid="nav-sign-in" class="text-sm text-gray-700 hover:text-gray-900">
						{m.nav_sign_in()}
					</a>
				{/if}
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
