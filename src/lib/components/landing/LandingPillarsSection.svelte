<!-- src/lib/components/landing/LandingPillarsSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LandingPillarCard from './LandingPillarCard.svelte';
</script>

<section data-testid="landing-pillars-section" class="relative w-full pt-[78px] pb-12 px-4">
	<header class="text-center mb-8 px-6">
		<div class="font-mono text-xs text-ink-3 tracking-widest uppercase font-semibold mb-2">{m.landing_pillars_eyebrow()}</div>
		<h2 class="text-2xl font-bold tracking-tight text-ink leading-tight">{m.landing_pillars_heading()}</h2>
	</header>
	<div class="grid grid-cols-2 gap-3.5">
		<LandingPillarCard variant="library" status="shipped" />
		<LandingPillarCard variant="roster" status="indev" />
		<LandingPillarCard variant="notes" status="coming" />
		<LandingPillarCard variant="repertoire" status="coming" />
	</div>
</section>
