<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { tabForPath } from '$lib/nav/currentTab';
	import {
		userStore,
		selectedOrgStore,
		pickerModeStore,
		hydrateUserStore,
		urlOrgIdStore,
		selectedOrgIdStore,
		ORG_URL_PARAM_NAME,
	} from '$lib/auth/userStore';
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

	// CHORE-74: reactive URL → urlOrgIdStore propagation
	$effect(() => {
		if (!mounted) return;
		urlOrgIdStore.set(page.url.searchParams.get(ORG_URL_PARAM_NAME));
	});

	// CHORE-74: URL precedence write-through to selectedOrgIdStore
	$effect(() => {
		if (!mounted) return;
		const urlOrgId = page.url.searchParams.get(ORG_URL_PARAM_NAME);
		if (urlOrgId) selectedOrgIdStore.set(urlOrgId);
	});

	const signedIn = $derived($userStore.status === 'ready');
	const userName = $derived($userStore.status === 'ready' ? $userStore.name : '');
	const userInitial = $derived($userStore.status === 'ready' ? $userStore.initial : '');
	const orgLabel = $derived($selectedOrgStore?.label ?? '');
	const orgInitials = $derived($selectedOrgStore?.initials ?? '');
	const orgPickerMode = $derived($pickerModeStore);

	const currentTab = $derived(tabForPath(page.url.pathname));
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
