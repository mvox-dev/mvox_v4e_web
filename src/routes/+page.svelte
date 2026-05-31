<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { userStore } from '$lib/auth/userStore';
	import LandingMarketing from '$lib/components/landing/LandingMarketing.svelte';
	import LandingDashboard from '$lib/components/landing/LandingDashboard.svelte';

	const isReady = $derived($userStore.status === 'ready');
</script>

{#if isReady}
	<LandingDashboard />
{:else}
	<LandingMarketing />
{/if}
