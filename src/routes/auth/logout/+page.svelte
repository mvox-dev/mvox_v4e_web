<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { performLogout } from './perform-logout';
	import * as m from '$lib/paraglide/messages.js';

	onMount(() => {
		performLogout();
		goto('/');
	});
</script>

<div class="max-w-md mx-auto py-16 text-center">
	<p class="text-gray-600">{m.auth_logout_pending()}</p>
</div>
