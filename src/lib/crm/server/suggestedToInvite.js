import { readCollection } from '$lib/crm/server/fileStore.js';

/**
 * Contacts with no recent rota participation (suggested to invite).
 * @param {string | null} organisationId
 * @param {number | undefined} limit - When set, return only that many; when undefined, return full list.
 */
export async function getSuggestedPeople(organisationId, limit = undefined) {
	const [contacts, rotas] = await Promise.all([
		readCollection('contacts'),
		readCollection('rotas')
	]);
	const orgContacts = organisationId ? contacts.filter(c => c.organisationId === organisationId) : contacts;
	const participated = new Set();
	(rotas || []).forEach(r => (r.assignees || []).forEach(a => {
		const id = typeof a === 'object' && a.contactId != null ? a.contactId : (typeof a === 'string' ? a : null);
		if (id) participated.add(id);
	}));
	const suggested = orgContacts
		.filter(c => !participated.has(c.id))
		.map(c => ({
			id: c.id,
			name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown',
			email: c.email,
			lastActivity: null
		}));
	return limit != null ? suggested.slice(0, limit) : suggested;
}
