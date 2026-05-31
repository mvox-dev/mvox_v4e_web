<!-- src/lib/components/landing/LandingMarketing.svelte -->
<script lang="ts">
	import DeskSurface from '../DeskSurface.svelte';
	import LandingHero from './LandingHero.svelte';
	import LandingPillarsSection from './LandingPillarsSection.svelte';
	import LandingInvitesSection from './LandingInvitesSection.svelte';
	import LandingRequestSection from './LandingRequestSection.svelte';
	import LandingFooter from './LandingFooter.svelte';
</script>

<DeskSurface>
	<LandingHero />
	<LandingPillarsSection />
	<LandingInvitesSection />
	<LandingRequestSection />
</DeskSurface>
<LandingFooter />
