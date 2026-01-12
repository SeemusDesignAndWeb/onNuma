import { readCollection } from '$lib/crm/server/fileStore.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';

const ITEMS_PER_PAGE = 50;

export async function load({ url, locals }) {
	const admin = locals.admin || null;
	
	// Only super admins can view audit logs
	if (!isSuperAdmin(admin)) {
		return {
			auditLogs: [],
			currentPage: 1,
			totalPages: 0,
			total: 0,
			error: 'Access denied. Only super admins can view audit logs.'
		};
	}

	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const actionFilter = url.searchParams.get('action') || '';
	const adminIdFilter = url.searchParams.get('adminId') || '';
	const search = url.searchParams.get('search') || '';

	// Read all audit logs
	let auditLogs = await readCollection('audit_logs');
	
	// Sort by timestamp descending (newest first)
	auditLogs.sort((a, b) => {
		const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
		const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
		return timeB - timeA;
	});

	// Apply filters
	if (actionFilter) {
		auditLogs = auditLogs.filter(log => 
			log.action?.toLowerCase().includes(actionFilter.toLowerCase())
		);
	}

	if (adminIdFilter) {
		auditLogs = auditLogs.filter(log => log.adminId === adminIdFilter);
	}

	if (search) {
		const searchLower = search.toLowerCase();
		auditLogs = auditLogs.filter(log => {
			const action = (log.action || '').toLowerCase();
			const details = JSON.stringify(log.details || {}).toLowerCase();
			const ipAddress = (log.ipAddress || '').toLowerCase();
			return action.includes(searchLower) || 
				   details.includes(searchLower) || 
				   ipAddress.includes(searchLower);
		});
	}

	// Get admin names for display
	const admins = await readCollection('admins');
	const adminMap = new Map(admins.map(a => [a.id, a]));

	// Enrich audit logs with admin names
	auditLogs = auditLogs.map(log => ({
		...log,
		adminName: log.adminId ? (adminMap.get(log.adminId)?.email || 'Unknown') : 'System'
	}));

	const total = auditLogs.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = auditLogs.slice(start, end);

	// Get unique actions for filter dropdown
	const uniqueActions = [...new Set(auditLogs.map(log => log.action))].sort();
	
	// Get unique admin IDs for filter dropdown
	const uniqueAdminIds = [...new Set(auditLogs.map(log => log.adminId).filter(Boolean))].sort();

	return {
		auditLogs: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		actionFilter,
		adminIdFilter,
		search,
		uniqueActions,
		uniqueAdminIds,
		adminMap: Object.fromEntries(adminMap),
		error: null
	};
}
