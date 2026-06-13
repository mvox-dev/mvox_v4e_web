<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ComingSoon from '$lib/components/ComingSoon.svelte';
</script>

<ComingSoon
	label="Communications"
	name={m.nav_tab_notices()}
	description={m.page_notices_description()}
	backHref="/agenda"
/>
