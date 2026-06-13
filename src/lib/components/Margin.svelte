<script lang="ts">
	import type { Snippet } from 'svelte';
	const {
		rotate = 0,
		exempt = false,
		children,
	}: { rotate?: number; exempt?: boolean; children: Snippet } = $props();
</script>

<div
	class="font-display text-red text-[17px] leading-tight"
	style="transform: rotate({rotate}deg)"
	data-testid="margin-note"
	data-desk-text={exempt ? '' : undefined}
>
	{@render children()}
</div>
