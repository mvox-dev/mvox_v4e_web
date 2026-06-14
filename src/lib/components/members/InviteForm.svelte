<script lang="ts">
	// InviteForm — email + optional sections + optional message → createInvitation.
	// Stub: renders empty div. Byrd implements in GREEN.
	const {
		orgId = '',
		sections = [] as string[],
		oncreated = (_result: { invitationId: string; token: string }) => {},
	}: {
		orgId?: string;
		sections?: string[];
		oncreated?: (result: { invitationId: string; token: string }) => void;
	} = $props();
</script>

<!-- stub: orgId={orgId} sections.length={sections.length} -->
<div data-testid="invite-form-stub"></div>
