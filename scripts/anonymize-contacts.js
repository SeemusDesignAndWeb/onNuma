import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Get data directory from environment variable or default to ./data
function getDataDir() {
	const envDataDir = process.env.CRM_DATA_DIR;
	if (envDataDir) {
		return envDataDir;
	}
	return join(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();
const CONTACTS_FILE = join(DATA_DIR, 'contacts.ndjson');

// Random data generators
const firstNames = ['John', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'James', 'Sophia', 'Robert', 'Isabella', 'William', 'Charlotte', 'Richard', 'Amelia', 'Joseph', 'Mia', 'Thomas', 'Harper', 'Charles', 'Evelyn', 'Daniel', 'Abigail', 'Matthew', 'Emily', 'Anthony', 'Elizabeth'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez'];
const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'example.com', 'test.com'];
const streets = ['High Street', 'Church Road', 'Main Avenue', 'Park Lane', 'Oak Drive', 'Maple Close', 'Elm Way', 'Victoria Road', 'Church Street', 'Garden Avenue'];
const cities = ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff'];
const counties = ['Greater London', 'West Midlands', 'Greater Manchester', 'West Yorkshire', 'Lancashire', 'Merseyside', 'South Yorkshire', 'Essex', 'Kent', 'Surrey'];
const membershipStatuses = ['member', 'regular-attender', 'visitor', 'former-member'];
const smallGroups = ['Weekly Email', 'Alpha Group', 'Evening Group', 'Morning Group', 'Youth Group', 'Women\'s Group', 'Men\'s Group', 'Explorers - Youth Group', 'Adventurers Kids Group', 'Leaders and influencers', 'Elders', 'Worship Team', 'Congregational Leadership Team'];

function randomItem(array) {
	return array[Math.floor(Math.random() * array.length)];
}

function randomPhone() {
	if (Math.random() > 0.3) {
		return `0${Math.floor(Math.random() * 9000000000) + 1000000000}`;
	}
	return '';
}

function randomPostcode() {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const letter1 = letters[Math.floor(Math.random() * letters.length)];
	const letter2 = letters[Math.floor(Math.random() * letters.length)];
	const num1 = Math.floor(Math.random() * 9) + 1;
	const num2 = Math.floor(Math.random() * 9) + 1;
	const letter3 = letters[Math.floor(Math.random() * letters.length)];
	const letter4 = letters[Math.floor(Math.random() * letters.length)];
	return `${letter1}${letter2}${num1} ${num2}${letter3}${letter4}`;
}

function randomDate(format = 'DD/MM/YYYY') {
	const now = new Date();
	const yearsAgo = Math.floor(Math.random() * 5);
	const daysAgo = Math.floor(Math.random() * 365 * yearsAgo);
	const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
	
	if (format === 'DD/MM/YYYY') {
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}
	return date.toISOString().split('T')[0];
}

function anonymizeContact(contact) {
	const firstName = randomItem(firstNames);
	const lastName = randomItem(lastNames);
	const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@${randomItem(domains)}`;
	
	const hasAddress = Math.random() > 0.3;
	const hasMembership = Math.random() > 0.4;
	const hasPhone = Math.random() > 0.3;
	const hasDateJoined = hasMembership && Math.random() > 0.5;
	const hasBaptismDate = hasMembership && Math.random() > 0.6;
	const hasSmallGroup = hasMembership && Math.random() > 0.5;
	const hasNotes = Math.random() > 0.7;
	
	// Preserve smallGroup structure if it exists (comma-separated list)
	let smallGroup = '';
	if (hasSmallGroup) {
		const numGroups = Math.floor(Math.random() * 3) + 1;
		const selectedGroups = [];
		for (let i = 0; i < numGroups && i < smallGroups.length; i++) {
			const group = randomItem(smallGroups);
			if (!selectedGroups.includes(group)) {
				selectedGroups.push(group);
			}
		}
		smallGroup = selectedGroups.join(', ');
	}
	
	return {
		...contact,
		email,
		firstName,
		lastName,
		phone: hasPhone ? randomPhone() : '',
		addressLine1: hasAddress ? `${Math.floor(Math.random() * 200) + 1} ${randomItem(streets)}` : '',
		addressLine2: hasAddress && Math.random() > 0.7 ? `Flat ${Math.floor(Math.random() * 10) + 1}` : '',
		city: hasAddress ? randomItem(cities) : '',
		county: hasAddress ? randomItem(counties) : '',
		postcode: hasAddress ? randomPostcode() : '',
		country: hasAddress ? (Math.random() > 0.2 ? 'United Kingdom' : '') : '',
		membershipStatus: hasMembership ? randomItem(membershipStatuses) : '',
		dateJoined: hasDateJoined ? randomDate('DD/MM/YYYY') : null,
		baptismDate: hasBaptismDate ? randomDate('DD/MM/YYYY') : null,
		smallGroup,
		servingAreas: [],
		giftings: [],
		notes: hasNotes ? `Sample notes for ${firstName} ${lastName}` : '',
		updatedAt: new Date().toISOString()
	};
}

async function anonymizeContacts() {
	try {
		// Check if file exists
		if (!existsSync(CONTACTS_FILE)) {
			console.log('❌ Contacts file does not exist:', CONTACTS_FILE);
			process.exit(1);
		}

		console.log('📖 Reading contacts from:', CONTACTS_FILE);
		
		// Read all contacts
		const content = await readFile(CONTACTS_FILE, 'utf8');
		if (!content.trim()) {
			console.log('⚠️  Contacts file is empty');
			return;
		}

		const contacts = content
			.trim()
			.split('\n')
			.filter(line => line.trim())
			.map(line => JSON.parse(line));

		console.log(`📝 Found ${contacts.length} contacts to anonymize`);

		// Anonymize each contact
		const anonymizedContacts = contacts.map(contact => anonymizeContact(contact));

		// Write back to file
		const output = anonymizedContacts.map(c => JSON.stringify(c)).join('\n') + '\n';
		await writeFile(CONTACTS_FILE, output, 'utf8');

		console.log(`✅ Successfully anonymized ${anonymizedContacts.length} contacts`);
		console.log(`📁 Updated file: ${CONTACTS_FILE}`);
		console.log('\n⚠️  IMPORTANT: This file should NOT be committed to git!');
		console.log('   Make sure data/contacts.ndjson is in your .gitignore file.');
	} catch (error) {
		console.error('❌ Error anonymizing contacts:', error.message);
		process.exit(1);
	}
}

anonymizeContacts();
