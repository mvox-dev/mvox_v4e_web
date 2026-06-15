<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { selectedOrgStore, userStore } from '$lib/auth/userStore';
	import { listPendingApplications, approveApplication } from '$lib/invite/inviteData';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperCard from '$lib/components/PaperCard.svelte';
	import InviteForm from '$lib/components/invite/InviteForm.svelte';
	import type { PendingApplication } from '$lib/types';

	type LoadState = 'loading' | 'ready' | 'error';

	let loadState = $state<LoadState>('loading');
	let pendingApplications = $state<PendingApplication[]>([]);
	let loadError = $state<string | null>(null);
	let approvingId = $state<string | null>(null);

	const org = $derived($selectedOrgStore);
	const user = $derived($userStore);
	// Admin = org owner (has _owner right → can create member + grant _viewer on org)
	const isOwner = $derived(
		org !== null && user.status === 'ready' && org.role === 'owner',
	);

	$effect(() => {
		const currentOrg = org;
		if (!currentOrg) return;
		const token = getToken();
		if (!token) return;
		const cfg = { db: PUBLIC_ENTU_DB, token };

		loadState = 'loading';
		loadError = null;

		listPendingApplications(cfg, currentOrg.id)
			.then((apps) => {
				pendingApplications = apps;
				loadState = 'ready';
			})
			.catch((err: unknown) => {
				loadError = err instanceof Error ? err.message : String(err);
				loadState = 'error';
			});
	});

	async function handleApprove(app: PendingApplication) {
		const currentOrg = org;
		if (!currentOrg) return;
		const token = getToken();
		if (!token) return;
		const cfg = { db: PUBLIC_ENTU_DB, token };

		approvingId = app.applicationId;
		try {
			await approveApplication(cfg, {
				applicationId: app.applicationId,
				// invitationId: the landing page stored it on the application; for MVP
				// we pass empty string — the approveApplication fn handles missing id gracefully
				invitationId: '',
				orgId: currentOrg.id,
				personId: app.personId,
				sections: app.sections ?? [],
			});
			// Optimistic removal on success
			pendingApplications = pendingApplications.filter(
				(a) => a.applicationId !== app.applicationId,
			);
		} catch (err) {
			console.error('approveApplication failed', err);
		} finally {
			approvingId = null;
		}
	}
</script>

<DeskSurface>
	<div class="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
		<h1 data-desk-text class="font-sans text-2xl font-semibold text-ink">
			{m.members_heading()}
		</h1>

		{#if loadState === 'loading'}
			<div data-testid="members-loading" class="bg-paper rounded p-4 text-ink-3 font-sans text-sm">
				{m.common_loading()}
			</div>
		{:else if loadState === 'error'}
			<div data-testid="members-error" class="bg-paper rounded p-4 text-ink-3 font-sans text-sm">
				{m.members_error()}
			</div>
		{:else}
			<!-- Pending join requests (admin only) -->
			{#if isOwner}
				<PaperCard>
					<h2 class="font-sans text-base font-semibold text-ink mb-3">
						{m.members_pending_heading()}
					</h2>
					{#if pendingApplications.length === 0}
						<p
							data-testid="members-pending-empty"
							class="font-sans text-sm text-ink-3 mb-4"
						>
							{m.members_pending_empty()}
						</p>
					{:else}
						<ul data-testid="members-pending-list" class="flex flex-col gap-2 mb-4">
							{#each pendingApplications as app (app.applicationId)}
								<li
									data-testid="members-pending-item"
									class="flex items-center justify-between gap-3"
								>
									<span class="font-sans text-sm text-ink">
										{app.applicantName || app.personId}
									</span>
									<button
										data-testid="members-approve-button"
										type="button"
										disabled={approvingId === app.applicationId}
										onclick={() => handleApprove(app)}
										class="font-sans text-[11px] font-medium px-2 py-1 border border-ink-4 rounded hover:bg-paper-2 text-ink-3 disabled:opacity-50"
									>
										{approvingId === app.applicationId
											? m.members_approving()
											: m.members_approve()}
									</button>
								</li>
							{/each}
						</ul>
					{/if}

					<!-- Invite form -->
					<div class="border-t border-dashed border-ink-5 pt-4 mt-2">
						<h3 class="font-sans text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
							{m.members_invite_heading()}
						</h3>
						<InviteForm
							orgId={org?.id ?? ''}
							orgName={org?.label ?? ''}
							sections={[]}
						/>
					</div>
				</PaperCard>
			{/if}
		{/if}
	</div>
</DeskSurface>
