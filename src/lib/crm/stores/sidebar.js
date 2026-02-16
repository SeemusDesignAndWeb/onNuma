import { writable } from 'svelte/store';

export const HUB_SIDEBAR_COLLAPSED_KEY = 'hub_sidebar_collapsed';

/** True when the hub sidebar is collapsed (desktop). Used by CrmShell for content padding. */
export const hubSidebarCollapsed = writable(false);

export const MULTI_ORG_SIDEBAR_COLLAPSED_KEY = 'multi_org_sidebar_collapsed';

/** True when the multi-org sidebar is collapsed (desktop). Used by MultiOrgShell for content padding. */
export const multiOrgSidebarCollapsed = writable(false);
