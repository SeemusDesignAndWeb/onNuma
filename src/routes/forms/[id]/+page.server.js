import { redirect, fail } from '@sveltejs/kit';
import { findById, create } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { encrypt } from '$lib/crm/server/crypto.js';

export async function load({ params, cookies }) {
	const form = await findById('forms', params.id);
	if (!form) {
		throw redirect(302, '/');
	}
	const organisationId = await getCurrentOrganisationId();
	if (organisationId != null && form.organisationId != null && form.organisationId !== organisationId) {
		throw redirect(302, '/');
	}
	const csrfToken = getCsrfToken(cookies) || '';
	return { form, csrfToken };
}

export const actions = {
	submit: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const form = await findById('forms', params.id);
		if (!form) {
			return fail(404, { error: 'Form not found' });
		}
		const organisationId = await getCurrentOrganisationId();
		if (organisationId != null && form.organisationId != null && form.organisationId !== organisationId) {
			return fail(404, { error: 'Form not found' });
		}

		try {
			// Collect form data
			const submissionData = {};
			for (const field of form.fields) {
				if (field.type === 'checkbox') {
					const values = data.getAll(`${field.name}[]`);
					submissionData[field.name] = values;
				} else {
					const value = data.get(field.name);
					submissionData[field.name] = value || '';
				}
			}

			// Encrypt if safeguarding
			let encryptedData = null;
			let plainData = null;

			if (form.requiresEncryption) {
				encryptedData = encrypt(JSON.stringify(submissionData));
			} else {
				plainData = submissionData;
			}

			const registerData = withOrganisationId({
				formId: form.id,
				data: plainData,
				encryptedData: encryptedData,
				submittedAt: new Date().toISOString()
			}, organisationId);
			await create('registers', registerData);

			return { success: true };
		} catch (error) {
			console.error('Error submitting form:', error);
			return fail(500, { error: 'Failed to submit form. Please try again.' });
		}
	}
};
