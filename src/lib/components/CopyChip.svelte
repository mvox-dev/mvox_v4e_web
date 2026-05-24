<script lang="ts">
	import PencilCheckbox from './PencilCheckbox.svelte';
	const { n, checked }: { n: string; checked: boolean } = $props();
	const cellBg = $derived(checked ? 'bg-[rgba(95,122,59,0.12)]' : 'bg-paper');
	const numColor = $derived(checked ? 'text-ink-3 line-through' : 'text-ink');
</script>

<div
	data-cell
	class="flex items-center justify-center gap-1 px-1 py-1.5 border border-ink-5 rounded-[3px] {cellBg}"
>
	<PencilCheckbox {checked} />
	<span data-num class="font-mono text-[10px] font-semibold {numColor}">{n}</span>
</div>
