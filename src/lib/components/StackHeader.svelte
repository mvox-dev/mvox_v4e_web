<script lang="ts">
	import Rank from './Rank.svelte';
	import Stamp from './Stamp.svelte';
	type Tone = 'green' | 'red' | 'indigo';
	const {
		rank,
		title,
		subtitle,
		tone,
		stamp,
	}: { rank: number; title: string; subtitle: string; tone: Tone; stamp: string } = $props();
</script>

<div class="relative">
	<div class="flex items-center gap-2.5">
		<Rank n={rank} {tone} />
		<div class="flex-1">
			<div class="font-display text-[28px] font-bold text-ink leading-none tracking-[-0.01em]">
				{title}
			</div>
			<div class="font-sans text-[11px] text-ink-3">{subtitle}</div>
		</div>
		<Stamp label={stamp} {tone} />
	</div>
</div>
