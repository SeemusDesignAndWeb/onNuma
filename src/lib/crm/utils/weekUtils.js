/**
 * Get the start of the week (Sunday) for a given date
 * @param {Date|string} date - Date to get week start for
 * @returns {Date} Date object representing the start of the week (Sunday)
 */
export function getWeekStart(date) {
	const d = new Date(date);
	const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const diff = d.getDate() - day; // Days to subtract to get to Sunday
	const weekStart = new Date(d);
	weekStart.setDate(diff);
	weekStart.setHours(0, 0, 0, 0); // Set to start of day
	return weekStart;
}

/**
 * Get a unique week key (YYYY-MM-DD format for the Sunday of that week)
 * @param {Date|string} date - Date to get week key for
 * @returns {string} Week key in format YYYY-MM-DD
 */
export function getWeekKey(date) {
	const weekStart = getWeekStart(date);
	const year = weekStart.getFullYear();
	const month = String(weekStart.getMonth() + 1).padStart(2, '0');
	const day = String(weekStart.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Get the end of the week (Saturday) for a given date
 * @param {Date|string} date - Date to get week end for
 * @returns {Date} Date object representing the end of the week (Saturday)
 */
export function getWeekEnd(date) {
	const weekStart = getWeekStart(date);
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get Saturday
	weekEnd.setHours(23, 59, 59, 999); // Set to end of day
	return weekEnd;
}

/**
 * Format a week key for display (e.g., "Dec 1 - Dec 7, 2024")
 * @param {string} weekKey - Week key in format YYYY-MM-DD
 * @returns {string} Formatted week string
 */
export function formatWeekKey(weekKey) {
	if (!weekKey) return '';
	const [year, month, day] = weekKey.split('-').map(Number);
	const startDate = new Date(year, month - 1, day);
	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 6);
	
	const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	const endStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	
	return `${startStr} - ${endStr}`;
}
