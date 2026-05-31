<!-- src/lib/components/landing/LandingDashboard.svelte -->
<script lang="ts">
	import DeskSurface from '../DeskSurface.svelte';
	import LandingDashboardGreet from './LandingDashboardGreet.svelte';
	import LandingDashboardScatter from './LandingDashboardScatter.svelte';
	import { userStore, selectedOrgStore } from '$lib/auth/userStore';

	const userName = $derived($userStore.status === 'ready' ? $userStore.name : '');
	const orgLabel = $derived($selectedOrgStore?.label ?? null);
	const orgInitials = $derived($selectedOrgStore?.initials ?? '');
</script>

<DeskSurface>
	<LandingDashboardGreet name={userName} org={orgLabel} />
	<LandingDashboardScatter orgInitials={orgInitials} />
</DeskSurface>
