import { writable } from 'svelte/store';

export const HUB_SIDEBAR_COLLAPSED_KEY = 'hub_sidebar_collapsed';

/** True when the hub sidebar is collapsed (desktop). Used by CrmShell for content padding. */
export const hubSidebarCollapsed = writable(false);
