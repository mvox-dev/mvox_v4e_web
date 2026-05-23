<script lang="ts">
	import { onMount } from 'svelte';
	import { clearAll } from '$lib/auth/storage';

	type Status = {
		token: string;
		userEmail: string;
		accountsLength: number;
		lastProvider: string;
	};

	let status = $state<Status>({
		token: 'absent',
		userEmail: '—',
		accountsLength: 0,
		lastProvider: '—',
	});

	function readStatus() {
		const token = localStorage.getItem('token');
		const userRaw = localStorage.getItem('user');
		const accountsRaw = localStorage.getItem('accounts');
		const lastProvider = localStorage.getItem('mvox.last_provider');

		let userEmail = '—';
		if (userRaw) {
			try {
				const u = JSON.parse(userRaw) as { email?: string };
				userEmail = u.email ?? '—';
			} catch {
				userEmail = '(parse error)';
			}
		}

		let accountsLength = 0;
		if (accountsRaw) {
			try {
				accountsLength = (JSON.parse(accountsRaw) as unknown[]).length;
			} catch {
				accountsLength = 0;
			}
		}

		status = {
			token: token ? 'present' : 'absent',
			userEmail,
			accountsLength,
			lastProvider: lastProvider ?? '—',
		};
	}

	function clearTokenOnly() {
		localStorage.removeItem('token');
		window.location.href = '/';
	}

	function clearAllStorage() {
		clearAll({ preserveProvider: false });
		window.location.href = '/';
	}

	function simulateExpiredToken() {
		localStorage.setItem('token', 'invalid-jwt-for-testing');
		window.location.href = '/';
	}

	onMount(() => {
		readStatus();
	});
</script>

<h1>DEV: Auth Controls (remove before merge)</h1>
<p>This route exists only for CHORE-B PO live-test; removed in follow-up commit pre-merge.</p>

<section>
	<h2>Current state</h2>
	<ul>
		<li>token: {status.token}</li>
		<li>user.email: {status.userEmail}</li>
		<li>accounts.length: {status.accountsLength}</li>
		<li>mvox.last_provider: {status.lastProvider}</li>
	</ul>
</section>

<section>
	<h2>Actions</h2>
	<button onclick={clearTokenOnly}>Clear token only</button>
	<button onclick={clearAllStorage}>Clear all storage</button>
	<button onclick={simulateExpiredToken}>Simulate expired token</button>
</section>
