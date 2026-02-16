import { readCollection, findById, remove, create } from '$lib/crm/server/fileStore.js';
import { getAdminFromCookies, getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { canAccessSafeguarding, canAccessForms, isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSuperAdminEmail } from '$lib/crm/server/envConfig.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { fail, redirect } from '@sveltejs/kit';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { validateForm } from '$lib/crm/server/validators.js';
import { MEMBERSHIP_FORM_TEMPLATE } from '$lib/crm/membershipFormTemplate.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		return { forms: [], currentPage: 1, totalPages: 1, total: 0, search: '', latestSubmissions: [] };
	}
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const organisationId = await getCurrentOrganisationId();
	const [formsRaw, registersRaw] = await Promise.all([
		readCollection('forms'),
		readCollection('registers')
	]);
	const forms = filterByOrganisation(formsRaw, organisationId);
	const registers = filterByOrganisation(registersRaw, organisationId);
	
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

	// Whether a form named "Membership Form" already exists (so we can show "Create Membership Form" only when needed)
	const hasMembershipForm = filtered.some((f) => f.name === 'Membership Form');

	return {
		forms: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		latestSubmissions: enrichedSubmissions,
		canDelete,
		hasMembershipForm,
		csrfToken: getCsrfToken(cookies) || ''
	};
}

export const actions = {
	deleteSubmission: async ({ request, cookies }) => {
		try {
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

			const organisationId = await getCurrentOrganisationId();
			const register = await findById('registers', submissionId.toString());
			if (!register) {
				return fail(404, { error: 'Submission not found' });
			}
			if (register.organisationId != null && register.organisationId !== organisationId) {
				return fail(404, { error: 'Submission not found' });
			}

			// Get form info for audit log (form might be deleted, so handle gracefully)
			let formName = 'Unknown Form';
			let formId = register.formId || 'unknown';
			if (formId && formId !== 'unknown') {
				try {
					const form = await findById('forms', formId);
					if (form) {
						formName = form.name || 'Unknown Form';
					}
				} catch (error) {
					// Form might be deleted, that's okay
					console.error('Error fetching form for audit log:', error);
				}
			}

			// Delete the submission
			try {
				await remove('registers', submissionId.toString());
			} catch (error) {
				console.error('Error deleting submission:', error);
				return fail(500, { error: 'Failed to delete submission' });
			}

			// Log the delete action (don't fail if logging fails)
			try {
				const event = { getClientAddress: () => 'unknown', request };
				await logDataChange(admin.id, 'delete', 'registers', submissionId.toString(), {
					formId: formId,
					formName: formName,
					submissionId: submissionId.toString()
				}, event);
			} catch (error) {
				console.error('Error logging delete action:', error);
				// Continue even if logging fails
			}

			return { success: true, type: 'deleteSubmission' };
		} catch (error) {
			console.error('Unexpected error in deleteSubmission:', error);
			return fail(500, { error: 'An unexpected error occurred while deleting the submission' });
		}
	},

	createMembershipForm: async ({ request, cookies }) => {
		try {
			const data = await request.formData();
			const csrfToken = data.get('_csrf');
			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				return fail(403, { error: 'CSRF token validation failed' });
			}

			const admin = await getAdminFromCookies(cookies);
			if (!admin) {
				return fail(401, { error: 'Unauthorized' });
			}
			if (!canAccessForms(admin) && !canAccessSafeguarding(admin)) {
				return fail(403, { error: 'You do not have permission to create forms' });
			}

			const organisationId = await getCurrentOrganisationId();
			const formData = {
				name: MEMBERSHIP_FORM_TEMPLATE.name,
				description: MEMBERSHIP_FORM_TEMPLATE.description,
				fields: MEMBERSHIP_FORM_TEMPLATE.fields,
				isSafeguarding: false
			};
			const validated = validateForm(formData);
			const form = await create('forms', withOrganisationId(validated, organisationId));
			throw redirect(302, `/hub/forms/${form.id}`);
		} catch (error) {
			if (error?.status === 302) throw error;
			console.error('Error creating Membership Form:', error);
			return fail(400, { error: error?.message || 'Failed to create Membership Form' });
		}
	}
};

