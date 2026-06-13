<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ComingSoon from '$lib/components/ComingSoon.svelte';
</script>

<ComingSoon
	label={m.page_roster_label()}
	name={m.nav_tab_roster()}
	description={m.page_roster_description()}
	backHref="/agenda"
/>
