<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="max-w-md mx-auto py-16 text-center">
	<h1 class="text-2xl font-bold text-gray-900 mb-8">{m.auth_login_heading()}</h1>
	<a href="/auth/entu-redirect" data-testid="login-cta" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">
		{m.auth_login_cta()}
	</a>
</div>
