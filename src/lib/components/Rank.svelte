<script lang="ts">
	type Tone = 'neutral' | 'green' | 'red' | 'indigo';
	const { n, tone = 'neutral' }: { n: number | string; tone?: Tone } = $props();
	const toneClasses = $derived(
		({
			neutral: 'bg-paper border-ink-2 text-ink',
			green: 'bg-green-soft border-green text-[#3c5320]',
			red: 'bg-red-soft border-red text-[#7a2418]',
			indigo: 'bg-indigo-soft border-indigo text-indigo',
		} as const)[tone],
	);
</script>

<span
	class="inline-flex items-center justify-center w-[28px] h-[28px] border-2 rounded-full font-display text-[18px] font-bold shrink-0 {toneClasses}"
>{n}</span>
