<!-- src/lib/components/landing/LandingInvitesSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<section data-testid="landing-invites-section" class="relative w-full pt-[90px] pb-16 px-5 flex flex-col items-center">
	<div class="relative w-full max-w-[340px]">
		<span
			aria-hidden="true"
			class="absolute -top-7 right-6 border-[3px] border-red text-red rounded-full w-20 h-20 flex flex-col items-center justify-center text-center font-mono text-[9.5px] font-bold tracking-widest leading-tight bg-paper/85 z-10"
			style="transform: rotate(6deg);"
		>{m.landing_invites_stamp()}</span>
		<div
			class="relative bg-paper rounded p-[34px_26px_28px] border border-ink/10 shadow-md"
			style="transform: rotate(-1deg);"
		>
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-red opacity-60 rounded-l" aria-hidden="true"></span>
			<div class="font-mono text-xs text-red tracking-widest uppercase mb-3.5 font-semibold">{m.landing_invites_eyebrow()}</div>
			<h2 class="text-[22px] font-bold tracking-tight leading-tight mb-3.5 text-ink max-w-[240px]">{m.landing_invites_heading()}</h2>
			<p class="text-sm text-ink-2 leading-relaxed mb-2.5">{@html m.landing_invites_body_1_html()}</p>
			<p class="text-sm text-ink-2 leading-relaxed">{m.landing_invites_body_2()}</p>
		</div>
	</div>
	<div class="absolute bottom-9 left-0 right-0 text-center font-display text-[19px] text-ink-2" style="transform: rotate(-2deg);">
		{m.landing_invites_marginalia()}
	</div>
</section>
