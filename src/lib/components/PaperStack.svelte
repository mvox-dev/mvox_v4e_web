<script lang="ts">
	type Tone = 'default' | 'red';
	const {
		rotate = 0,
		tone = 'default',
		children,
	}: { rotate?: number; tone?: Tone; children: import('svelte').Snippet } = $props();
	const borderClass = $derived(tone === 'red' ? 'border-red' : 'border-ink-2');
</script>

<div
	data-stack
	class="bg-paper border-[1.5px] {borderClass} rounded relative shadow-[2px_3px_0_0_rgba(0,0,0,0.08)] flex flex-col"
	style="transform: rotate({rotate}deg)"
>
	<div
		class="absolute inset-0 -z-10 border-[1.5px] border-ink-2 rounded bg-paper"
		style="transform: rotate(-1.1deg) translate(2px, 3px)"
	></div>
	<div
		class="absolute inset-0 -z-20 border-[1.5px] border-ink-2 rounded bg-paper-2"
		style="transform: rotate(0.8deg) translate(-3px, 5px)"
	></div>
	<div class="px-3.5 py-4 flex flex-col h-full">
		{@render children()}
	</div>
</div>
