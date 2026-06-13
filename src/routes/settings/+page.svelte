<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ComingSoon from '$lib/components/ComingSoon.svelte';
</script>

<ComingSoon
	label={m.page_settings_label()}
	name={m.nav_tab_settings()}
	description={m.page_settings_description()}
	backHref="/agenda"
/>
