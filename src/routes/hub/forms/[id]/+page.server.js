import { redirect } from '@sveltejs/kit';
import { findById, update, remove, readCollection, findMany } from '$lib/crm/server/fileStore.js';
import { validateForm } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { decrypt } from '$lib/crm/server/crypto.js';
import { canAccessSafeguarding, canAccessForms } from '$lib/crm/server/permissions.js';

export async function load({ params, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}
	
	const form = await findById('forms', params.id);
	if (!form) {
		throw redirect(302, '/hub/forms');
	}
	
	// Check permissions based on form type
	if (form.isSafeguarding || form.requiresEncryption) {
		if (!canAccessSafeguarding(admin)) {
			throw redirect(302, '/hub/forms?error=access_denied');
		}
	} else {
		if (!canAccessForms(admin)) {
			throw redirect(302, '/hub/forms?error=access_denied');
		}
	}

	// Get form submissions (registers)
	const registers = await findMany('registers', r => r.formId === params.id);
	
	// Decrypt safeguarding submissions
	const decryptedRegisters = await Promise.all(registers.map(async (register) => {
		if (form.requiresEncryption && register.encryptedData) {
			try {
				const decrypted = decrypt(register.encryptedData);
				return {
					...register,
					data: JSON.parse(decrypted)
				};
			} catch (error) {
				console.error('Error decrypting register:', error);
				return {
					...register,
					data: { error: 'Unable to decrypt data' }
				};
			}
		}
		return register;
	}));

	const csrfToken = getCsrfToken(cookies) || '';
	return { form, registers: decryptedRegisters, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const fieldsJson = data.get('fields');
			if (!fieldsJson) {
				return { error: 'Form fields are required' };
			}

			const fields = JSON.parse(fieldsJson);
			const formData = {
				name: data.get('name'),
				description: data.get('description'),
				fields: fields,
				isSafeguarding: data.get('isSafeguarding') === 'true'
			};

			const validated = validateForm(formData);
			await update('forms', params.id, validated);

			return { success: true };
		} catch (error) {
			return { error: error.message };
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		await remove('forms', params.id);
		throw redirect(302, '/hub/forms');
	}
};

