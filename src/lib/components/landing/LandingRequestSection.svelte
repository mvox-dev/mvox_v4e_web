<!-- src/lib/components/landing/LandingRequestSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	const ctaHref = 'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox';
</script>

<section data-testid="landing-request-section" class="relative w-full pt-[78px] pb-16 px-5 flex flex-col items-center">
	<div class="relative w-full max-w-[340px]">
		<span
			aria-hidden="true"
			class="absolute -top-3 right-4 bg-paper-3 border-2 border-ink-2 text-ink rounded px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest z-10"
			style="transform: rotate(6deg);"
		>{m.landing_request_stamp()}</span>
		<div class="relative bg-paper rounded p-[36px_28px_30px] border border-ink/10 shadow-md">
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-ink opacity-85 rounded-l" aria-hidden="true"></span>
			<div class="font-mono text-xs text-ink-3 tracking-widest uppercase mb-3.5 font-semibold">{m.landing_request_eyebrow()}</div>
			<h2 class="text-2xl font-bold tracking-tight leading-tight mb-3.5 text-ink">{m.landing_request_heading()}</h2>
			<p class="text-sm text-ink-2 leading-relaxed mb-6">{m.landing_request_body()}</p>
			<div class="font-mono text-sm text-ink bg-paper-2 px-3.5 py-3 rounded border border-dashed border-ink-4 mb-3.5 text-center tracking-wide">hello@mvox.eu</div>
			<a
				data-testid="request-cta"
				href={ctaHref}
				class="flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3.5 rounded-lg font-semibold text-[15px] no-underline w-full mb-3.5"
			>{m.landing_request_cta()} <span class="font-display text-2xl leading-none -translate-y-px" aria-hidden="true">→</span></a>
			<p class="text-center font-display text-lg text-ink-3" style="transform: rotate(-1.5deg);">{m.landing_request_marginalia()}</p>
		</div>
	</div>
</section>
