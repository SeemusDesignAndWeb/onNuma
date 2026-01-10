import { fail } from '@sveltejs/kit';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { create, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { sendMemberSignupConfirmationEmail, sendMemberSignupAdminNotification } from '$lib/crm/server/email.js';

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	signup: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			// Get form data - only include fields that are allowed for public signup
			const contactData = {
				email: data.get('email'),
				firstName: data.get('firstName') || '',
				lastName: data.get('lastName') || '',
				phone: data.get('phone') || '',
				addressLine1: data.get('addressLine1') || '',
				addressLine2: data.get('addressLine2') || '',
				city: data.get('city') || '',
				county: data.get('county') || '',
				postcode: data.get('postcode') || '',
				country: data.get('country') || '',
				// Exclude church membership fields: membershipStatus, dateJoined, baptismDate
				// Exclude additional information: servingAreas, giftings, notes
				// Set default values for excluded fields
				membershipStatus: '',
				dateJoined: null,
				baptismDate: null,
				servingAreas: [],
				giftings: [],
				notes: '',
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true'
			};

			// Validate the contact data
			const validated = validateContact(contactData);
			
			// Check if contact with this email already exists
			const existingContacts = await findMany('contacts', c => 
				c.email && c.email.toLowerCase() === validated.email.toLowerCase()
			);

			let contact;
			let isUpdate = false;

			if (existingContacts.length > 0) {
				// Update existing contact with new information (merge data)
				const existingContact = existingContacts[0];
				const updatedContact = {
					...existingContact,
					// Only update fields that were provided and don't overwrite existing church membership/additional info
					firstName: validated.firstName || existingContact.firstName,
					lastName: validated.lastName || existingContact.lastName,
					phone: validated.phone || existingContact.phone,
					addressLine1: validated.addressLine1 || existingContact.addressLine1,
					addressLine2: validated.addressLine2 || existingContact.addressLine2,
					city: validated.city || existingContact.city,
					county: validated.county || existingContact.county,
					postcode: validated.postcode || existingContact.postcode,
					country: validated.country || existingContact.country,
					subscribed: validated.subscribed !== undefined ? validated.subscribed : existingContact.subscribed,
					updatedAt: new Date().toISOString()
				};

				// Import update function
				const { update } = await import('$lib/crm/server/fileStore.js');
				contact = await update('contacts', existingContact.id, updatedContact);
				isUpdate = true;
			} else {
				// Create new contact
				contact = await create('contacts', validated);
			}

			// Send emails
			const event = { url }; // Create event object for email functions
			const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;

			// Send confirmation email to the contact
			try {
				await sendMemberSignupConfirmationEmail(
					{
						to: contact.email,
						name: contactName
					},
					event
				);
			} catch (emailError) {
				console.error('[Member Signup] Failed to send confirmation email:', emailError);
				// Don't fail the request if email fails
			}

			// Send notification email to administrators
			try {
				const admins = await readCollection('admins');
				const adminEmails = admins.map(admin => admin.email).filter(Boolean);
				
				if (adminEmails.length > 0) {
					await sendMemberSignupAdminNotification(
						{
							to: adminEmails,
							contact: contact
						},
						event
					);
				}
			} catch (emailError) {
				console.error('[Member Signup] Failed to send admin notification email:', emailError);
				// Don't fail the request if email fails
			}

			return { 
				success: true, 
				message: isUpdate 
					? 'Thank you! Your information has been updated. We already had your email on file.' 
					: 'Thank you for signing up! We\'ve received your information and will be in touch soon.' 
			};
		} catch (error) {
			console.error('[Member Signup] Error:', error);
			return fail(400, { error: error.message || 'Failed to submit form. Please try again.' });
		}
	}
};
