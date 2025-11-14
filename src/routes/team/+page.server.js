import { getSettings, getTeam, getContactInfo } from '$lib/server/database';

export async function load() {
	const settings = getSettings();
	const team = getTeam();
	const contactInfo = getContactInfo();
	return {
		teamDescription: settings.teamDescription || '',
		teamHeroTitle: settings.teamHeroTitle || 'Developing leaders of tomorrow',
		teamHeroSubtitle: settings.teamHeroSubtitle || '',
		teamHeroButtons: settings.teamHeroButtons || [],
		team: team || [],
		contactInfo
	};
}

