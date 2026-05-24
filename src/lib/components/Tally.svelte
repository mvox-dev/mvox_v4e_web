<script lang="ts">
	type Tone = 'default' | 'red';
	const { n, label, tone = 'default' }: { n: number | string; label: string; tone?: Tone } =
		$props();
	const numClass = $derived(tone === 'red' ? 'text-red' : 'text-ink');
</script>

<div class="flex items-baseline gap-2">
	<span data-tally-num class="font-display font-bold text-[56px] leading-[0.9] {numClass}"
		>{n}</span>
	<span class="font-sans text-[11px] text-ink-3 tracking-[0.06em] uppercase">{label}</span>
</div>
