import { readCollection, findById, remove } from '$lib/crm/server/fileStore.js';
import { getAdminFromCookies, getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { canAccessSafeguarding, canAccessForms, isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSuperAdminEmail } from '$lib/crm/server/envConfig.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { fail } from '@sveltejs/kit';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		return { forms: [], currentPage: 1, totalPages: 1, total: 0, search: '', latestSubmissions: [] };
	}
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const [forms, registers] = await Promise.all([
		readCollection('forms'),
		readCollection('registers')
	]);
	
	// Filter forms based on admin permissions
	const canAccessSafeguardingForms = canAccessSafeguarding(admin);
	const canAccessNonSafeguardingForms = canAccessForms(admin);
	
	let filtered = forms.filter(f => {
		// If it's a safeguarding form, check safeguarding permission
		if (f.isSafeguarding || f.requiresEncryption) {
			return canAccessSafeguardingForms;
		}
		// Otherwise, check forms permission
		return canAccessNonSafeguardingForms;
	});
	
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = filtered.filter(f => 
			f.name?.toLowerCase().includes(searchLower) ||
			f.description?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	// Get latest 10 form submissions, sorted by submittedAt (most recent first)
	// Filter out archived submissions
	const latestSubmissions = [...registers]
		.filter(r => !r.archived) // Exclude archived submissions
		.sort((a, b) => {
			const dateA = new Date(a.submittedAt || a.createdAt || 0);
			const dateB = new Date(b.submittedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 10);

	// Enrich submissions with form names
	const formsMap = new Map(forms.map(f => [f.id, f]));
	const enrichedSubmissions = latestSubmissions.map(submission => {
		const form = formsMap.get(submission.formId);
		return {
			...submission,
			formName: form?.name || 'Unknown Form'
		};
	});

	// Check if admin can delete submissions (super admin or has safeguarding permission)
	const superAdminEmail = getSuperAdminEmail();
	const canDelete = isSuperAdmin(admin, superAdminEmail) || canAccessSafeguarding(admin);

	return {
		forms: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		latestSubmissions: enrichedSubmissions,
		canDelete,
		csrfToken: getCsrfToken(cookies) || ''
	};
}

export const actions = {
	deleteSubmission: async ({ request, cookies }) => {
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
		const superAdminEmail = getSuperAdminEmail();
		const canDelete = isSuperAdmin(admin, superAdminEmail) || canAccessSafeguarding(admin);
		if (!canDelete) {
			return fail(403, { error: 'You do not have permission to delete form submissions' });
		}

		const submissionId = data.get('submissionId');
		if (!submissionId) {
			return fail(400, { error: 'Submission ID is required' });
		}

		const register = await findById('registers', submissionId.toString());
		if (!register) {
			return fail(404, { error: 'Submission not found' });
		}

		// Get form info for audit log (form might be deleted, so handle gracefully)
		let formName = 'Unknown Form';
		try {
			const form = await findById('forms', register.formId);
			if (form) {
				formName = form.name || 'Unknown Form';
			}
		} catch (error) {
			// Form might be deleted, that's okay
		}

		// Delete the submission
		await remove('registers', submissionId.toString());

		// Log the delete action
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(admin.id, 'delete', 'registers', submissionId.toString(), {
			formId: register.formId || 'unknown',
			formName: formName,
			submissionId: submissionId.toString()
		}, event);

		return { success: true, type: 'deleteSubmission' };
	}
};

