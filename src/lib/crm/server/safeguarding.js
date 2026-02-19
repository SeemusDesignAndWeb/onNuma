/**
 * Safeguarding training tracker (DBS Bolt-On). Record-keeping only.
 * Status mirrors DBS logic: green (current), amber (due within 60 days), red (overdue or no record).
 */

export const SAFEGUARDING_LEVELS = [
	'basic_awareness',
	'foundation',
	'leadership',
	'safer_recruitment',
	'pso_induction'
];

export const SAFEGUARDING_LEVEL_LABELS = {
	basic_awareness: 'Basic Awareness',
	foundation: 'Foundation',
	leadership: 'Leadership',
	safer_recruitment: 'Safer Recruitment',
	pso_induction: 'PSO Induction'
};

const AMBER_DAYS = 60;

/**
 * Auto-suggest a renewal due date: dateCompleted + 3 years.
 * @param {string} dateCompleted - ISO date
 * @returns {string|null} ISO date
 */
export function computeSafeguardingRenewalDueDate(dateCompleted) {
	if (!dateCompleted) return null;
	const d = new Date(dateCompleted);
	if (Number.isNaN(d.getTime())) return null;
	d.setFullYear(d.getFullYear() + 3);
	return d.toISOString().slice(0, 10);
}

/**
 * Get safeguarding training status for display: 'green' | 'amber' | 'red'.
 * Green: current (renewal due > 60 days away).
 * Amber: due within 60 days.
 * Red: overdue or no record.
 * @param {{ level?: string, dateCompleted?: string, renewalDueDate?: string }} sg
 * @returns {{ status: 'green'|'amber'|'red', renewalDueDate: string|null, label: string }}
 */
export function getSafeguardingStatus(sg) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (!sg || !sg.level || !SAFEGUARDING_LEVELS.includes(sg.level)) {
		return { status: 'red', renewalDueDate: null, label: 'No record' };
	}

	const renewalDue = sg.renewalDueDate || computeSafeguardingRenewalDueDate(sg.dateCompleted);
	if (!renewalDue) {
		return { status: 'red', renewalDueDate: null, label: 'No renewal date' };
	}

	const dueDate = new Date(renewalDue);
	dueDate.setHours(0, 0, 0, 0);
	const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

	if (daysUntilDue < 0) return { status: 'red', renewalDueDate: renewalDue, label: 'Overdue' };
	if (daysUntilDue <= AMBER_DAYS) return { status: 'amber', renewalDueDate: renewalDue, label: 'Due soon' };
	return { status: 'green', renewalDueDate: renewalDue, label: 'Current' };
}
