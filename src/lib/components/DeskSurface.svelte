<script lang="ts">
	import type { Snippet } from 'svelte';
	const { children }: { children: Snippet } = $props();
</script>

<div
	data-desk
	class="w-full"
	style="
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255,235,180,0.4), transparent 60%),
      radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.06), transparent 50%),
      repeating-linear-gradient(110deg, #d6c39a 0 2px, #d8c79e 2px 6px, #d4be94 6px 10px),
      #d3bf95;
  "
>
	{@render children()}
</div>
