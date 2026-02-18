/**
 * Format date in UK format (DD/MM/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { 
		day: '2-digit', 
		month: '2-digit', 
		year: 'numeric' 
	});
}

/**
 * Format date and time in UK format (DD/MM/YYYY HH:MM)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date-time string
 */
export function formatDateTimeUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { 
		day: '2-digit', 
		month: '2-digit', 
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format time in UK format (HH:MM)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time string
 */
export function formatTimeUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleTimeString('en-GB', { 
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format date with month name in UK format (DD Month YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateLongUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { 
		day: 'numeric', 
		month: 'long', 
		year: 'numeric' 
	});
}

/**
 * Format date with short month in UK format (DD MMM YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateShortUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { 
		day: 'numeric', 
		month: 'short', 
		year: 'numeric' 
	});
}

/**
 * Format weekday in UK format
 * @param {Date|string} date - Date to format
 * @returns {string} Weekday name
 */
export function formatWeekdayUK(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

// ---------------------------------------------------------------------------
// MyHUB volunteer-facing date/time formatters
// Spec: "This Sunday, 23rd March" and "10:00am – 12:30pm"
// Plain English, no numbers-only dates, accessible to all ages.
// ---------------------------------------------------------------------------

/** Return the ordinal suffix for a day number (1→'st', 2→'nd', 3→'rd', 4→'th' …). */
function ordinalSuffix(n) {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return 'th'; // 11th, 12th, 13th
	const mod10 = n % 10;
	if (mod10 === 1) return 'st';
	if (mod10 === 2) return 'nd';
	if (mod10 === 3) return 'rd';
	return 'th';
}

/**
 * Format a date in plain English for volunteer-facing myhub pages.
 *
 * Examples:
 *   Today      → "Today, 23rd March"
 *   Tomorrow   → "Tomorrow, 24th March"
 *   Within 6d  → "This Sunday, 23rd March"
 *   Otherwise  → "Sunday, 23rd March"
 *   Different year → "Sunday, 23rd March 2026"
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function formatMyhubDate(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';

	const now = new Date();
	// Strip time to compare whole calendar days in local time.
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

	const dayNum = d.getDate();
	const suffix = ordinalSuffix(dayNum);
	const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
	const yearSuffix = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
	const dateStr = `${dayNum}${suffix} ${monthName}${yearSuffix}`;

	if (diffDays === 0) return `Today, ${dateStr}`;
	if (diffDays === 1) return `Tomorrow, ${dateStr}`;

	const weekdayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
	if (diffDays >= 2 && diffDays <= 6) return `This ${weekdayName}, ${dateStr}`;
	return `${weekdayName}, ${dateStr}`;
}

/**
 * Format a time in 12-hour am/pm style for volunteer-facing myhub pages.
 *
 * Examples: "10:00am", "2:30pm", "12:00pm"
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function formatMyhubTime(date) {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return '';

	let h = d.getHours();
	const m = d.getMinutes();
	const ampm = h >= 12 ? 'pm' : 'am';
	h = h % 12 || 12; // midnight/noon: 0 → 12
	const mStr = m.toString().padStart(2, '0');
	return `${h}:${mStr}${ampm}`;
}

/**
 * Format a start–end time range for volunteer-facing myhub pages.
 *
 * Example: "10:00am – 12:30pm"
 *
 * @param {Date|string} start
 * @param {Date|string} [end]
 * @returns {string}
 */
export function formatMyhubTimeRange(start, end) {
	const s = formatMyhubTime(start);
	const e = end ? formatMyhubTime(end) : '';
	if (!s) return '';
	if (!e) return s;
	return `${s} – ${e}`;
}

