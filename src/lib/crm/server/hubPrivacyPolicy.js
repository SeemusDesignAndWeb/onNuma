/**
 * Replaces the "Who We Are" placeholder in the Hub Privacy Policy markdown
 * with the current organisation's details. Uses organisation name/address and either
 * the Hub-set privacy contact (Settings → Advanced) or the Super admin as contact.
 * @param {string} markdownContent - Full HUB_PRIVACY_POLICY.md content
 * @param {{ name?: string, address?: string, telephone?: string, email?: string, contactName?: string, privacyContactName?: string, privacyContactEmail?: string, privacyContactPhone?: string } | null} org - Current hub organisation
 * @param {{ name?: string, email?: string } | null} superAdminFallback - When org has no privacy contact set, use this (e.g. Super admin name/email)
 * @returns {string} Markdown with Who We Are section filled
 */
export function replaceOrgPlaceholder(markdownContent, org, superAdminFallback = null) {
	const whoWeAreHeading = '## Who We Are';
	const placeholderStart = markdownContent.indexOf(whoWeAreHeading);
	if (placeholderStart === -1) return markdownContent;

	const afterHeading = markdownContent.indexOf('\n\n', placeholderStart + whoWeAreHeading.length);
	const nextSection = markdownContent.indexOf('\n## ', afterHeading > 0 ? afterHeading : placeholderStart);
	const contentEnd = nextSection > 0 ? nextSection : markdownContent.length;

	const before = markdownContent.slice(0, afterHeading > 0 ? afterHeading + 2 : placeholderStart + whoWeAreHeading.length);
	const after = markdownContent.slice(contentEnd);

	const replacement = buildWhoWeAreSection(org, superAdminFallback);
	return before + replacement + after;
}

/**
 * @param {{ name?: string, address?: string, telephone?: string, email?: string, contactName?: string, privacyContactName?: string, privacyContactEmail?: string, privacyContactPhone?: string } | null} org
 * @param {{ name?: string, email?: string } | null} superAdminFallback - Used for Contact when org has no privacy contact set
 * @returns {string} Markdown for the Who We Are section (no "## Who We Are" heading)
 */
function buildWhoWeAreSection(org, superAdminFallback = null) {
	if (!org) {
		return `[Your organisation name and contact details should be inserted here by the organisation operating the Hub.]

**Contact:**  
[Email and phone for privacy enquiries]
`;
	}

	const name = (org.name && String(org.name).trim()) || 'Organisation';
	const address = (org.address && String(org.address).trim()) || '';

	const privacyName = (org.privacyContactName && String(org.privacyContactName).trim()) || '';
	const privacyEmail = (org.privacyContactEmail && String(org.privacyContactEmail).trim()) || '';
	const privacyPhone = (org.privacyContactPhone && String(org.privacyContactPhone).trim()) || '';
	const hasPrivacyContact = !!(privacyName || privacyEmail || privacyPhone);

	const lines = [`**${name}**`];
	if (address) {
		address.split(/\r?\n/).forEach((line) => {
			const t = line.trim();
			if (t) lines.push(t);
		});
	}
	lines.push('');
	lines.push('**Contact:**');
	if (hasPrivacyContact) {
		if (privacyName) lines.push(privacyName);
		if (privacyEmail) lines.push(`Email: ${privacyEmail}`);
		if (privacyPhone) lines.push(`Phone: ${privacyPhone}`);
	} else if (superAdminFallback && (superAdminFallback.name || superAdminFallback.email)) {
		if (superAdminFallback.name) lines.push(superAdminFallback.name);
		if (superAdminFallback.email) lines.push(`Email: ${superAdminFallback.email}`);
	} else {
		lines.push('[Email and phone for privacy enquiries]');
	}

	return lines.join('\n') + '\n';
}
