<script lang="ts">
	const {
		rotate = 0,
		width = '380px',
		children,
	}: { rotate?: number; width?: string; children: import('svelte').Snippet } = $props();
</script>

<div
	data-card
	data-testid="paper-card"
	class="bg-paper border-[1.5px] border-ink rounded-md p-8 shadow-[4px_6px_0_0_rgba(0,0,0,0.08)]"
	style="transform: rotate({rotate}deg); width: {width}; max-width: 100%"
>
	{@render children()}
</div>
