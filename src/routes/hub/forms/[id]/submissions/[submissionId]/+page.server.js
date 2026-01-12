import { redirect } from '@sveltejs/kit';
import { findById } from '$lib/crm/server/fileStore.js';
import { decrypt } from '$lib/crm/server/crypto.js';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { logSensitiveOperation } from '$lib/crm/server/audit.js';

export async function load({ params, cookies, request }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}

	const form = await findById('forms', params.id);
	if (!form) {
		throw redirect(302, '/hub/forms');
	}

	const register = await findById('registers', params.submissionId);
	if (!register || register.formId !== params.id) {
		throw redirect(302, `/hub/forms/${params.id}`);
	}

	// Log sensitive operation if safeguarding
	if (form.isSafeguarding || form.requiresEncryption) {
		const event = { getClientAddress: () => 'unknown', request };
		await logSensitiveOperation(admin.id, 'safeguarding_submission_view', {
			formId: params.id,
			formName: form.name,
			submissionId: params.submissionId
		}, event);
	}

	// Decrypt if safeguarding
	let data = register.data;
	if (form.requiresEncryption && register.encryptedData) {
		try {
			const decrypted = decrypt(register.encryptedData);
			data = JSON.parse(decrypted);
		} catch (error) {
			console.error('Error decrypting register:', error);
			data = { error: 'Unable to decrypt data' };
		}
	}

	return { form, register, data };
}

