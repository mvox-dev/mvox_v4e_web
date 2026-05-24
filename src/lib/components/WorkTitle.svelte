<script lang="ts">
	type Size = 's' | 'm' | 'l' | 'xl';
	const {
		work,
		size = 'm',
		italic = true,
	}: {
		work: { composer: string; title: string; title_alt?: string };
		size?: Size;
		italic?: boolean;
	} = $props();

	const sizeClass = $derived(
		({ s: 'text-[13px]', m: 'text-[15px]', l: 'text-[19px]', xl: 'text-[24px]' } as const)[size],
	);
	const italicClass = $derived(italic ? 'italic' : '');
</script>

<span data-worktitle class="font-sans leading-tight text-ink {sizeClass}">
	<span class="font-semibold">{work.composer}</span>
	<span class="text-ink-3 mx-1">—</span>
	<span data-title class={italicClass}>{work.title}</span>
	{#if work.title_alt}<span class="text-ink-4 font-sans text-[11px] ml-1.5">/ {work.title_alt}</span>{/if}
</span>
