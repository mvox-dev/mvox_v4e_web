export type Tab = 'agenda' | 'library' | 'roster' | 'notices' | 'settings' | 'seasons';

/**
 * Pure function: map URL pathname to tab key.
 * Tab key is the internal identifier (e.g., 'seasons' for /seasons route).
 * Tab label (e.g., 'Rehearsals') is rendered from TAB_LABELS map in MvoxNav.
 */
export function tabForPath(pathname: string): Tab {
	if (pathname.startsWith('/seasons')) return 'seasons';
	if (pathname.startsWith('/library')) return 'library';
	if (pathname.startsWith('/roster')) return 'roster';
	if (pathname.startsWith('/notices')) return 'notices';
	if (pathname.startsWith('/settings')) return 'settings';
	return 'agenda'; // default for /, /agenda, and unknown paths
}
