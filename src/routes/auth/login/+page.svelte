<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getLastProvider } from '$lib/auth/storage';
	import * as m from '$lib/paraglide/messages.js';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperCard from '$lib/components/PaperCard.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import ProviderButton from '$lib/components/ProviderButton.svelte';
	import Margin from '$lib/components/Margin.svelte';

	type Provider = { id: string; label: string };
	const { data }: { data: { providers: Provider[] } } = $props();

	const error = $derived(page.url.searchParams.get('error'));
	// The server-side auth guard redirects here with `?redirect=<path>` (CHORE-79).
	// Accept it as the post-login destination; fall back to the existing `return_to`.
	// Keep only safe local paths (must start with `/`, not `//`) — open-redirect guard.
	const returnTo = $derived.by(() => {
		const raw = page.url.searchParams.get('redirect') ?? page.url.searchParams.get('return_to');
		return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	});
	const lastProvider = $state(typeof window !== 'undefined' ? getLastProvider() : null);

	onMount(() => {
		if (error) return;
		if (page.url.searchParams.get('picker') === '1') return;

		const remembered = getLastProvider();
		if (remembered) {
			goto(`/auth/${remembered}?return_to=${encodeURIComponent(returnTo)}&intent=reauth`);
		}
	});

	const PROVIDER_NAMES: Record<string, { name: string; sub: string }> = {
		'smart-id': { name: 'Smart-ID', sub: 'EE/LV/LT' },
		'mobile-id': { name: 'Mobile-ID', sub: 'EE' },
		'id-card': { name: 'ID-card', sub: 'EE' },
		google: { name: 'Continue with Google', sub: '' },
		apple: { name: 'Apple', sub: '' },
		'e-mail': { name: 'E-mail', sub: 'magic link' },
	};

	const ordered = $derived(
		lastProvider
			? [
					data.providers.find((p) => p.id === lastProvider),
					...data.providers.filter((p) => p.id !== lastProvider),
				].filter((p): p is Provider => p !== undefined && p !== null)
			: data.providers,
	);
</script>

<DeskSurface>
	<div class="min-h-[80vh] flex flex-col items-center justify-center gap-5 py-12 px-6">
		<PaperCard rotate={-0.6}>
			<BrandMark size="m" />
			<div class="font-sans text-[10px] tracking-[0.16em] uppercase text-ink-3 font-semibold mt-4">
				{m.auth_login_eyebrow()}
			</div>
			<div
				class="font-display text-[38px] font-bold text-ink leading-none tracking-[-0.01em] mt-0.5"
			>
				{m.auth_login_heading()}
			</div>
			<div class="font-sans text-[12px] text-ink-3 mt-1.5">{m.auth_login_subtitle()}</div>

			{#if error}
				<div
					class="mt-5 rounded-md bg-red-soft px-3 py-2 text-[12px] text-[#7a2418] border border-red"
					role="alert"
				>
					{#if error === 'csrf_mismatch'}{m.auth_error_csrf_mismatch()}
					{:else if error === 'missing_session_token'}{m.auth_error_missing_session_token()}
					{:else}{m.common_error()}{/if}
				</div>
			{/if}

			{#if lastProvider && !error}
				<div
					class="font-sans text-[9px] tracking-[0.14em] uppercase text-ink-3 font-semibold mt-6 mb-2"
				>
					{m.auth_login_last_used()}
				</div>
				{@const lp = data.providers.find((p) => p.id === lastProvider)}
				{#if lp}
					{@const meta = PROVIDER_NAMES[lp.id] ?? { name: lp.label, sub: '' }}
					<ProviderButton
						providerId={lp.id as any}
						name={meta.name}
						sub={meta.sub}
						featured
						testId={`provider-${lp.id}`}
						href={`/auth/${lp.id}?return_to=${encodeURIComponent(returnTo)}&intent=reauth`}
					/>
				{/if}
				<div
					class="font-sans text-[9px] tracking-[0.14em] uppercase text-ink-3 font-semibold mt-6 mb-2"
				>
					{m.auth_login_all_providers()}
				</div>
			{/if}

			<div class="flex flex-col gap-2 mt-{lastProvider && !error ? '0' : '5'}">
				{#each ordered.filter((p) => !lastProvider || p.id !== lastProvider) as provider (provider.id)}
					{@const meta = PROVIDER_NAMES[provider.id] ?? { name: provider.label, sub: '' }}
					<ProviderButton
						providerId={provider.id as any}
						name={meta.name}
						sub={meta.sub}
						testId={`provider-${provider.id}`}
						href={`/auth/${provider.id}?return_to=${encodeURIComponent(returnTo)}&intent=login`}
					/>
				{/each}
			</div>

			<div
				class="font-sans text-[11px] text-ink-3 mt-6 pt-3.5 border-t border-dashed border-ink-5 leading-snug"
			>
				{m.auth_login_footnote()}
			</div>
		</PaperCard>
		<Margin rotate={-1.5} exempt>~ multivox.pages.dev · v0.4</Margin>
	</div>
</DeskSurface>
