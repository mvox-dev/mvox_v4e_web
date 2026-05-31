<!-- src/lib/components/landing/LandingFooter.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { setLanguageTag, languageTag } from '$lib/paraglide/runtime.js';

	const locales = ['en', 'et', 'lv', 'uk'] as const;
	type Locale = (typeof locales)[number];

	let currentLocale = $state<Locale>(languageTag() as Locale);

	function pick(locale: Locale) {
		setLanguageTag(locale);
		currentLocale = locale;
	}
</script>

<footer data-testid="landing-footer" class="relative w-full bg-ink text-paper min-h-[360px]">
	<div class="px-6 py-10 pb-7 flex flex-col gap-6 h-full">
		<div class="flex items-center gap-2.5">
			<span aria-hidden="true" class="inline-flex items-center justify-center w-8 h-8 bg-paper text-ink rounded-md font-display font-bold text-2xl leading-none">m</span>
			<span class="font-bold text-lg text-paper">mvox</span>
		</div>
		<div class="text-sm text-ink-4 leading-relaxed">{m.landing_footer_tagline()}</div>
		<nav class="flex flex-col gap-2.5 pt-4 border-t border-paper/10">
			<a href="/about" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_about()}</a>
			<a href="https://github.com/entu/research#v4e" target="_blank" rel="noopener noreferrer" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_openinfra()}</a>
			<a href="mailto:hello@mvox.eu" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_contact()}</a>
			<a href="https://github.com/mvox-dev/mvox_v4e_web" target="_blank" rel="noopener noreferrer" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_source()}</a>
		</nav>
		<div class="flex gap-3 flex-wrap pt-4 border-t border-paper/10">
			{#each locales as locale}
				<button
					type="button"
					data-testid="locale-chip-{locale}"
					onclick={() => pick(locale)}
					class="font-mono text-[11px] px-2 py-1 rounded uppercase tracking-wider border border-paper/15 text-ink-4 {currentLocale === locale ? 'bg-paper text-ink border-paper' : ''}"
				>{locale}</button>
			{/each}
		</div>
		<div class="mt-auto pt-4 border-t border-paper/10 font-mono text-[10.5px] text-ink-4 tracking-wide flex justify-between">
			<span>{m.landing_footer_micro_year()}</span><span>{m.landing_footer_micro_invite()}</span>
		</div>
	</div>
</footer>
