// Shared domain types for mvox.

// ── Invite / Join ─────────────────────────────────────────────────────────────

/** Self-describing token payload encoded as base64url in the invite URL. */
export interface InviteToken {
	orgId: string;
	orgName: string;
	inviterPersonId: string;
	sections: string[];
	/** Unix timestamp (ms) — expiry epoch. */
	exp: number;
}

export interface CreateInvitationInput {
	orgId: string;
	/** Org display name — baked into the self-describing token so the unauthed landing
	 *  can render without reading the private org entity. Optional; defaults to ''. */
	orgName?: string;
	email: string;
	sections?: string[];
	inviterPersonId: string;
	message?: string;
}

export interface CreateInvitationResult {
	invitationId: string;
	token: string;
}

export interface CreateApplicationInput {
	personId: string;
	orgId: string;
}

export interface PendingApplication {
	applicationId: string;
	personId: string;
	applicantName: string;
	message: string | undefined;
	sections: string[] | undefined;
}
