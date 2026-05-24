<script lang="ts">
	import type { Work } from '$lib/types/library';
	import { workStats } from '$lib/library/derive';
	type PinnedTone = 'overdue' | 'tonight' | 'returns' | undefined;
	const { work, pinnedTone }: { work: Work; pinnedTone?: PinnedTone } = $props();
	const s = $derived(workStats(work));
	const topBorder = $derived(pinnedTone === 'overdue' ? 'border-t-[3px] border-t-red' : '');
	const fractionColor = $derived(
		s.overdue > 0 ? 'text-red' : s.available > 0 ? 'text-green' : 'text-ink-3',
	);
</script>

<div
	data-card
	class="px-2 py-1.5 bg-paper border border-ink-4 rounded-[3px] shadow-[1px_1px_0_0_var(--color-ink-5)] font-sans text-[10px] text-ink {topBorder}"
>
	<div class="font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{work.composer}</div>
	<div class="italic text-ink-2 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{work.title}</div>
	<div class="flex justify-between mt-1 font-mono text-[9px] text-ink-3">
		<span>{work.editions[0].voicing}</span>
		{#if s.has_limitless && s.total === 0}
			<span class="italic text-indigo">∞</span>
		{:else}
			<span class={fractionColor}>{s.available}/{s.total}</span>
		{/if}
	</div>
</div>
