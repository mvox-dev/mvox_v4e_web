<script lang="ts">
	const {
		placeholder = 'Search composer, work, edition…',
		hint = '',
	}: { placeholder?: string; hint?: string } = $props();
</script>

<div
	class="flex items-center gap-2 py-2 px-3 border-[1.5px] border-ink-2 rounded-md bg-paper shadow-[2px_2px_0_0_var(--color-ink-4)]"
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="1.8"
		fill="none"
		stroke-linecap="round"
		class="text-ink-3"
	>
		<circle cx="11" cy="11" r="6" />
		<path d="m20 20-4-4" />
	</svg>
	<input
		type="search"
		{placeholder}
		class="flex-1 border-none outline-none bg-transparent font-sans text-[13px] text-ink placeholder:text-ink-4"
	/>
	{#if hint}
		<span
			class="inline-block min-w-[18px] px-1.5 h-[18px] leading-[16px] border border-[1.5px] border-b-[2.5px] border-ink-3 rounded font-mono text-[10px] bg-paper text-ink-2 text-center"
			>{hint}</span
		>
	{/if}
</div>
