<script lang="ts">
	const { k, label = '' }: { k: string; label?: string } = $props();
</script>

<span class="inline-flex items-center gap-1.5 font-sans text-[11px] text-ink-3">
	<span class="inline-block min-w-[18px] px-1.5 h-[18px] leading-[16px] border border-[1.5px] border-b-[2.5px] border-ink-3 rounded font-mono text-[10px] bg-paper text-ink-2 text-center">{k}</span>
	{#if label}<span>{label}</span>{/if}
</span>
