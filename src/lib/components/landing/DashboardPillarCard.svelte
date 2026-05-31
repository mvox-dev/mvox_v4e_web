<!-- src/lib/components/landing/DashboardPillarCard.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		variant: 'library' | 'roster' | 'notes' | 'repertoire';
		status: 'shipped' | 'indev' | 'coming';
		meta: string;
		href?: string;
		lbl?: string;
	};

	let { variant, status, meta, href, lbl }: Props = $props();

	const borderColorByVariant: Record<Props['variant'], string> = {
		library: 'bg-red',
		roster: 'bg-amber',
		notes: 'bg-ink-3',
		repertoire: 'bg-ink-3',
	};

	const rotationByVariant: Record<Props['variant'], number> = {
		library: -2,
		roster: 2.5,
		notes: -3,
		repertoire: 1.5,
	};

	const titleByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_title() :
		variant === 'roster' ? m.landing_pillar_roster_title() :
		variant === 'notes' ? m.landing_pillar_notes_title() :
		m.landing_pillar_repertoire_title()
	);

	const isDisabled = $derived(href === undefined);
</script>

{#if href}
	<a
		data-testid="dashboard-pillar-card"
		{href}
		class="relative block bg-paper rounded-sm border border-ink/10 shadow-md p-4 pb-3.5 no-underline"
		style="transform: rotate({rotationByVariant[variant]}deg);"
	>
		<span class="absolute left-0 top-0 bottom-0 w-[3px] {borderColorByVariant[variant]} opacity-70 rounded-l-sm" aria-hidden="true"></span>
		{#if lbl}<div class="font-mono text-[9.5px] text-ink-3 tracking-widest uppercase mb-1">{lbl}</div>{/if}
		<h3 class="text-base font-bold text-ink tracking-tight flex items-center justify-between">{titleByVariant}<span class="font-display text-xl text-ink-3 -translate-y-0.5" aria-hidden="true">→</span></h3>
		<div class="text-xs text-ink-3 leading-snug mt-1">{@html meta}</div>
	</a>
{:else}
	<button
		data-testid="dashboard-pillar-card"
		type="button"
		disabled
		class="relative block w-full text-left bg-paper rounded-sm border border-ink/10 shadow-md p-4 pb-3.5 opacity-90 cursor-not-allowed"
		style="transform: rotate({rotationByVariant[variant]}deg);"
		aria-label="{titleByVariant} — coming soon"
	>
		<span class="absolute left-0 top-0 bottom-0 w-[3px] {borderColorByVariant[variant]} opacity-70 rounded-l-sm" aria-hidden="true"></span>
		<span class="absolute top-2.5 right-2.5 font-mono text-[8.5px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-paper-3 text-ink-3 border border-ink-5">{m.landing_dashboard_badge_soon()}</span>
		{#if lbl}<div class="font-mono text-[9.5px] text-ink-3 tracking-widest uppercase mb-1">{lbl}</div>{/if}
		<h3 class="text-base font-bold text-ink tracking-tight">{titleByVariant}</h3>
		<div class="text-xs text-ink-3 leading-snug mt-1">{meta}</div>
	</button>
{/if}
