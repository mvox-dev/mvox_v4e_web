<script lang="ts">
	import Voice from './Voice.svelte';
	import type { Member, Loan } from '$lib/types/library';
	const { member, loans }: { member: Member; loans: Loan[] } = $props();
	const initials = $derived(
		member.name
			.split(' ')
			.map((s) => s[0])
			.join(''),
	);
	const since = $derived(loans[0]?.since ?? '');
	const days = $derived(loans[0]?.days_overdue ?? 0);
</script>

<div
	class="px-2.5 py-2 bg-[rgba(181,74,58,0.08)] border border-red rounded-[3px] flex items-center gap-2"
>
	<div
		class="w-[30px] h-[30px] rounded-full bg-voice-b border border-[1.25px] border-ink-3 inline-flex items-center justify-center font-display text-[14px] font-bold shrink-0"
	>{initials}</div>
	<div class="flex-1 min-w-0">
		<div class="font-sans text-[11px] font-semibold text-ink">
			{member.name} <Voice v={member.voice} />
		</div>
		<div class="font-mono text-[10px] text-ink-3">
			{loans.map((l) => l.copy).join(' · ')} · out {since}
		</div>
		<div class="font-display text-[13px] text-red">{days} days overdue</div>
	</div>
	<div class="flex flex-col gap-1">
		<button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Nudge</button>
		<button type="button" class="text-[10px] py-0.5 px-2 border-[1.25px] border-ink-2 bg-paper text-ink rounded-[3px]">Return</button>
	</div>
</div>
