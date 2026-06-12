import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { PUBLIC_ENTU_DB } from '$env/static/public';
import { ENTU_API_BASE } from '$lib/entu-config';
import { getToken } from './storage';
import type {
	EntuJwtClaims,
	EntuMemberSearchResponse,
	EntuOwnerSearchResponse,
	EntuPersonResponse,
	Org,
	UserState,
} from './types';
import { deriveInitials } from './types';

const SELECTED_ORG_KEY = 'mvox.selectedOrgId';
const ORG_URL_PARAM = 'org';

export const ORG_URL_PARAM_NAME = ORG_URL_PARAM;

export const userStore: Writable<UserState> = writable({ status: 'loading' });

export const selectedOrgIdStore: Writable<string | null> = writable(
	typeof localStorage !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null,
);

export const urlOrgIdStore: Writable<string | null> = writable(null);

export function decodeJwt(token: string): EntuJwtClaims | null {
	try {
		const parts = token.split('.');
		if (parts.length < 2 || !parts[1]) return null;
		return JSON.parse(atob(parts[1])) as EntuJwtClaims;
	} catch {
		return null;
	}
}

export async function hydrateUserStore(): Promise<void> {
	const token = getToken();
	if (!token) {
		userStore.set({ status: 'signed-out' });
		return;
	}

	const claims = decodeJwt(token);
	const personId = claims?.accounts?.[PUBLIC_ENTU_DB];
	if (!personId) {
		userStore.set({ status: 'signed-out' });
		return;
	}

	try {
		const [personRes, memberRes, ownerRes] = await Promise.all([
			fetch(`${ENTU_API_BASE}${PUBLIC_ENTU_DB}/entity/${personId}?props=name`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
			fetch(
				`${ENTU_API_BASE}${PUBLIC_ENTU_DB}/entity?_type.string=member&person.reference=${personId}&props=_parent`,
				{ headers: { Authorization: `Bearer ${token}` } },
			),
			fetch(
				`${ENTU_API_BASE}${PUBLIC_ENTU_DB}/entity?_type.string=organization&_owner.reference=${personId}&props=name`,
				{ headers: { Authorization: `Bearer ${token}` } },
			),
		]);

		if (!personRes.ok) {
			userStore.set({ status: 'error', reason: `person fetch ${personRes.status}` });
			return;
		}
		if (!memberRes.ok) {
			userStore.set({ status: 'error', reason: `member fetch ${memberRes.status}` });
			return;
		}
		if (!ownerRes.ok) {
			userStore.set({ status: 'error', reason: `owner fetch ${ownerRes.status}` });
			return;
		}

		const personData = (await personRes.json()) as EntuPersonResponse;
		const memberData = (await memberRes.json()) as EntuMemberSearchResponse;
		const ownerData = (await ownerRes.json()) as EntuOwnerSearchResponse;

		const name = personData.entity.name?.[0]?.string ?? '';
		const initial = name ? name[0].toLocaleUpperCase() : '';

		const orgMap = new Map<string, Org>();
		for (const member of memberData.entities) {
			for (const parent of member._parent ?? []) {
				if (parent.entity_type !== 'organization') continue;
				if (orgMap.has(parent.reference)) continue;
				orgMap.set(parent.reference, {
					id: parent.reference,
					label: parent.string,
					initials: deriveInitials(parent.string),
					role: undefined,
				});
			}
		}
		for (const org of ownerData.entities) {
			if (orgMap.has(org._id)) continue;
			orgMap.set(org._id, {
				id: org._id,
				label: org.name?.[0]?.string ?? '',
				initials: deriveInitials(org.name?.[0]?.string ?? ''),
				role: 'owner',
			});
		}

		userStore.set({ status: 'ready', name, initial, personId, orgs: Array.from(orgMap.values()) });
	} catch (err) {
		userStore.set({ status: 'error', reason: err instanceof Error ? err.message : String(err) });
	}
}

export const selectedOrgStore: Readable<Org | null> = derived(
	[userStore, urlOrgIdStore, selectedOrgIdStore],
	([$user, $urlOrgId, $selectedOrgId]) => {
		if ($user.status !== 'ready' || $user.orgs.length === 0) return null;

		// 1. URL wins; write-through to localStorage
		const fromUrl = $urlOrgId ? $user.orgs.find((o) => o.id === $urlOrgId) : undefined;
		if (fromUrl) {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(SELECTED_ORG_KEY, fromUrl.id);
			}
			return fromUrl;
		}

		// 2. Explicit pick
		const fromPick = $selectedOrgId ? $user.orgs.find((o) => o.id === $selectedOrgId) : undefined;
		if (fromPick) return fromPick;

		// 3. Default to first org
		return $user.orgs[0];
	},
);

export type OrgPickerMode = 'placeholder' | 'static' | 'dropdown';

export const pickerModeStore: Readable<OrgPickerMode> = derived(userStore, ($user) => {
	if ($user.status !== 'ready' || $user.orgs.length === 0) return 'placeholder';
	if ($user.orgs.length === 1) return 'static';
	return 'dropdown';
});

export async function selectOrg(orgId: string): Promise<void> {
	const state = get(userStore);
	if (state.status !== 'ready') return;
	if (!state.orgs.find((o) => o.id === orgId)) return;

	selectedOrgIdStore.set(orgId);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(SELECTED_ORG_KEY, orgId);
	}
	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		url.searchParams.set(ORG_URL_PARAM, orgId);
		await goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
	}
}
