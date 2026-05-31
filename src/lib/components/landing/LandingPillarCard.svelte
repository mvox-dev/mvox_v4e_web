<!-- src/lib/components/landing/LandingPillarCard.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		variant: 'library' | 'roster' | 'notes' | 'repertoire';
		status: 'shipped' | 'indev' | 'coming';
	};

	let { variant, status }: Props = $props();

	const rotationByVariant: Record<Props['variant'], number> = {
		library: -1.2,
		roster: 0.8,
		notes: 0.6,
		repertoire: -0.6,
	};

	const titleByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_title() :
		variant === 'roster' ? m.landing_pillar_roster_title() :
		variant === 'notes' ? m.landing_pillar_notes_title() :
		m.landing_pillar_repertoire_title()
	);

	const bodyByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_body() :
		variant === 'roster' ? m.landing_pillar_roster_body() :
		variant === 'notes' ? m.landing_pillar_notes_body() :
		m.landing_pillar_repertoire_body()
	);

	const badgeText = $derived(
		status === 'shipped' ? m.landing_pillar_badge_shipped() :
		status === 'indev' ? m.landing_pillar_badge_indev() :
		m.landing_pillar_badge_coming()
	);

	const badgeClasses = $derived(
		status === 'shipped' ? 'bg-green-soft text-green' :
		status === 'indev' ? 'bg-amber-soft text-amber' :
		'bg-paper-3 text-ink-3 border border-ink-5'
	);
</script>

<article
	data-testid="landing-pillar-card"
	class="relative bg-paper rounded-sm border border-ink/10 shadow-md p-4 h-52"
	style="transform: rotate({rotationByVariant[variant]}deg);"
>
	<span
		aria-label="{titleByVariant} — {badgeText}"
		class="absolute top-2.5 right-2.5 font-mono text-[8.5px] font-semibold tracking-wider px-1.5 py-0.5 rounded {badgeClasses}"
	>
		{badgeText}
	</span>
	<div class="h-16 mb-2.5 flex items-end" aria-hidden="true">
		<!-- icon-paper-thumbnail per variant — visual decoration only -->
		<div class="w-12 h-14 bg-paper-2 border border-ink-4 rounded-sm"></div>
	</div>
	<h3 class="text-sm font-bold text-ink mb-1 tracking-tight">{titleByVariant}</h3>
	<p class="text-[11.5px] text-ink-3 leading-snug">{bodyByVariant}</p>
</article>
