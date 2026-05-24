<script lang="ts">
	type ProviderId = 'smart-id' | 'mobile-id' | 'id-card' | 'google' | 'apple' | 'e-mail';
	const {
		providerId,
		name,
		sub = '',
		href,
		featured = false,
		testId = '',
	}: {
		providerId: ProviderId;
		name: string;
		sub?: string;
		href: string;
		featured?: boolean;
		testId?: string;
	} = $props();
	const bg = $derived(
		featured
			? 'bg-highlight border-ink shadow-[3px_3px_0_0_var(--color-ink-2)]'
			: 'bg-paper border-ink-2 shadow-[2px_2px_0_0_var(--color-ink-4)]',
	);
	const iconBg = $derived(
		({
			'smart-id': 'bg-[#003b95] text-white',
			'mobile-id': 'bg-[#003b95] text-white',
			'id-card': 'bg-[#003b95] text-white',
			google: 'bg-[#4285f4] text-white',
			apple: 'bg-paper text-ink',
			'e-mail': 'bg-paper text-ink',
		} as const)[providerId],
	);
	const iconLabel = $derived(
		({
			'smart-id': 'ID',
			'mobile-id': 'M·ID',
			'id-card': 'ID',
			google: 'G',
			apple: '',
			'e-mail': '✉',
		} as const)[providerId],
	);
</script>

<a
	{href}
	data-testid={testId}
	class="flex items-center gap-3 py-2.5 px-3.5 border-[1.5px] rounded font-sans text-[13px] text-ink w-full text-left transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] {bg}"
>
	<span
		class="w-5 h-5 inline-flex items-center justify-center font-bold text-[12px] rounded-sm {iconBg}"
		>{iconLabel}</span
	>
	<span class="flex-1 font-medium">{name}</span>
	{#if sub}<span class="font-mono text-[10.5px] text-ink-3">{sub}</span>{/if}
</a>
