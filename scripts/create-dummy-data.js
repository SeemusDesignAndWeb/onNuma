import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { ulid } from 'ulid';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { getCreateTableSql, TABLE_NAME as CRM_TABLE_NAME } from '../src/lib/crm/server/dbSchema.js';

// Load .env so DATA_STORE and DATABASE_URL are set when script runs standalone
loadEnv();

// Get data directory from environment variable or default to ./data
// In production (Railway), set CRM_DATA_DIR=/data to use the persistent volume
function getDataDir() {
	const envDataDir = process.env.CRM_DATA_DIR;
	if (envDataDir) {
		// Use environment variable if set (absolute path for production)
		return envDataDir;
	}
	// Default to ./data for local development
	return join(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();

// Ensure data directory exists
async function ensureDir() {
	if (!existsSync(DATA_DIR)) {
		await mkdir(DATA_DIR, { recursive: true });
	}
}

// Helper to create a record
function createRecord(data) {
	return {
		...data,
		id: data.id || ulid(),
		createdAt: data.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
}

// Write NDJSON file
async function writeCollectionToFile(collection, records) {
	const filePath = join(DATA_DIR, `${collection}.ndjson`);
	await writeFile(filePath, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

// Write collection to Postgres when DATA_STORE=database (matches dbStore record shape)
const TABLE_NAME = CRM_TABLE_NAME;
function recordToRow(record) {
	const id = record?.id;
	const createdAt = record?.createdAt ?? null;
	const updatedAt = record?.updatedAt ?? null;
	const body = { ...record };
	delete body.id;
	delete body.createdAt;
	delete body.updatedAt;
	return { id, body, created_at: createdAt, updated_at: updatedAt };
}

function rowToRecord(row) {
	const rec = { ...row.body, id: row.id };
	if (row.created_at) rec.createdAt = row.created_at;
	if (row.updated_at) rec.updatedAt = row.updated_at;
	return rec;
}

async function readCollectionFromDb(pool, collection) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1 ORDER BY created_at ASC`,
			[collection]
		);
		return (res.rows || []).map(rowToRecord);
	} finally {
		client.release();
	}
}

async function writeCollectionToDb(pool, collection, records) {
	const byId = new Map();
	for (const rec of records) {
		const id = rec?.id;
		if (id != null) byId.set(id, rec);
	}
	const uniqueRecords = [...byId.values()];
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(`DELETE FROM ${TABLE_NAME} WHERE collection = $1`, [collection]);
		for (const rec of uniqueRecords) {
			const row = recordToRow(rec);
			await client.query(
				`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
				[collection, row.id, JSON.stringify(row.body), row.created_at, row.updated_at]
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

/** Resolve first organisation ID so dummy data is org-scoped and visible in the Hub. */
async function resolveOrganisationId(useDb, pool) {
	if (useDb && pool) {
		const orgs = await readCollectionFromDb(pool, 'organisations');
		const first = (orgs || []).find(o => o && !o.archivedAt);
		return first?.id ?? null;
	}
	const filePath = join(DATA_DIR, 'organisations.ndjson');
	if (existsSync(filePath)) {
		const { readFile } = await import('fs/promises');
		const text = await readFile(filePath, 'utf8');
		const lines = text.trim().split('\n').filter(Boolean);
		for (const line of lines) {
			const o = JSON.parse(line);
			if (o && !o.archivedAt) return o.id || null;
		}
	}
	return null;
}

// Generate dummy contacts (realistic UK-style names for text/demo purposes)
function generateContacts() {
	const firstNames = ['Oliver', 'Amelia', 'George', 'Isla', 'Arthur', 'Ava', 'Noah', 'Mia', 'Leo', 'Ivy', 'Oscar', 'Freya', 'Theo', 'Florence', 'Finley', 'Willow', 'Henry', 'Emilia', 'Charlie', 'Sophie', 'Jack', 'Ella', 'Thomas', 'Grace', 'William', 'Poppy'];
	const lastNames = ['Patel', 'Khan', 'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts', 'Robinson', 'Wright', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Martin', 'Wood', 'Clarke', 'Jackson', 'Hill', 'Lewis'];
	const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'example.com'];
	const streets = ['High Street', 'Church Road', 'Main Avenue', 'Park Lane', 'Oak Drive', 'Maple Close', 'Elm Way'];
	const cities = ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol'];
	const counties = ['Greater London', 'West Midlands', 'Greater Manchester', 'West Yorkshire', 'Lancashire', 'Merseyside'];
	const membershipStatuses = ['member', 'regular-attender', 'visitor', 'former-member'];
	const servingAreas = ['Worship', 'Children\'s Ministry', 'Youth', 'Welcome Team', 'Prayer', 'Sound', 'Setup', 'Small Groups'];
	const giftings = ['Teaching', 'Pastoral Care', 'Administration', 'Music', 'Evangelism', 'Hospitality', 'Leadership'];
	const smallGroups = ['Alpha Group', 'Evening Group', 'Morning Group', 'Youth Group', 'Women\'s Group', 'Men\'s Group'];
	
	const contacts = [];
	for (let i = 0; i < 25; i++) {
		const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
		const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
		const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domains[Math.floor(Math.random() * domains.length)]}`;
		
		const hasAddress = Math.random() > 0.3;
		const hasMembership = Math.random() > 0.4;
		const numServingAreas = Math.floor(Math.random() * 3);
		const numGiftings = Math.floor(Math.random() * 3);
		
		const contact = {
			email,
			firstName,
			lastName,
			phone: Math.random() > 0.5 ? `0${Math.floor(Math.random() * 9000000000) + 1000000000}` : '',
			addressLine1: hasAddress ? `${Math.floor(Math.random() * 200) + 1} ${streets[Math.floor(Math.random() * streets.length)]}` : '',
			addressLine2: hasAddress && Math.random() > 0.7 ? 'Flat ' + (Math.floor(Math.random() * 10) + 1) : '',
			city: hasAddress ? cities[Math.floor(Math.random() * cities.length)] : '',
			county: hasAddress ? counties[Math.floor(Math.random() * counties.length)] : '',
			postcode: hasAddress ? `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` : '',
			country: hasAddress ? 'United Kingdom' : '',
			membershipStatus: hasMembership ? membershipStatuses[Math.floor(Math.random() * membershipStatuses.length)] : '',
			dateJoined: hasMembership && Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
			baptismDate: hasMembership && Math.random() > 0.6 ? new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
			smallGroup: hasMembership && Math.random() > 0.5 ? smallGroups[Math.floor(Math.random() * smallGroups.length)] : '',
			servingAreas: Array.from({ length: numServingAreas }, () => servingAreas[Math.floor(Math.random() * servingAreas.length)]),
			giftings: Array.from({ length: numGiftings }, () => giftings[Math.floor(Math.random() * giftings.length)]),
			notes: Math.random() > 0.7 ? `Contact notes for ${firstName} ${lastName}` : ''
		};
		
		contacts.push(createRecord(contact));
	}
	return contacts;
}

// Generate dummy lists
function generateLists(contacts) {
	const listNames = ['Newsletter Subscribers', 'Volunteers', 'Event Attendees', 'Youth Group', 'Small Groups', 'Prayer Team'];
	const lists = [];
	
	for (let i = 0; i < listNames.length; i++) {
		const name = listNames[i];
		const contactCount = Math.floor(Math.random() * 10) + 5;
		const contactIds = [];
		
		// Randomly assign contacts to this list
		const shuffled = [...contacts].sort(() => 0.5 - Math.random());
		for (let j = 0; j < contactCount && j < shuffled.length; j++) {
			contactIds.push(shuffled[j].id);
		}
		
		lists.push(createRecord({
			name,
			description: `List of ${name.toLowerCase()}`,
			contactIds
		}));
	}
	return lists;
}

// Generate dummy events
function generateEvents() {
	const eventTitles = [
		'Sunday Service',
		'Youth Group Meeting',
		'Prayer Meeting',
		'Community Outreach',
		'Bible Study',
		'Women\'s Fellowship',
		'Men\'s Breakfast',
		'Children\'s Church',
		'Worship Night',
		'Alpha Course'
	];
	
	const locations = [
		'Main Hall',
		'Community Centre',
		'Church Building',
		'Online',
		'Park',
		'Café',
		''
	];
	
	const events = [];
	for (let i = 0; i < eventTitles.length; i++) {
		const title = eventTitles[i];
		// Enable signup for first 5 events so the Hub Bookings panel has data to display and test
		const enableSignup = i < 5;
		events.push(createRecord({
			title,
			description: `<p>Description for ${title}. This is a sample event description.</p>`,
			location: locations[Math.floor(Math.random() * locations.length)],
			visibility: Math.random() > 0.3 ? 'public' : 'private',
			enableSignup: enableSignup,
			meta: {}
		}));
	}
	return events;
}

// Generate dummy occurrences (more per event for rota testing)
function generateOccurrences(events) {
	const occurrences = [];

	for (const event of events) {
		// Create 4-6 occurrences per event so rotas have plenty of dates to test
		const count = Math.floor(Math.random() * 3) + 4;

		for (let i = 0; i < count; i++) {
			const now = new Date();
			const daysOffset = Math.floor(Math.random() * 56) + (i * 7); // Spread over ~8 weeks
			const startDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
			startDate.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 4) * 15, 0, 0);

			const endDate = new Date(startDate);
			endDate.setHours(startDate.getHours() + Math.floor(Math.random() * 3) + 1);

			occurrences.push(createRecord({
				eventId: event.id,
				startsAt: startDate.toISOString(),
				endsAt: endDate.toISOString(),
				location: Math.random() > 0.5 ? event.location : ''
			}));
		}
	}
	return occurrences;
}

// Generate dummy rotas (assignees use real contact IDs so participation and "suggested to invite" work)
// Only ~90% of contacts are assigned to rotas so some remain "not engaged" for testing Suggested to invite
function generateRotas(events, occurrences, contacts) {
	const roles = ['Worship Leader', 'Sound Technician', 'Usher', 'Children\'s Worker', 'Preacher', 'Prayer Team', 'Setup Team', 'Welcome Team'];
	const rotas = [];
	const shuffled = [...(contacts || [])].sort(() => 0.5 - Math.random());
	const eligibleCount = Math.max(1, Math.floor(shuffled.length * 0.9));
	const eligibleForRotas = shuffled.slice(0, eligibleCount);
	let contactIndex = 0;

	function nextAssignee() {
		if (eligibleForRotas.length === 0) return null;
		const c = eligibleForRotas[contactIndex % eligibleForRotas.length];
		contactIndex++;
		const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown';
		return { contactId: c.id, name, email: c.email || '' };
	}

	for (const event of events) {
		// Create 2-4 rotas per event so there are plenty to test
		const rotaCount = Math.floor(Math.random() * 3) + 2;

		for (let i = 0; i < rotaCount; i++) {
			const role = roles[Math.floor(Math.random() * roles.length)];
			const eventOccurrences = occurrences.filter(o => o.eventId === event.id);
			const occurrence = eventOccurrences.length > 0 && Math.random() > 0.5
				? eventOccurrences[Math.floor(Math.random() * eventOccurrences.length)]
				: null;

			const capacity = Math.floor(Math.random() * 4) + 2;
			const assigneeCount = Math.min(Math.floor(Math.random() * (capacity + 1)), eligibleForRotas.length);

			const assignees = [];
			for (let j = 0; j < assigneeCount; j++) {
				const a = nextAssignee();
				if (a) assignees.push(a);
			}

			rotas.push(createRecord({
				eventId: event.id,
				occurrenceId: occurrence ? occurrence.id : null,
				role,
				capacity,
				assignees,
				notes: Math.random() > 0.6 ? `<p>Notes for ${role} rota</p>` : ''
			}));
		}
	}
	return rotas;
}

// Generate dummy event signups (for events with enableSignup so Hub Bookings panel shows data)
function generateEventSignups(events, occurrences, contacts) {
	const signups = [];
	const signupEvents = events.filter(e => e.enableSignup === true);
	const firstNames = ['Oliver', 'Amelia', 'George', 'Isla', 'Arthur', 'Ava', 'Noah', 'Mia', 'Leo', 'Ivy', 'Oscar', 'Freya', 'Theo', 'Florence'];
	const lastNames = ['Patel', 'Khan', 'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies'];
	const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com'];

	for (const event of signupEvents) {
		const eventOccurrences = occurrences.filter(o => o.eventId === event.id);
		if (eventOccurrences.length === 0) continue;
		// Vary signup count per event so the bookings bar chart has different bar lengths (e.g. 5–25)
		const numSignups = Math.floor(Math.random() * 21) + 5;
		for (let i = 0; i < numSignups; i++) {
			const occurrence = eventOccurrences[i % eventOccurrences.length];
			const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
			const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
			const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@${domains[Math.floor(Math.random() * domains.length)]}`;
			signups.push(createRecord({
				eventId: event.id,
				occurrenceId: occurrence.id,
				name: `${firstName} ${lastName}`,
				email,
				guestCount: Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0
			}));
		}
	}
	return signups;
}

// Generate dummy newsletters
function generateNewsletters() {
	const subjects = [
		'Weekly Update - This Week at Church',
		'Special Announcement: Upcoming Events',
		'Monthly Newsletter - December 2024',
		'Prayer Requests and Praises',
		'Youth Group News',
		'Community Outreach Update'
	];
	
	const newsletters = [];
	for (let i = 0; i < subjects.length; i++) {
		const subject = subjects[i];
		newsletters.push(createRecord({
			subject,
			htmlContent: `<h1>${subject}</h1><p>This is a sample newsletter content. You can edit this in The HUB.</p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`,
			textContent: `${subject}\n\nThis is a sample newsletter content. You can edit this in The HUB.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.`,
			status: i < 2 ? 'sent' : 'draft',
			logs: [],
			metrics: {}
		}));
	}
	return newsletters;
}

// Generate dummy forms
function generateForms() {
	const forms = [
		{
			name: 'Kids Work Register',
			description: 'Registration form for children\'s activities',
			isSafeguarding: false,
			fields: [
				{ id: '1', type: 'text', label: 'Child\'s Name', name: 'child_name', required: true, placeholder: 'Enter child\'s full name' },
				{ id: '2', type: 'date', label: 'Date of Birth', name: 'dob', required: true },
				{ id: '3', type: 'text', label: 'Parent/Guardian Name', name: 'parent_name', required: true },
				{ id: '4', type: 'email', label: 'Parent Email', name: 'parent_email', required: true },
				{ id: '5', type: 'tel', label: 'Emergency Contact', name: 'emergency_contact', required: true },
				{ id: '6', type: 'textarea', label: 'Medical Information', name: 'medical_info', required: false, placeholder: 'Any allergies or medical conditions' },
				{ id: '7', type: 'checkbox', label: 'Permissions', name: 'permissions', required: false, options: ['Photo consent', 'Video consent', 'Medical treatment consent'] }
			]
		},
		{
			name: 'Safeguarding Disclosure Form',
			description: 'Confidential safeguarding disclosure form',
			isSafeguarding: true,
			fields: [
				{ id: '1', type: 'text', label: 'Your Name', name: 'name', required: true },
				{ id: '2', type: 'email', label: 'Email Address', name: 'email', required: true },
				{ id: '3', type: 'tel', label: 'Phone Number', name: 'phone', required: true },
				{ id: '4', type: 'date', label: 'Date of Incident', name: 'incident_date', required: true },
				{ id: '5', type: 'textarea', label: 'Description of Concern', name: 'description', required: true, placeholder: 'Please provide details of your concern' },
				{ id: '6', type: 'select', label: 'Urgency Level', name: 'urgency', required: true, options: ['Low', 'Medium', 'High', 'Critical'] }
			]
		},
		{
			name: 'Volunteer Application',
			description: 'Application form for new volunteers',
			isSafeguarding: false,
			fields: [
				{ id: '1', type: 'text', label: 'Full Name', name: 'full_name', required: true },
				{ id: '2', type: 'email', label: 'Email', name: 'email', required: true },
				{ id: '3', type: 'tel', label: 'Phone', name: 'phone', required: true },
				{ id: '4', type: 'select', label: 'Area of Interest', name: 'area', required: true, options: ['Children\'s Work', 'Youth', 'Worship', 'Welcome Team', 'Administration', 'Other'] },
				{ id: '5', type: 'textarea', label: 'Why do you want to volunteer?', name: 'motivation', required: true },
				{ id: '6', type: 'radio', label: 'Availability', name: 'availability', required: true, options: ['Weekdays', 'Weekends', 'Both', 'Flexible'] }
			]
		}
	];

	return forms.map(f => createRecord(f));
}

// Generate dummy form submissions (registers)
async function generateFormSubmissions(forms) {
	const registers = [];
	const firstNames = ['Oliver', 'Amelia', 'George', 'Isla', 'Arthur', 'Ava', 'Noah', 'Mia', 'Leo', 'Ivy', 'Oscar', 'Freya', 'Theo', 'Florence', 'Finley', 'Willow', 'Henry', 'Emilia', 'Sophie', 'Ella', 'Jack', 'Grace', 'Thomas', 'Poppy', 'William', 'Charlotte'];
	const lastNames = ['Patel', 'Khan', 'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts', 'Robinson', 'Wright', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Martin', 'Wood', 'Clarke', 'Jackson', 'Hill', 'Lewis'];
	const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'example.com'];
	
	// Try to import encrypt function for safeguarding forms
	let encrypt = null;
	try {
		const cryptoModule = await import('../src/lib/hub/server/crypto.js');
		encrypt = cryptoModule.encrypt;
	} catch (error) {
		console.warn('⚠️  Encryption not available - safeguarding forms will have plain data (set CRM_SECRET_KEY to encrypt)');
	}
	
	for (const form of forms) {
		// Generate 3-8 submissions per form
		const submissionCount = Math.floor(Math.random() * 6) + 3;
		
		for (let i = 0; i < submissionCount; i++) {
			const submissionData = {};
			
			// Generate data based on form fields
			for (const field of form.fields) {
				if (field.type === 'text' || field.type === 'email' || field.type === 'tel') {
					if (field.name.includes('name') || field.name.includes('Name')) {
						const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
						const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
						if (field.name.includes('child') || field.name.includes('Child')) {
							submissionData[field.name] = `${firstName} ${lastName}`;
						} else if (field.name.includes('parent') || field.name.includes('Parent')) {
							submissionData[field.name] = `${firstName} ${lastName}`;
						} else {
							submissionData[field.name] = `${firstName} ${lastName}`;
						}
					} else if (field.name.includes('email') || field.name.includes('Email')) {
						const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
						const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
						submissionData[field.name] = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domains[Math.floor(Math.random() * domains.length)]}`;
					} else if (field.name.includes('phone') || field.name.includes('Phone') || field.name.includes('contact') || field.name.includes('Contact')) {
						submissionData[field.name] = `0${Math.floor(Math.random() * 9000000000) + 1000000000}`;
					} else {
						submissionData[field.name] = `Sample ${field.label}`;
					}
				} else if (field.type === 'date') {
					if (field.name.includes('birth') || field.name.includes('Birth') || field.name.includes('dob')) {
						// Child's date of birth (5-15 years ago)
						const yearsAgo = Math.floor(Math.random() * 10) + 5;
						const dob = new Date();
						dob.setFullYear(dob.getFullYear() - yearsAgo);
						dob.setMonth(Math.floor(Math.random() * 12));
						dob.setDate(Math.floor(Math.random() * 28) + 1);
						submissionData[field.name] = dob.toISOString().split('T')[0];
					} else if (field.name.includes('incident') || field.name.includes('Incident')) {
						// Incident date (recent past)
						const daysAgo = Math.floor(Math.random() * 90);
						const incidentDate = new Date();
						incidentDate.setDate(incidentDate.getDate() - daysAgo);
						submissionData[field.name] = incidentDate.toISOString().split('T')[0];
					} else {
						// Random date in past year
						const daysAgo = Math.floor(Math.random() * 365);
						const date = new Date();
						date.setDate(date.getDate() - daysAgo);
						submissionData[field.name] = date.toISOString().split('T')[0];
					}
				} else if (field.type === 'textarea') {
					if (field.name.includes('medical') || field.name.includes('Medical')) {
						const medicalInfo = ['No known allergies', 'Peanut allergy', 'Asthma', 'Diabetes', 'None'];
						submissionData[field.name] = medicalInfo[Math.floor(Math.random() * medicalInfo.length)];
					} else if (field.name.includes('description') || field.name.includes('Description') || field.name.includes('concern') || field.name.includes('Concern')) {
						submissionData[field.name] = 'This is a sample description of the concern or issue. It contains detailed information about the situation.';
					} else if (field.name.includes('motivation') || field.name.includes('Why')) {
						submissionData[field.name] = 'I am interested in volunteering because I want to serve the church community and use my gifts to help others.';
					} else {
						submissionData[field.name] = `Sample text for ${field.label}. This is a longer text entry that provides more detailed information.`;
					}
				} else if (field.type === 'select') {
					if (field.options && Array.isArray(field.options) && field.options.length > 0) {
						submissionData[field.name] = field.options[Math.floor(Math.random() * field.options.length)];
					} else if (typeof field.options === 'string') {
						const options = field.options.split(',').map(o => o.trim());
						submissionData[field.name] = options[Math.floor(Math.random() * options.length)];
					} else {
						submissionData[field.name] = 'Option 1';
					}
				} else if (field.type === 'checkbox') {
					if (field.options && Array.isArray(field.options) && field.options.length > 0) {
						const selectedCount = Math.floor(Math.random() * field.options.length) + 1;
						const shuffled = [...field.options].sort(() => 0.5 - Math.random());
						submissionData[field.name] = shuffled.slice(0, selectedCount);
					} else if (typeof field.options === 'string') {
						const options = field.options.split(',').map(o => o.trim());
						const selectedCount = Math.floor(Math.random() * options.length) + 1;
						const shuffled = [...options].sort(() => 0.5 - Math.random());
						submissionData[field.name] = shuffled.slice(0, selectedCount);
					} else {
						submissionData[field.name] = [];
					}
				} else if (field.type === 'radio') {
					if (field.options && Array.isArray(field.options) && field.options.length > 0) {
						submissionData[field.name] = field.options[Math.floor(Math.random() * field.options.length)];
					} else if (typeof field.options === 'string') {
						const options = field.options.split(',').map(o => o.trim());
						submissionData[field.name] = options[Math.floor(Math.random() * options.length)];
					} else {
						submissionData[field.name] = 'Option 1';
					}
				} else {
					submissionData[field.name] = `Sample ${field.type} value`;
				}
			}
			
			// Generate submission date (within last 90 days)
			const daysAgo = Math.floor(Math.random() * 90);
			const submittedAt = new Date();
			submittedAt.setDate(submittedAt.getDate() - daysAgo);
			submittedAt.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0);
			
			const register = {
				formId: form.id,
				submittedAt: submittedAt.toISOString()
			};
			
			// Handle encryption for safeguarding forms
			if (form.requiresEncryption || form.isSafeguarding) {
				if (encrypt) {
					try {
						register.encryptedData = encrypt(JSON.stringify(submissionData));
						register.data = null;
					} catch (error) {
						console.warn(`⚠️  Could not encrypt submission for form ${form.name}: ${error.message}`);
						// Store as plain data if encryption fails
						register.data = submissionData;
						register.encryptedData = null;
					}
				} else {
					// If encryption not available, store as plain data
					// In production, this should always be encrypted
					register.data = submissionData;
					register.encryptedData = null;
				}
			} else {
				register.data = submissionData;
				register.encryptedData = null;
			}
			
			registers.push(createRecord(register));
		}
	}
	
	return registers;
}

// Main function
async function main() {
	console.log('Creating dummy data...\n');

	await ensureDir();

	const useDb = process.env.DATA_STORE === 'database' && process.env.DATABASE_URL;
	let pool = null;
	let organisationId = null;

	if (useDb) {
		pool = new pg.Pool({
			connectionString: process.env.DATABASE_URL,
			max: 5,
			ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
		});
		const client = await pool.connect();
		try {
			for (const stmt of getCreateTableSql().split(';').filter(Boolean)) {
				await client.query(stmt.trim() + ';');
			}
		} finally {
			client.release();
		}
		organisationId = await resolveOrganisationId(true, pool);
		if (organisationId) {
			console.log(`📌 Using organisation ID: ${organisationId}`);
		} else {
			console.warn('⚠️  No organisation found — set organisationId on records so they appear in the Hub for an org.');
		}
	} else {
		organisationId = await resolveOrganisationId(false, null);
		if (organisationId) console.log(`📌 Using organisation ID: ${organisationId}`);
	}

	// Generate data
	const contacts = generateContacts();
	console.log(`✅ Created ${contacts.length} contacts`);

	const lists = generateLists(contacts);
	console.log(`✅ Created ${lists.length} lists`);

	const events = generateEvents();
	console.log(`✅ Created ${events.length} events`);

	const occurrences = generateOccurrences(events);
	console.log(`✅ Created ${occurrences.length} occurrences`);

	const rotas = generateRotas(events, occurrences, contacts);
	console.log(`✅ Created ${rotas.length} rotas (assignees linked to contacts)`);

	const eventSignups = generateEventSignups(events, occurrences, contacts);
	console.log(`✅ Created ${eventSignups.length} event signups (for Bookings panel)`);

	const newsletters = generateNewsletters();
	console.log(`✅ Created ${newsletters.length} newsletters`);

	const forms = generateForms();
	console.log(`✅ Created ${forms.length} forms`);

	const registers = await generateFormSubmissions(forms);
	console.log(`✅ Created ${registers.length} form submissions`);

	// Apply organisationId so data is visible in the Hub when an org is selected
	if (organisationId) {
		for (const r of contacts) r.organisationId = organisationId;
		for (const r of lists) r.organisationId = organisationId;
		for (const r of events) r.organisationId = organisationId;
		for (const r of occurrences) r.organisationId = organisationId;
		for (const r of rotas) r.organisationId = organisationId;
		for (const r of eventSignups) r.organisationId = organisationId;
		for (const r of newsletters) r.organisationId = organisationId;
		for (const r of forms) r.organisationId = organisationId;
		for (const r of registers) r.organisationId = organisationId;
	}

	if (useDb && pool) {
		try {
			await writeCollectionToDb(pool, 'contacts', contacts);
			await writeCollectionToDb(pool, 'lists', lists);
			await writeCollectionToDb(pool, 'events', events);
			await writeCollectionToDb(pool, 'occurrences', occurrences);
			await writeCollectionToDb(pool, 'rotas', rotas);
			await writeCollectionToDb(pool, 'event_signups', eventSignups);
			await writeCollectionToDb(pool, 'newsletters', newsletters);
			await writeCollectionToDb(pool, 'forms', forms);
			await writeCollectionToDb(pool, 'registers', registers);
			console.log('\n✨ Dummy data written to database (DATA_STORE=database).');
		} finally {
			await pool.end();
		}
	} else {
		await writeCollectionToFile('contacts', contacts);
		await writeCollectionToFile('lists', lists);
		await writeCollectionToFile('events', events);
		await writeCollectionToFile('occurrences', occurrences);
		await writeCollectionToFile('rotas', rotas);
		await writeCollectionToFile('event_signups', eventSignups);
		await writeCollectionToFile('newsletters', newsletters);
		await writeCollectionToFile('forms', forms);
		await writeCollectionToFile('registers', registers);
		console.log('\n✨ Dummy data created successfully!');
	}
	console.log('\nYou can now view the data in The HUB at /hub (Events, Rotas, Bookings panel, Suggested to invite).');
}

main().catch(error => {
	console.error('❌ Error:', error);
	process.exit(1);
});

