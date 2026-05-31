<!-- src/lib/components/landing/LandingDashboardGreet.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		name: string;
		org: string | null;
	};

	let { name, org }: Props = $props();
</script>

<header data-testid="landing-dashboard-greet" class="absolute top-[76px] left-0 right-0 text-center px-6 z-20">
	<div class="font-mono text-[10px] text-ink-3 tracking-widest uppercase mb-1.5">{m.landing_dashboard_eyebrow()}</div>
	<h1 class="text-2xl font-bold tracking-tight text-ink leading-tight">{m.landing_dashboard_greeting({ name })}</h1>
	{#if org}
		<div class="mt-1.5 font-display text-lg text-ink-3 inline-block" style="transform: rotate(-1.5deg);">{m.landing_dashboard_marginalia({ org })}</div>
	{/if}
</header>
