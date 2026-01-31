import { json } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';

export async function GET({ url }) {
	const email = url.searchParams.get('email');
	const name = url.searchParams.get('name');

	if (!email || !name) {
		return json({ matched: false });
	}

	try {
		const contacts = await readCollection('contacts');
		const matchedContact = contacts.find(c => 
			c.email?.toLowerCase().trim() === email.toLowerCase().trim() &&
			(c.name?.toLowerCase().trim() === name.toLowerCase().trim() ||
			 `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim() === name.toLowerCase().trim())
		);

		if (matchedContact) {
			// Find spouse if any
			let spouse = null;
			if (matchedContact.spouseId) {
				spouse = contacts.find(c => c.id === matchedContact.spouseId);
			}

			return json({
				matched: true,
				contact: matchedContact,
				spouse: spouse
			});
		}

		return json({ matched: false });
	} catch (error) {
		console.error('Error checking spouse:', error);
		return json({ matched: false, error: 'Database error' }, { status: 500 });
	}
}
