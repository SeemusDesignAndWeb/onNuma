// Default/predefined event colours (fallback)
// This file is safe to import on both client and server
export const DEFAULT_EVENT_COLOURS = [
	{ value: '#9333ea', label: 'Purple' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#10b981', label: 'Green' },
	{ value: '#ef4444', label: 'Red' },
	{ value: '#f97316', label: 'Orange' },
	{ value: '#eab308', label: 'Yellow' },
	{ value: '#ec4899', label: 'Pink' },
	{ value: '#6366f1', label: 'Indigo' },
	{ value: '#14b8a6', label: 'Teal' },
	{ value: '#f59e0b', label: 'Amber' }
];

// Legacy exports for backward compatibility
export const DEFAULT_EVENT_COLORS = DEFAULT_EVENT_COLOURS;
export const EVENT_COLORS = DEFAULT_EVENT_COLOURS;
export const EVENT_COLOURS = DEFAULT_EVENT_COLOURS;
