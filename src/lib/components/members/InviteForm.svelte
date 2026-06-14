<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { createInvitation, buildInviteUrl } from '$lib/invite/inviteData';
	import CopyLink from '$lib/components/CopyLink.svelte';

	const {
		orgId = '',
		sections = [] as string[],
		oncreated = (_result: { invitationId: string; token: string }) => {},
	}: {
		orgId?: string;
		sections?: string[];
		oncreated?: (result: { invitationId: string; token: string }) => void;
	} = $props();

	let email = $state('');
	let message = $state('');
	let submitting = $state(false);
	let inviteUrl = $state<string | null>(null);
	let pendingEmails = $state<string[]>([]);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;
		const token = getToken();
		if (!token) return;
		const cfg = { db: PUBLIC_ENTU_DB, token };

		submitting = true;
		try {
			const result = await createInvitation(cfg, {
				orgId,
				email,
				sections: sections.length > 0 ? sections : undefined,
				message: message || undefined,
				inviterPersonId: '',
			});
			const url = buildInviteUrl(window.location.origin, result.token);
			inviteUrl = url;
			pendingEmails = [...pendingEmails, email];
			email = '';
			message = '';
			oncreated(result);
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-3">
	<div class="flex flex-col gap-1">
		<label for="invite-email" class="font-sans text-[11px] font-medium text-ink-3">
			{m.members_heading()} — email
		</label>
		<input
			id="invite-email"
			type="email"
			name="email"
			required
			bind:value={email}
			disabled={submitting}
			class="font-sans text-sm border border-ink-4 rounded px-2 py-1.5 bg-paper focus:outline-none focus:border-ink-2"
			placeholder="singer@example.com"
		/>
	</div>

	{#if inviteUrl}
		<CopyLink url={inviteUrl} />
	{/if}

	{#if pendingEmails.length > 0}
		<ul data-testid="invite-pending-list" class="flex flex-col gap-1 mt-1">
			{#each pendingEmails as pendingEmail (pendingEmail)}
				<li class="font-sans text-[11px] text-ink-3">{pendingEmail}</li>
			{/each}
		</ul>
	{/if}

	<button
		type="submit"
		disabled={submitting || !email}
		class="font-sans text-[12px] font-medium px-3 py-1.5 bg-ink text-paper rounded self-start disabled:opacity-50"
	>
		{submitting ? m.invite_accepting() : m.invite_accept()}
	</button>
</form>
