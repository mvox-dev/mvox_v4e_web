<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getToken } from '$lib/auth/storage';
	import MvoxNav from '$lib/components/MvoxNav.svelte';

	let { children } = $props();

	let mounted = $state(false);
	let signedIn = $state(false);

	function refreshSignedIn() {
		signedIn = getToken() !== null;
	}

	onMount(() => {
		refreshSignedIn();
		mounted = true;
		const onStorage = (e: StorageEvent) => {
			if (e.key === 'token' || e.key === null) refreshSignedIn();
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});

	$effect(() => {
		$page.url;
		refreshSignedIn();
	});

	const currentTab = $derived(
		$page.url.pathname.startsWith('/library')
			? 'library'
			: $page.url.pathname.startsWith('/roster')
				? 'roster'
				: $page.url.pathname.startsWith('/notices')
					? 'notices'
					: $page.url.pathname.startsWith('/settings')
						? 'settings'
						: 'agenda',
	);
</script>

{#if mounted}
	<MvoxNav
		signedIn={signedIn}
		currentTab={currentTab}
		userInitial="M"
		userName="Maire L."
		orgLabel="Estonian Philharmonic Chamber Choir"
		orgInitials="EP"
	/>
{/if}

{@render children()}
