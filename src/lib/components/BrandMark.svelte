<script lang="ts">
	type Size = 's' | 'm' | 'l';
	const { size = 'm' }: { size?: Size } = $props();
	const tileSize = $derived(({ s: 18, m: 24, l: 32 } as const)[size]);
	const tileFont = $derived(({ s: 14, m: 18, l: 22 } as const)[size]);
	const wordClass = $derived(
		({ s: 'text-[13px]', m: 'text-[15px]', l: 'text-[22px]' } as const)[size],
	);
</script>

<div class="inline-flex items-baseline gap-1.5">
	<span
		class="rounded-[7px] bg-ink text-paper font-display font-bold inline-flex items-center justify-center"
		style="width:{tileSize}px; height:{tileSize}px; font-size:{tileFont}px"
	>m</span>
	<span data-wordmark class="font-sans font-bold tracking-[-0.01em] text-ink {wordClass}">mvox</span>
</div>
