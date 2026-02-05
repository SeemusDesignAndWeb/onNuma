#!/usr/bin/env node
/**
 * Generate 100 dummy contacts and write an XLSX file ready for Hub Contact Import.
 * Column headers match the Hub import auto-mapping (Email, First Name, Last Name, etc.).
 *
 * Usage: node scripts/create-hub-import-contacts.js
 * Output: data/hub-contacts-import.xlsx
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const COUNT = 100;

// Hub import expects these exact column names for auto-mapping
const HEADERS = [
	'Email',
	'First Name',
	'Last Name',
	'Phone',
	'Address Line 1',
	'Address Line 2',
	'City',
	'County',
	'Postcode',
	'Country',
	'Membership Status',
	'Date Joined',
	'Baptism Date',
	'Serving Areas',
	'Giftings',
	'Notes'
];

function getDataDir() {
	const envDataDir = process.env.CRM_DATA_DIR;
	if (envDataDir) return envDataDir;
	return join(process.cwd(), 'data');
}

function randomChoice(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPastDate(yearsAgo) {
	const ms = yearsAgo * 365.25 * 24 * 60 * 60 * 1000;
	return new Date(Date.now() - Math.random() * ms).toISOString().split('T')[0];
}

function ukPostcode() {
	const letters = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
	const digit = () => Math.floor(Math.random() * 9) + 1;
	return `${letters()}${letters()}${digit()} ${digit()}${letters()}${letters()}`;
}

function generateContacts() {
	const firstNames = [
		'John', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'James', 'Sophia',
		'Robert', 'Isabella', 'William', 'Charlotte', 'Richard', 'Amelia', 'Joseph', 'Mia',
		'Thomas', 'Harper', 'Charles', 'Evelyn', 'Daniel', 'Abigail', 'Matthew', 'Ella',
		'Anthony', 'Scarlett', 'Mark', 'Grace', 'Donald', 'Chloe', 'Steven', 'Victoria'
	];
	const lastNames = [
		'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
		'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
		'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark',
		'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green'
	];
	const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'btinternet.com', 'sky.com', 'live.co.uk'];
	const streets = ['High Street', 'Church Road', 'Main Avenue', 'Park Lane', 'Oak Drive', 'Maple Close', 'Elm Way', 'Station Road', 'Victoria Road', 'Green Lane'];
	const cities = ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Eltham', 'Greenwich', 'Bexley', 'Bromley'];
	const counties = ['Greater London', 'West Midlands', 'Greater Manchester', 'West Yorkshire', 'Lancashire', 'Merseyside', 'Kent', 'Essex'];
	const membershipStatuses = ['member', 'regular-attender', 'visitor', 'former-member'];
	const servingAreas = ['Worship', 'Children\'s Ministry', 'Youth', 'Welcome Team', 'Prayer', 'Sound', 'Setup', 'Small Groups'];
	const giftings = ['Teaching', 'Pastoral Care', 'Administration', 'Music', 'Evangelism', 'Hospitality', 'Leadership'];

	const usedEmails = new Set();
	const rows = [];

	for (let i = 0; i < COUNT; i++) {
		const firstName = randomChoice(firstNames);
		const lastName = randomChoice(lastNames);
		// Ensure unique email by adding index if needed
		let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 50 ? i : ''}@${randomChoice(domains)}`;
		while (usedEmails.has(email)) {
			email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}${randomInt(1, 999)}@${randomChoice(domains)}`;
		}
		usedEmails.add(email);

		const hasAddress = Math.random() > 0.25;
		const hasMembership = Math.random() > 0.35;
		const numServing = randomInt(0, 3);
		const numGiftings = randomInt(0, 3);

		const servingList = Array.from({ length: numServing }, () => randomChoice(servingAreas));
		const giftingsList = Array.from({ length: numGiftings }, () => randomChoice(giftings));

		const row = {
			'Email': email,
			'First Name': firstName,
			'Last Name': lastName,
			'Phone': Math.random() > 0.45 ? `0${randomInt(1000000000, 7999999999)}` : '',
			'Address Line 1': hasAddress ? `${randomInt(1, 250)} ${randomChoice(streets)}` : '',
			'Address Line 2': hasAddress && Math.random() > 0.7 ? `Flat ${randomInt(1, 15)}` : '',
			'City': hasAddress ? randomChoice(cities) : '',
			'County': hasAddress ? randomChoice(counties) : '',
			'Postcode': hasAddress ? ukPostcode() : '',
			'Country': hasAddress ? 'United Kingdom' : '',
			'Membership Status': hasMembership ? randomChoice(membershipStatuses) : '',
			'Date Joined': hasMembership && Math.random() > 0.5 ? randomPastDate(5) : '',
			'Baptism Date': hasMembership && Math.random() > 0.6 ? randomPastDate(10) : '',
			'Serving Areas': servingList.join(', '),
			'Giftings': giftingsList.join(', '),
			'Notes': Math.random() > 0.75 ? `Notes for ${firstName} ${lastName}.` : ''
		};

		rows.push(row);
	}

	return rows;
}

async function main() {
	const dataDir = getDataDir();
	if (!existsSync(dataDir)) {
		await mkdir(dataDir, { recursive: true });
	}

	const rows = generateContacts();
	const worksheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

	const outPath = join(dataDir, 'hub-contacts-import.xlsx');
	XLSX.writeFile(workbook, outPath);

	console.log(`Created ${COUNT} dummy contacts in ${outPath}`);
	console.log('Import in the Hub: Contacts → Import Contacts → choose this file.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
