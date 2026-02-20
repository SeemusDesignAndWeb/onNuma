import { writable } from 'svelte/store';

const EMPTY = { pendingVolunteers: 0, pastoralConcerns: 0, formSubmissions: 0, dbsNotifications: 0 };

function createBadgeCountsStore() {
	const { subscribe, set, update } = writable({ ...EMPTY });

	return {
		subscribe,
		/** Seed the store from a plain object (e.g. SSR data or API response). */
		seed(counts) {
			set({
				pendingVolunteers: counts?.pendingVolunteers ?? 0,
				pastoralConcerns: counts?.pastoralConcerns ?? 0,
				formSubmissions: counts?.formSubmissions ?? 0,
				dbsNotifications: counts?.dbsNotifications ?? 0
			});
		},
		/** Decrement a single count by 1 (immediate update after coordinator action). */
		decrement(key) {
			update((c) => ({ ...c, [key]: Math.max(0, (c[key] ?? 0) - 1) }));
		},
		reset() {
			set({ ...EMPTY });
		}
	};
}

export const badgeCounts = createBadgeCountsStore();

/**
 * Fetch fresh counts from the server and seed the store.
 * Safe to call at any time; silently ignores network errors.
 */
export async function loadBadgeCounts() {
	try {
		const res = await fetch('/hub/api/badge-counts');
		if (!res.ok) return;
		const data = await res.json();
		badgeCounts.seed(data);
	} catch (_) {
		// Non-fatal — store keeps its last value
	}
}
