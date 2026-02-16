import { getOnboardingStepById } from '$lib/crm/onboardingSteps.js';

export async function load({ params, parent }) {
	const { admin, superAdminEmail, organisationAreaPermissions } = await parent();
	const stepId = params?.stepId ?? '';

	const step = getOnboardingStepById(stepId, admin, superAdminEmail, organisationAreaPermissions);
	if (!step || !step.helpHref || !step.helpContent) {
		return { step: null };
	}
	return { step: { id: step.id, title: step.title, helpContent: step.helpContent, href: step.href } };
}
