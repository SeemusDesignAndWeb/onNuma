#!/usr/bin/env node

/**
 * Script to find and remove orphaned/disassociated data in rotas
 * 
 * This script checks for:
 * - Rotas with eventId that doesn't exist
 * - Rotas with occurrenceId that doesn't exist
 * - Assignees with contactId (string) that doesn't exist in contacts
 * - Assignees with occurrenceId that doesn't exist
 * - Rotas with ownerId that doesn't exist
 * 
 * Usage:
 *   node scripts/cleanup-orphaned-rota-data.js [--dry-run] [--remove]
 * 
 * Options:
 *   --dry-run    Only report issues, don't make changes (default)
 *   --remove     Actually remove orphaned data
 */

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

// Read NDJSON file
async function readCollection(collection) {
	const filePath = join(DATA_DIR, `${collection}.ndjson`);
	if (!existsSync(filePath)) {
		console.warn(`File not found: ${filePath}`);
		return [];
	}
	
	const content = await readFile(filePath, 'utf8');
	if (!content.trim()) {
		return [];
	}
	
	return content
		.trim()
		.split('\n')
		.filter(line => line.trim())
		.map(line => JSON.parse(line));
}

// Write NDJSON file
async function writeCollection(collection, records) {
	const filePath = join(DATA_DIR, `${collection}.ndjson`);
	const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
	await writeFile(filePath, content, 'utf8');
}

// Main cleanup function
async function cleanupOrphanedRotaData(dryRun = true) {
	console.log('🔍 Scanning for orphaned rota data...\n');
	console.log(`Data directory: ${DATA_DIR}\n`);
	
	// Load all collections
	const [rotas, events, occurrences, contacts] = await Promise.all([
		readCollection('rotas'),
		readCollection('events'),
		readCollection('occurrences'),
		readCollection('contacts')
	]);
	
	console.log(`Loaded ${rotas.length} rotas, ${events.length} events, ${occurrences.length} occurrences, ${contacts.length} contacts\n`);
	
	// Create lookup maps for faster checking
	const eventIds = new Set(events.map(e => e.id));
	const occurrenceIds = new Set(occurrences.map(o => o.id));
	const contactIds = new Set(contacts.map(c => c.id));
	
	// Map occurrences by eventId for validation
	const occurrencesByEventId = new Map();
	occurrences.forEach(occ => {
		if (!occurrencesByEventId.has(occ.eventId)) {
			occurrencesByEventId.set(occ.eventId, []);
		}
		occurrencesByEventId.get(occ.eventId).push(occ.id);
	});
	
	const issues = [];
	const cleanedRotas = [];
	let totalAssigneesRemoved = 0;
	
	// Check each rota
	for (const rota of rotas) {
		const rotaIssues = [];
		let rotaNeedsUpdate = false;
		const cleanedRota = { ...rota };
		
		// Check eventId
		if (rota.eventId && !eventIds.has(rota.eventId)) {
			rotaIssues.push({
				type: 'invalid_eventId',
				message: `Rota "${rota.role}" (${rota.id}) references non-existent eventId: ${rota.eventId}`
			});
		}
		
		// Check occurrenceId (if rota is for a specific occurrence)
		if (rota.occurrenceId && !occurrenceIds.has(rota.occurrenceId)) {
			rotaIssues.push({
				type: 'invalid_occurrenceId',
				message: `Rota "${rota.role}" (${rota.id}) references non-existent occurrenceId: ${rota.occurrenceId}`
			});
		}
		
		// Check occurrenceId belongs to the event
		if (rota.occurrenceId && rota.eventId) {
			const eventOccurrences = occurrencesByEventId.get(rota.eventId) || [];
			if (!eventOccurrences.includes(rota.occurrenceId)) {
				rotaIssues.push({
					type: 'mismatched_occurrenceId',
					message: `Rota "${rota.role}" (${rota.id}) occurrenceId ${rota.occurrenceId} does not belong to event ${rota.eventId}`
				});
			}
		}
		
		// Check ownerId
		if (rota.ownerId && !contactIds.has(rota.ownerId)) {
			rotaIssues.push({
				type: 'invalid_ownerId',
				message: `Rota "${rota.role}" (${rota.id}) references non-existent ownerId: ${rota.ownerId}`
			});
			if (!dryRun) {
				cleanedRota.ownerId = null;
				rotaNeedsUpdate = true;
			}
		}
		
		// Check assignees
		if (rota.assignees && Array.isArray(rota.assignees)) {
			const cleanedAssignees = [];
			let assigneesRemoved = 0;
			
			for (const assignee of rota.assignees) {
				let isValid = true;
				const assigneeIssues = [];
				
				// Extract contact ID and occurrence ID
				let contactId, occId;
				
				if (typeof assignee === 'string') {
					// Old format: string is the contact ID
					contactId = assignee;
					occId = rota.occurrenceId;
				} else if (assignee && typeof assignee === 'object') {
					// New format: { contactId, occurrenceId } or { contactId: { name, email }, occurrenceId }
					contactId = assignee.contactId || assignee.id;
					occId = assignee.occurrenceId || rota.occurrenceId;
				} else {
					// Invalid format
					isValid = false;
					assigneeIssues.push('Invalid assignee format');
				}
				
				// Check contact ID if it's a string (not a public signup object)
				if (isValid && typeof contactId === 'string') {
					if (!contactIds.has(contactId)) {
						isValid = false;
						assigneeIssues.push(`Contact ID ${contactId} does not exist`);
					}
				}
				
				// Check occurrence ID if specified
				if (isValid && occId) {
					if (!occurrenceIds.has(occId)) {
						isValid = false;
						assigneeIssues.push(`Occurrence ID ${occId} does not exist`);
					} else if (rota.eventId) {
						// Check occurrence belongs to the rota's event
						const eventOccurrences = occurrencesByEventId.get(rota.eventId) || [];
						if (!eventOccurrences.includes(occId)) {
							isValid = false;
							assigneeIssues.push(`Occurrence ID ${occId} does not belong to event ${rota.eventId}`);
						}
					}
				}
				
				if (isValid) {
					cleanedAssignees.push(assignee);
				} else {
					assigneesRemoved++;
					const assigneeInfo = typeof contactId === 'string' 
						? `contactId: ${contactId}`
						: typeof contactId === 'object' && contactId?.email
						? `email: ${contactId.email}`
						: 'unknown';
					
					rotaIssues.push({
						type: 'invalid_assignee',
						message: `Rota "${rota.role}" (${rota.id}) has invalid assignee: ${assigneeInfo} - ${assigneeIssues.join(', ')}`
					});
				}
			}
			
			if (assigneesRemoved > 0) {
				rotaNeedsUpdate = true;
				cleanedRota.assignees = cleanedAssignees;
				totalAssigneesRemoved += assigneesRemoved;
			}
		}
		
		if (rotaIssues.length > 0) {
			issues.push({
				rotaId: rota.id,
				rotaRole: rota.role,
				issues: rotaIssues
			});
		}
		
		if (rotaNeedsUpdate) {
			cleanedRotas.push(cleanedRota);
		}
	}
	
	// Report findings
	console.log('📊 Summary:\n');
	console.log(`Total rotas checked: ${rotas.length}`);
	console.log(`Rotas with issues: ${issues.length}`);
	console.log(`Total issues found: ${issues.reduce((sum, r) => sum + r.issues.length, 0)}`);
	console.log(`Assignees to be removed: ${totalAssigneesRemoved}`);
	console.log(`Rotas to be updated: ${cleanedRotas.length}\n`);
	
	if (issues.length === 0) {
		console.log('✅ No orphaned data found! All rotas are clean.\n');
		return;
	}
	
	// Detailed report
	console.log('📋 Detailed Issues:\n');
	issues.forEach(({ rotaId, rotaRole, issues: rotaIssues }) => {
		console.log(`\nRota: "${rotaRole}" (${rotaId})`);
		rotaIssues.forEach(issue => {
			console.log(`  ❌ ${issue.type}: ${issue.message}`);
		});
	});
	
	// Apply fixes if not dry run
	if (!dryRun && cleanedRotas.length > 0) {
		console.log('\n🔧 Applying fixes...\n');
		
		// Update rotas
		for (const cleanedRota of cleanedRotas) {
			const index = rotas.findIndex(r => r.id === cleanedRota.id);
			if (index !== -1) {
				rotas[index] = cleanedRota;
				console.log(`  ✓ Updated rota "${cleanedRota.role}" (${cleanedRota.id})`);
			}
		}
		
		// Write back to file
		await writeCollection('rotas', rotas);
		console.log(`\n✅ Successfully cleaned ${cleanedRotas.length} rotas`);
		console.log(`✅ Removed ${totalAssigneesRemoved} orphaned assignees\n`);
	} else if (dryRun) {
		console.log('\n💡 This was a dry run. Use --remove to actually clean the data.\n');
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--remove');

if (dryRun) {
	console.log('🔍 DRY RUN MODE - No changes will be made\n');
} else {
	console.log('⚠️  REMOVE MODE - Changes will be applied!\n');
}

// Run cleanup
cleanupOrphanedRotaData(dryRun)
	.then(() => {
		process.exit(0);
	})
	.catch(error => {
		console.error('❌ Error:', error);
		process.exit(1);
	});
