/**
 * Mapping between CRM record shapes and Postgres rows for contacts, events, rotas.
 * Used when DATA_STORE=database to store these as proper records (indexed columns) for fast search/filter.
 */

import {
	TABLE_NAME,
	CONTACTS_TABLE,
	EVENTS_TABLE,
	ROTAS_TABLE,
	RECORD_TABLE_COLLECTIONS,
	getCreateContactsTableSql,
	getCreateEventsTableSql,
	getCreateRotasTableSql
} from './dbSchema.js';

const CONTACT_COLUMNS = [
	'organisation_id', 'email', 'first_name', 'last_name', 'phone',
	'address_line1', 'address_line2', 'city', 'county', 'postcode', 'country',
	'membership_status', 'notes', 'subscribed', 'spouse_id', 'created_at', 'updated_at'
];
const CONTACT_EXTRA_KEYS = ['dateJoined', 'baptismDate', 'smallGroup', 'servingAreas', 'giftings'];

const EVENT_COLUMNS = ['organisation_id', 'title', 'location', 'visibility', 'created_at', 'updated_at'];
const EVENT_EXTRA_KEYS = [
	'description', 'color', 'listIds', 'meta', 'enableSignup', 'hideFromEmail',
	'showDietaryRequirements', 'maxSpaces', 'repeatType', 'repeatInterval',
	'repeatEndType', 'repeatEndDate', 'repeatCount', 'repeatDayOfMonth', 'repeatDayOfWeek', 'repeatWeekOfMonth'
];

const ROTA_COLUMNS = ['organisation_id', 'event_id', 'occurrence_id', 'role', 'capacity', 'created_at', 'updated_at'];
const ROTA_EXTRA_KEYS = ['assignees', 'notes', 'ownerId', 'visibility', 'helpFiles'];

function camelToSnake(s) {
	return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}
function snakeToCamel(s) {
	return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function recordToContactRow(record) {
	const extra = {};
	for (const k of CONTACT_EXTRA_KEYS) {
		if (record[k] !== undefined) extra[k] = record[k];
	}
	return {
		id: record.id,
		organisation_id: record.organisationId ?? null,
		email: record.email ?? '',
		first_name: record.firstName ?? null,
		last_name: record.lastName ?? null,
		phone: record.phone ?? null,
		address_line1: record.addressLine1 ?? null,
		address_line2: record.addressLine2 ?? null,
		city: record.city ?? null,
		county: record.county ?? null,
		postcode: record.postcode ?? null,
		country: record.country ?? null,
		membership_status: record.membershipStatus ?? null,
		notes: record.notes ?? null,
		subscribed: record.subscribed !== false,
		spouse_id: record.spouseId ?? null,
		created_at: record.createdAt ?? null,
		updated_at: record.updatedAt ?? null,
		extra: JSON.stringify(extra)
	};
}

function contactRowToRecord(row) {
	const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
	return {
		id: row.id,
		organisationId: row.organisation_id ?? null,
		email: row.email ?? '',
		firstName: row.first_name ?? '',
		lastName: row.last_name ?? '',
		phone: row.phone ?? '',
		addressLine1: row.address_line1 ?? '',
		addressLine2: row.address_line2 ?? '',
		city: row.city ?? '',
		county: row.county ?? '',
		postcode: row.postcode ?? '',
		country: row.country ?? '',
		membershipStatus: row.membership_status ?? '',
		notes: row.notes ?? '',
		subscribed: row.subscribed !== false,
		spouseId: row.spouse_id ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		...extra
	};
}

function recordToEventRow(record) {
	const extra = {};
	for (const k of EVENT_EXTRA_KEYS) {
		if (record[k] !== undefined) extra[k] = record[k];
	}
	return {
		id: record.id,
		organisation_id: record.organisationId ?? null,
		title: record.title ?? '',
		location: record.location ?? null,
		visibility: record.visibility ?? null,
		created_at: record.createdAt ?? null,
		updated_at: record.updatedAt ?? null,
		extra: JSON.stringify(extra)
	};
}

function eventRowToRecord(row) {
	const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
	return {
		id: row.id,
		organisationId: row.organisation_id ?? null,
		title: row.title ?? '',
		location: row.location ?? '',
		visibility: row.visibility ?? '',
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		...extra
	};
}

function recordToRotaRow(record) {
	const extra = {};
	for (const k of ROTA_EXTRA_KEYS) {
		if (record[k] !== undefined) extra[k] = record[k];
	}
	return {
		id: record.id,
		organisation_id: record.organisationId ?? null,
		event_id: record.eventId ?? '',
		occurrence_id: record.occurrenceId ?? null,
		role: record.role ?? '',
		capacity: typeof record.capacity === 'number' ? record.capacity : 1,
		created_at: record.createdAt ?? null,
		updated_at: record.updatedAt ?? null,
		extra: JSON.stringify(extra)
	};
}

function rotaRowToRecord(row) {
	const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
	return {
		id: row.id,
		organisationId: row.organisation_id ?? null,
		eventId: row.event_id ?? '',
		occurrenceId: row.occurrence_id ?? null,
		role: row.role ?? '',
		capacity: typeof row.capacity === 'number' ? row.capacity : 1,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		...extra
	};
}

export function isRecordCollection(collection) {
	return RECORD_TABLE_COLLECTIONS.includes(collection);
}

export function getTableName(collection) {
	if (collection === 'contacts') return CONTACTS_TABLE;
	if (collection === 'events') return EVENTS_TABLE;
	if (collection === 'rotas') return ROTAS_TABLE;
	return null;
}

export function recordToRow(collection, record) {
	if (collection === 'contacts') return recordToContactRow(record);
	if (collection === 'events') return recordToEventRow(record);
	if (collection === 'rotas') return recordToRotaRow(record);
	return null;
}

export function rowToRecord(collection, row) {
	if (collection === 'contacts') return contactRowToRecord(row);
	if (collection === 'events') return eventRowToRecord(row);
	if (collection === 'rotas') return rotaRowToRecord(row);
	return null;
}

/** Merge a partial update into extra JSONB for record tables. */
export function buildExtraPatch(collection, bodyPatch) {
	const omit = new Set(['id', 'createdAt', 'updatedAt']);
	if (collection === 'contacts') {
		CONTACT_COLUMNS.forEach((c) => omit.add(snakeToCamel(c)));
		CONTACT_EXTRA_KEYS.forEach((k) => omit.delete(k));
	}
	if (collection === 'events') {
		EVENT_COLUMNS.forEach((c) => omit.add(snakeToCamel(c)));
		EVENT_EXTRA_KEYS.forEach((k) => omit.delete(k));
	}
	if (collection === 'rotas') {
		ROTA_COLUMNS.forEach((c) => omit.add(snakeToCamel(c)));
		ROTA_EXTRA_KEYS.forEach((k) => omit.delete(k));
	}
	const extraPatch = {};
	for (const [k, v] of Object.entries(bodyPatch || {})) {
		if (k === 'id' || k === 'organisationId' || k === 'createdAt' || k === 'updatedAt') continue;
		if (omit.has(k)) continue;
		extraPatch[k] = v;
	}
	return extraPatch;
}

/** Build SET clause and values for column updates (for updatePartial). */
export function buildColumnUpdates(collection, bodyPatch) {
	const updates = [];
	const values = [];
	let i = 1;
	if (bodyPatch.updatedAt) {
		updates.push(`updated_at = $${i++}`);
		values.push(bodyPatch.updatedAt);
	}
	if (collection === 'contacts') {
		const map = {
			organisationId: 'organisation_id',
			email: 'email',
			firstName: 'first_name',
			lastName: 'last_name',
			phone: 'phone',
			addressLine1: 'address_line1',
			addressLine2: 'address_line2',
			city: 'city',
			county: 'county',
			postcode: 'postcode',
			country: 'country',
			membershipStatus: 'membership_status',
			notes: 'notes',
			subscribed: 'subscribed',
			spouseId: 'spouse_id'
		};
		for (const [camel, col] of Object.entries(map)) {
			if (bodyPatch[camel] === undefined) continue;
			updates.push(`${col} = $${i++}`);
			values.push(bodyPatch[camel]);
		}
	}
	if (collection === 'events') {
		const map = {
			organisationId: 'organisation_id',
			title: 'title',
			location: 'location',
			visibility: 'visibility'
		};
		for (const [camel, col] of Object.entries(map)) {
			if (bodyPatch[camel] === undefined) continue;
			updates.push(`${col} = $${i++}`);
			values.push(bodyPatch[camel]);
		}
	}
	if (collection === 'rotas') {
		const map = {
			organisationId: 'organisation_id',
			eventId: 'event_id',
			occurrenceId: 'occurrence_id',
			role: 'role',
			capacity: 'capacity'
		};
		for (const [camel, col] of Object.entries(map)) {
			if (bodyPatch[camel] === undefined) continue;
			updates.push(`${col} = $${i++}`);
			values.push(bodyPatch[camel]);
		}
	}
	return { updates, values, nextParam: i };
}

export {
	TABLE_NAME,
	getCreateContactsTableSql,
	getCreateEventsTableSql,
	getCreateRotasTableSql
};
