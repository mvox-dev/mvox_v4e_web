<script lang="ts">
	import PencilCheckbox from './PencilCheckbox.svelte';
	import type { Work, Edition } from '$lib/types/library';
	const {
		work,
		edition,
		pulled,
		needed,
	}: { work: Work; edition: Edition; pulled: number; needed: number } = $props();
	const done = $derived(pulled >= needed);
	const bg = $derived(done ? 'bg-[rgba(95,122,59,0.10)] border-green' : 'bg-paper-2 border-ink-2');
	const tallyColor = $derived(done ? 'text-green' : 'text-ink');
	const labelColor = $derived(done ? 'text-green' : 'text-ink-3');
</script>

<div class="px-2.5 py-2 border-[1.5px] rounded-[3px] {bg}">
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1 flex items-start gap-1.5">
			<span class="mt-0.5"><PencilCheckbox checked={done} /></span>
			<div class="flex-1">
				<div class="font-sans text-[11.5px] font-semibold text-ink">{work.composer}</div>
				<div class="font-sans text-[11.5px] italic text-ink leading-tight">{work.title}</div>
				{#if work.title_alt}<div class="font-sans text-[10px] text-ink-4">/ {work.title_alt}</div>{/if}
			</div>
		</div>
		<div class="text-right">
			<div class="font-display font-bold text-[28px] {tallyColor} leading-none">{done ? pulled : needed}</div>
			<div class="font-sans text-[8px] uppercase tracking-wider {labelColor}">{done ? 'pulled' : 'to pull'}</div>
		</div>
	</div>
	{#if done}
		<div class="flex justify-end items-center gap-1.5 mt-2">
			<span class="font-display text-[12px] text-green mr-auto">✓ on the desk</span>
			<button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Undo</button>
		</div>
	{:else}
		<div class="flex justify-end gap-1.5 mt-2">
			<button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Locate</button>
			<button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Skip</button>
			<button type="button" class="text-[10px] py-0.5 px-2 border-[1.5px] border-ink bg-ink text-paper rounded-[3px]">Pull {needed} →</button>
		</div>
	{/if}
</div>
