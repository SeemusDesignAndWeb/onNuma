import { writable, derived } from 'svelte/store';

/**
 * Hub Data Stores
 * 
 * These stores hold core Hub data loaded once after login.
 * This enables SPA-like navigation without server round-trips for each page.
 * 
 * Usage:
 * - Import stores in components: import { contacts, events } from '$lib/crm/stores/hubData.js'
 * - Read with $contacts, $events, etc.
 * - Use mutation helpers (addContact, updateContact, etc.) to keep stores in sync after API calls
 */

// ============================================================================
// Core Data Stores
// ============================================================================

/** Contacts list (minimal fields for list view - full contact fetched on demand) */
export const contacts = writable([]);

/** Events */
export const events = writable([]);

/** Rotas */
export const rotas = writable([]);

/** Lists (contact groups) */
export const lists = writable([]);

/** Forms */
export const forms = writable([]);

/** Emails/Newsletters */
export const emails = writable([]);

/** Email stats */
export const emailStats = writable([]);

// ============================================================================
// Loading State
// ============================================================================

/** Whether hub data has been loaded (prevents re-fetching on client-side navigation) */
export const hubDataLoaded = writable(false);

/** Loading state while fetching initial data */
export const hubDataLoading = writable(false);

/** Error if initial load failed */
export const hubDataError = writable(null);

// ============================================================================
// Derived Stores
// ============================================================================

/** Total contacts count */
export const contactsCount = derived(contacts, $c => $c.length);

/** Total events count */
export const eventsCount = derived(events, $e => $e.length);

/** Total rotas count */
export const rotasCount = derived(rotas, $r => $r.length);

/** Total lists count */
export const listsCount = derived(lists, $l => $l.length);

/** Total forms count */
export const formsCount = derived(forms, $f => $f.length);

/** Total emails count */
export const emailsCount = derived(emails, $e => $e.length);

// ============================================================================
// Contacts Mutations
// ============================================================================

/**
 * Add a new contact to the store
 * @param {Object} contact - The contact object to add
 */
export function addContact(contact) {
	contacts.update(all => [...all, contact]);
}

/**
 * Update an existing contact in the store
 * @param {string} id - Contact ID
 * @param {Object} updates - Partial contact updates
 */
export function updateContact(id, updates) {
	contacts.update(all =>
		all.map(c => c.id === id ? { ...c, ...updates } : c)
	);
}

/**
 * Remove a contact from the store
 * @param {string} id - Contact ID
 */
export function removeContact(id) {
	contacts.update(all => all.filter(c => c.id !== id));
}

/**
 * Replace all contacts (e.g., after bulk operation or refetch)
 * @param {Array} newContacts - Array of contacts
 */
export function setContacts(newContacts) {
	contacts.set(newContacts);
}

// ============================================================================
// Events Mutations
// ============================================================================

export function addEvent(event) {
	events.update(all => [...all, event]);
}

export function updateEvent(id, updates) {
	events.update(all =>
		all.map(e => e.id === id ? { ...e, ...updates } : e)
	);
}

export function removeEvent(id) {
	events.update(all => all.filter(e => e.id !== id));
}

export function setEvents(newEvents) {
	events.set(newEvents);
}

// ============================================================================
// Rotas Mutations
// ============================================================================

export function addRota(rota) {
	rotas.update(all => [...all, rota]);
}

export function updateRota(id, updates) {
	rotas.update(all =>
		all.map(r => r.id === id ? { ...r, ...updates } : r)
	);
}

export function removeRota(id) {
	rotas.update(all => all.filter(r => r.id !== id));
}

export function setRotas(newRotas) {
	rotas.set(newRotas);
}

// ============================================================================
// Lists Mutations
// ============================================================================

export function addList(list) {
	lists.update(all => [...all, list]);
}

export function updateList(id, updates) {
	lists.update(all =>
		all.map(l => l.id === id ? { ...l, ...updates } : l)
	);
}

export function removeList(id) {
	lists.update(all => all.filter(l => l.id !== id));
}

export function setLists(newLists) {
	lists.set(newLists);
}

// ============================================================================
// Forms Mutations
// ============================================================================

export function addForm(form) {
	forms.update(all => [...all, form]);
}

export function updateForm(id, updates) {
	forms.update(all =>
		all.map(f => f.id === id ? { ...f, ...updates } : f)
	);
}

export function removeForm(id) {
	forms.update(all => all.filter(f => f.id !== id));
}

export function setForms(newForms) {
	forms.set(newForms);
}

// ============================================================================
// Emails Mutations
// ============================================================================

export function addEmail(email) {
	emails.update(all => [...all, email]);
}

export function updateEmail(id, updates) {
	emails.update(all =>
		all.map(e => e.id === id ? { ...e, ...updates } : e)
	);
}

export function removeEmail(id) {
	emails.update(all => all.filter(e => e.id !== id));
}

export function setEmails(newEmails) {
	emails.set(newEmails);
}

// ============================================================================
// Global Store Management
// ============================================================================

/**
 * Load all hub data from the API
 * Called once after login from the layout
 */
export async function loadHubData() {
	hubDataLoading.set(true);
	hubDataError.set(null);

	try {
		const res = await fetch('/hub/api/data');
		if (!res.ok) {
			throw new Error(`Failed to load hub data: ${res.status}`);
		}

		const data = await res.json();

		contacts.set(data.contacts || []);
		events.set(data.events || []);
		rotas.set(data.rotas || []);
		lists.set(data.lists || []);
		forms.set(data.forms || []);
		emails.set(data.emails || []);
		emailStats.set(data.emailStats || []);

		hubDataLoaded.set(true);
	} catch (err) {
		console.error('[hubData] Failed to load:', err);
		hubDataError.set(err.message || 'Failed to load hub data');
	} finally {
		hubDataLoading.set(false);
	}
}

/**
 * Clear all hub data (call on logout or org switch)
 */
export function clearHubData() {
	contacts.set([]);
	events.set([]);
	rotas.set([]);
	lists.set([]);
	forms.set([]);
	emails.set([]);
	emailStats.set([]);
	hubDataLoaded.set(false);
	hubDataLoading.set(false);
	hubDataError.set(null);
}

/**
 * Force a refresh of hub data
 */
export async function refreshHubData() {
	hubDataLoaded.set(false);
	await loadHubData();
}
