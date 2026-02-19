/**
 * Church Bolt-On: seed default forms and email templates for an organisation.
 * Called when Church Bolt-On is enabled (e.g. from multi-org organisation save).
 * Idempotent: only creates each form/template if one with the same name doesn't already exist for the org.
 */

import { readCollection, create } from './fileStore.js';
import { withOrganisationId } from './orgContext.js';
import { validateForm } from './validators.js';
import { validateNewsletterTemplate } from './validators.js';
import { CHURCH_FORM_TEMPLATES } from '$lib/crm/churchFormTemplates.js';
import { MEMBERSHIP_FORM_TEMPLATE } from '$lib/crm/membershipFormTemplate.js';
import { CHURCH_EMAIL_TEMPLATES } from '$lib/crm/churchEmailTemplates.js';

/** Church bolt-on forms to auto-create (templates + membership). */
const ALL_CHURCH_FORMS = [...CHURCH_FORM_TEMPLATES, MEMBERSHIP_FORM_TEMPLATE];

/**
 * Ensure church form and email template records exist for the organisation.
 * Creates any that are missing (by name). Safe to call multiple times.
 * @param {string} organisationId
 * @returns {{ formsCreated: number, templatesCreated: number }}
 */
export async function seedChurchBoltOnContent(organisationId) {
	if (!organisationId) return { formsCreated: 0, templatesCreated: 0 };

	const [formsRaw, templatesRaw] = await Promise.all([
		readCollection('forms'),
		readCollection('email_templates')
	]);

	const existingForms = formsRaw.filter((f) => f.organisationId === organisationId);
	const existingTemplates = templatesRaw.filter((t) => t.organisationId === organisationId);
	const existingFormNames = new Set((existingForms.map((f) => f.name || '')).filter(Boolean));
	const existingTemplateNames = new Set((existingTemplates.map((t) => t.name || '')).filter(Boolean));

	let formsCreated = 0;
	let templatesCreated = 0;

	for (const tmpl of ALL_CHURCH_FORMS) {
		if (existingFormNames.has(tmpl.name)) continue;
		try {
			const formData = {
				name: tmpl.name,
				description: tmpl.description || '',
				fields: tmpl.fields,
				isSafeguarding: false
			};
			const validated = validateForm(formData);
			await create('forms', withOrganisationId(validated, organisationId));
			existingFormNames.add(tmpl.name);
			formsCreated++;
		} catch (err) {
			console.error('[churchBoltOnSeed] Failed to create form:', tmpl.name, err?.message || err);
		}
	}

	for (const tmpl of CHURCH_EMAIL_TEMPLATES) {
		if (existingTemplateNames.has(tmpl.name)) continue;
		try {
			const templateData = {
				name: tmpl.name,
				subject: tmpl.subject || '',
				htmlContent: tmpl.htmlContent || '',
				textContent: tmpl.textContent || '',
				description: tmpl.description || ''
			};
			const validated = validateNewsletterTemplate(templateData);
			await create('email_templates', withOrganisationId(validated, organisationId));
			existingTemplateNames.add(tmpl.name);
			templatesCreated++;
		} catch (err) {
			console.error('[churchBoltOnSeed] Failed to create email template:', tmpl.name, err?.message || err);
		}
	}

	return { formsCreated, templatesCreated };
}
