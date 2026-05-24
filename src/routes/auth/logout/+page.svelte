<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { performLogout } from './perform-logout';
	import * as m from '$lib/paraglide/messages.js';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperCard from '$lib/components/PaperCard.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Stamp from '$lib/components/Stamp.svelte';
	import ProviderButton from '$lib/components/ProviderButton.svelte';
	import Margin from '$lib/components/Margin.svelte';

	let timer: ReturnType<typeof setTimeout> | null = null;
	let cancelled = $state(false);

	onMount(() => {
		performLogout();
		timer = setTimeout(() => goto('/'), 5000);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && timer) {
				clearTimeout(timer);
				timer = null;
				cancelled = true;
			}
		};
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			if (timer) clearTimeout(timer);
		};
	});
</script>

<DeskSurface>
	<div class="min-h-[80vh] flex flex-col items-center justify-center gap-5 py-12 px-6">
		<PaperCard rotate={0.4}>
			<BrandMark size="m" />
			<div class="flex items-center justify-center mt-8">
				<Stamp label={m.auth_logout_stamp()} tone="green" />
			</div>
			<div
				class="font-display text-[42px] font-bold text-ink leading-none tracking-[-0.01em] mt-7 text-center"
			>
				{m.auth_logout_heading()}
			</div>
			<div class="font-sans text-[12px] text-ink-3 mt-2 text-center leading-snug">
				{m.auth_logout_subtitle()}
			</div>
			<div class="mt-6 pt-4 border-t border-dashed border-ink-5 flex flex-col gap-2">
				<ProviderButton
					providerId="google"
					name={m.auth_logout_sign_back_in()}
					href="/auth/login"
					featured
				/>
				<a href="/" class="font-sans text-[11.5px] text-ink-3 text-center underline mt-1"
					>{m.auth_logout_return_home()}</a
				>
			</div>
			<div class="font-mono text-[10.5px] text-ink-4 mt-4 text-center">
				{#if cancelled}
					{m.auth_logout_cancelled()}
				{:else}
					{m.auth_logout_auto_redirect()} · {m.auth_logout_press_esc()}
				{/if}
			</div>
		</PaperCard>
		<Margin rotate={1.5}>
			thanks for stopping by →<br />
			<span class="text-[12px] text-ink-3">~ Maire (the librarian)</span>
		</Margin>
	</div>
</DeskSurface>
