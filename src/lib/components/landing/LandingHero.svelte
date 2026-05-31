<!-- src/lib/components/landing/LandingHero.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	// mailto: subject pre-fill; body omitted by design
	const ctaHref = 'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox';
</script>

<section
	data-testid="landing-hero"
	class="relative w-full min-h-[680px] pt-[78px] flex flex-col items-center"
>
	<div class="relative flex flex-col items-center">
		<!-- back: roster decorative card -->
		<div
			data-testid="hero-roster-card"
			class="relative bg-paper-2 rounded-sm border border-ink/10 shadow-md px-4 py-3.5 -mb-5 z-10"
			style="width: 300px; height: 64px; transform: rotate(-3deg);"
			aria-hidden="true"
		>
			<div class="h-1.5 bg-ink-4 opacity-50 rounded-sm mb-1.5" style="width: 60%"></div>
			<div class="h-1.5 bg-ink-4 opacity-40 rounded-sm mb-1.5" style="width: 80%"></div>
			<div class="h-1.5 bg-ink-4 opacity-40 rounded-sm" style="width: 50%"></div>
		</div>
		<!-- middle: library decorative card -->
		<div
			data-testid="hero-library-card"
			class="relative bg-paper rounded-sm border border-ink/10 shadow-md px-4 py-3.5 flex items-center gap-2.5 -mb-5 z-20"
			style="width: 310px; height: 60px; transform: rotate(2.5deg);"
			aria-hidden="true"
		>
			<span class="font-mono text-[10px] text-ink-3 tracking-widest uppercase">EFK ·</span>
			<span class="text-[13px] font-semibold text-ink-2">Library</span>
		</div>
		<!-- front: hero content card -->
		<div
			data-testid="hero-content-card"
			class="relative bg-paper rounded-sm border border-ink/10 shadow-md p-[30px_26px_28px] z-30"
			style="width: 340px; transform: rotate(-1deg);"
		>
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-red opacity-70 rounded-l-sm" aria-hidden="true"></span>
			<span
				class="absolute top-3.5 right-3.5 border-2 border-red text-red rounded px-2 py-1 font-mono text-[9px] font-semibold tracking-widest bg-paper/50"
				style="transform: rotate(8deg);"
				aria-hidden="true"
			>{m.landing_hero_stamp()}</span>
			<div class="font-mono text-[10px] text-red tracking-widest uppercase mb-2.5 font-semibold">{m.landing_hero_eyebrow()}</div>
			<h1 class="text-[28px] font-bold tracking-tight leading-tight mb-3 text-ink">{m.landing_hero_headline()}</h1>
			<p class="text-sm text-ink-2 leading-relaxed mb-5">{m.landing_hero_sub()}</p>
			<a
				data-testid="hero-cta"
				href={ctaHref}
				class="flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3.5 rounded-lg font-semibold text-[15px] no-underline w-full"
			>
				{m.landing_hero_cta()} <span class="font-display text-2xl leading-none -translate-y-px" aria-hidden="true">→</span>
			</a>
		</div>
	</div>
	<div
		class="absolute bottom-8 left-0 right-0 text-center font-display text-[19px] text-ink-2"
		style="transform: rotate(-2deg);"
	>
		{m.landing_hero_already_invited()}{' '}
		<a data-testid="hero-signin" href="/auth/login" class="border-b border-current">{m.landing_hero_sign_in()}</a>
		<span class="inline-block translate-y-0.5" aria-hidden="true">↗</span>
	</div>
</section>
