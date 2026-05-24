<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { userStore, selectedOrgStore, pickerModeStore, hydrateUserStore } from '$lib/auth/userStore';
	import MvoxNav from '$lib/components/MvoxNav.svelte';

	let { children } = $props();

	let mounted = $state(false);

	onMount(() => {
		hydrateUserStore();
		mounted = true;
		const onStorage = (e: StorageEvent) => {
			if (e.key === 'token' || e.key === null) hydrateUserStore();
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});

	const signedIn = $derived($userStore.status === 'ready');
	const userName = $derived($userStore.status === 'ready' ? $userStore.name : '');
	const userInitial = $derived($userStore.status === 'ready' ? $userStore.initial : '');
	const orgLabel = $derived($selectedOrgStore?.label ?? '');
	const orgInitials = $derived($selectedOrgStore?.initials ?? '');
	const orgPickerMode = $derived($pickerModeStore);

	const currentTab = $derived(
		page.url.pathname.startsWith('/library')
			? 'library'
			: page.url.pathname.startsWith('/roster')
				? 'roster'
				: page.url.pathname.startsWith('/notices')
					? 'notices'
					: page.url.pathname.startsWith('/settings')
						? 'settings'
						: 'agenda',
	);
</script>

{#if mounted}
	<MvoxNav
		{signedIn}
		{currentTab}
		{userName}
		{userInitial}
		{orgLabel}
		{orgInitials}
		{orgPickerMode}
	/>
{/if}

{@render children()}
