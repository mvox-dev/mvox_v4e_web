<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperCard from '$lib/components/PaperCard.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Margin from '$lib/components/Margin.svelte';
</script>

<DeskSurface>
	<div class="min-h-[80vh] flex flex-col items-center gap-6 py-12 px-6">
		<PaperCard rotate={-0.4} width="520px">
			<div class="flex flex-col gap-1 mb-6">
				<BrandMark size="m" />
				<h1
					data-testid="about-page-title"
					class="font-sans text-[28px] font-bold text-ink leading-tight tracking-[-0.01em] mt-4"
				>
					{m.about_page_title()}
				</h1>
				<p data-testid="about-intro" class="font-sans text-[13px] text-ink-2 leading-relaxed mt-2">
					{m.about_intro()}
				</p>
				<p
					data-testid="about-intro-circle"
					class="font-sans text-[13px] text-ink-2 leading-relaxed mt-2"
				>
					{m.about_intro_circle()}
				</p>
			</div>

			<section class="mb-6">
				<h2
					data-testid="about-mission-heading"
					class="font-sans text-[15px] font-semibold text-ink tracking-[-0.01em] mb-2"
				>
					{m.about_mission_heading()}
				</h2>
				<p data-testid="about-mission-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
					{m.about_mission_body()}
				</p>
			</section>

			<section class="mb-6">
				<h2
					data-testid="about-story-heading"
					class="font-sans text-[15px] font-semibold text-ink tracking-[-0.01em] mb-2"
				>
					{m.about_story_heading()}
				</h2>
				<p data-testid="about-story-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
					{m.about_story_body()}
				</p>
			</section>

			<section>
				<h2
					data-testid="about-values-heading"
					class="font-sans text-[15px] font-semibold text-ink tracking-[-0.01em] mb-2"
				>
					{m.about_values_heading()}
				</h2>
				<p data-testid="about-values-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
					{m.about_values_body()}
				</p>
				<p
					data-testid="about-values-offer"
					class="font-sans text-[13px] text-ink-2 leading-relaxed mt-3 border-l-2 border-ink/15 pl-3"
				>
					{m.about_values_offer()}
				</p>
				<p data-testid="about-contact" class="font-sans text-[13px] text-ink-2 leading-relaxed mt-3">
					{m.about_contact()}
					<a href="mailto:mihkel.putrinsh@gmail.com" class="text-ink underline underline-offset-2"
						>mihkel.putrinsh@gmail.com</a
					>
				</p>
			</section>
		</PaperCard>

		<Margin rotate={-1.2} exempt>{m.about_marginalia()}</Margin>
	</div>
</DeskSurface>
