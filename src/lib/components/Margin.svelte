<script lang="ts">
	import type { Snippet } from 'svelte';
	const {
		rotate = 0,
		children,
	}: { rotate?: number; children: Snippet } = $props();
</script>

<div class="font-display text-red text-[17px] leading-tight" style="transform: rotate({rotate}deg)">
	{@render children()}
</div>
