<script lang="ts">
	import Voice from './Voice.svelte';
	import type { Voice as VoiceType } from '$lib/types/library';

	const { counts }: { counts: Partial<Record<VoiceType, number>> } = $props();
	const entries = $derived(Object.entries(counts) as [VoiceType, number][]);
</script>

<div class="inline-flex gap-2 items-center">
	{#each entries as [v, n] (v)}
		<span class="inline-flex items-center gap-1">
			<Voice {v} />
			<span class="font-mono text-[11px] text-ink-2">×{n}</span>
		</span>
	{/each}
</div>
