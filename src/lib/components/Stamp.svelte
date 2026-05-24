<script lang="ts">
	type Tone = 'green' | 'red' | 'indigo';
	const { label, tone }: { label: string; tone: Tone } = $props();
	const toneClasses = $derived(
		({
			green: 'bg-green-soft border-green text-[#3c5320]',
			red: 'bg-red-soft border-red text-[#7a2418]',
			indigo: 'bg-indigo-soft border-indigo text-indigo',
		} as const)[tone],
	);
</script>

<span
	class="inline-block font-sans text-[11px] font-bold tracking-[0.14em] py-1 px-2.5 border-[1.5px] rounded-[3px] {toneClasses}"
	style="transform: rotate(-3deg)"
>{label}</span>
