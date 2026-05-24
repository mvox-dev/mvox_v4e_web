<script lang="ts">
	import type { Voice } from '$lib/types/library';
	const { v }: { v: Voice } = $props();
	const family = $derived(v[0] as 'S' | 'A' | 'T' | 'B');
	const bg = $derived(
		({ S: 'bg-voice-s', A: 'bg-voice-a', T: 'bg-voice-t', B: 'bg-voice-b' } as const)[family],
	);
</script>

<span
	class="inline-flex items-center justify-center min-w-[26px] px-1.5 h-[19px] border border-[1.25px] border-ink-2 rounded font-mono text-[10px] font-semibold text-ink {bg}"
>{v}</span>
