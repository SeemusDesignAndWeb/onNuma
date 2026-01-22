import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { decrypt } from '$lib/crm/server/crypto.js';
import { getAdminFromCookies, getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logSensitiveOperation, logDataChange } from '$lib/crm/server/audit.js';
import { isSuperAdmin, canAccessSafeguarding } from '$lib/crm/server/permissions.js';

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

	const csrfToken = getCsrfToken(cookies) || '';
	
	// Check if admin can delete submissions (super admin or has safeguarding permission)
	const canDelete = isSuperAdmin(admin) || canAccessSafeguarding(admin);
	
	return { form, register, data, csrfToken, admin, canDelete };
}

export const actions = {
	archive: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const admin = await getAdminFromCookies(cookies);
		if (!admin) {
			return fail(401, { error: 'Unauthorized' });
		}

		const register = await findById('registers', params.submissionId);
		if (!register || register.formId !== params.id) {
			return fail(404, { error: 'Submission not found' });
		}

		const form = await findById('forms', params.id);
		if (!form) {
			return fail(404, { error: 'Form not found' });
		}

		// Update submission to archived
		await update('registers', params.submissionId, {
			...register,
			archived: true,
			archivedAt: new Date().toISOString(),
			archivedBy: admin.id
		});

		// Log the archive action
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(admin.id, 'archive', 'registers', params.submissionId, {
			formId: params.id,
			formName: form.name,
			submissionId: params.submissionId
		}, event);

		return { success: true, archived: true };
	},

	unarchive: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const admin = await getAdminFromCookies(cookies);
		if (!admin) {
			return fail(401, { error: 'Unauthorized' });
		}

		const register = await findById('registers', params.submissionId);
		if (!register || register.formId !== params.id) {
			return fail(404, { error: 'Submission not found' });
		}

		const form = await findById('forms', params.id);
		if (!form) {
			return fail(404, { error: 'Form not found' });
		}

		// Update submission to unarchived
		const { archived, archivedAt, archivedBy, ...rest } = register;
		await update('registers', params.submissionId, rest);

		// Log the unarchive action
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(admin.id, 'unarchive', 'registers', params.submissionId, {
			formId: params.id,
			formName: form.name,
			submissionId: params.submissionId
		}, event);

		return { success: true, archived: false };
	},

	delete: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const admin = await getAdminFromCookies(cookies);
		if (!admin) {
			return fail(401, { error: 'Unauthorized' });
		}

		// Check permissions: must be super admin or have safeguarding permission
		const canDelete = isSuperAdmin(admin) || canAccessSafeguarding(admin);
		if (!canDelete) {
			return fail(403, { error: 'You do not have permission to delete form submissions' });
		}

		const register = await findById('registers', params.submissionId);
		if (!register || register.formId !== params.id) {
			return fail(404, { error: 'Submission not found' });
		}

		const form = await findById('forms', params.id);
		if (!form) {
			return fail(404, { error: 'Form not found' });
		}

		// Delete the submission
		await remove('registers', params.submissionId);

		// Log the delete action
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(admin.id, 'delete', 'registers', params.submissionId, {
			formId: params.id,
			formName: form.name,
			submissionId: params.submissionId,
			isSafeguarding: form.isSafeguarding || form.requiresEncryption
		}, event);

		// Redirect back to form submissions list
		throw redirect(302, `/hub/forms/${params.id}`);
	}
};

