#!/usr/bin/env node

/**
 * Script to fix Phil Poulton's name in rota assignees
 * This script finds any assignee with name "Phil." and updates it to "Phil Poulton"
 * 
 * Usage: node scripts/fix-phil-poulton-name.js [email]
 * If email is provided, only updates if the email matches
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

async function fixPhilPoultonName(emailFilter = null) {
	console.log('🔍 Searching for rotas with "Phil." as assignee name...');
	console.log(`📁 Data directory: ${DATA_DIR}`);
	
	if (emailFilter) {
		console.log(`📧 Email filter: ${emailFilter}`);
	}
	
	try {
		// Read all rotas
		const rotas = await readCollection('rotas');
		console.log(`📋 Found ${rotas.length} rotas to check`);
		
		let fixedCount = 0;
		let rotaUpdates = [];
		
		for (const rota of rotas) {
			if (!rota.assignees || !Array.isArray(rota.assignees)) {
				continue;
			}
			
			let rotaNeedsUpdate = false;
			const updatedAssignees = rota.assignees.map(assignee => {
				// Skip old format (string contact ID)
				if (typeof assignee === 'string') {
					return assignee;
				}
				
				// Check if this is a public signup with name "Phil."
				if (assignee && typeof assignee === 'object') {
					let nameToCheck = null;
					let emailToCheck = null;
					
					// Check different assignee formats
					if (assignee.name) {
						// Direct name/email format: { name, email, occurrenceId }
						nameToCheck = assignee.name;
						emailToCheck = assignee.email;
					} else if (assignee.contactId && typeof assignee.contactId === 'object' && assignee.contactId.name) {
						// Public signup format: { contactId: { name, email }, occurrenceId }
						nameToCheck = assignee.contactId.name;
						emailToCheck = assignee.contactId.email;
					}
					
					// If we found "Phil." as the name
					if (nameToCheck === 'Phil.') {
						// If email filter is provided, check if it matches
						if (emailFilter) {
							if (emailToCheck && emailToCheck.toLowerCase() === emailFilter.toLowerCase()) {
								console.log(`✅ Found match in rota ${rota.id} (${rota.role}): "${emailToCheck}"`);
								rotaNeedsUpdate = true;
								
								// Update the name in the correct location
								if (assignee.name) {
									return {
										...assignee,
										name: 'Phil Poulton'
									};
								} else if (assignee.contactId && typeof assignee.contactId === 'object') {
									return {
										...assignee,
										contactId: {
											...assignee.contactId,
											name: 'Phil Poulton'
										}
									};
								}
							}
						} else {
							// No email filter - update all "Phil." names
							console.log(`✅ Found "Phil." in rota ${rota.id} (${rota.role})${emailToCheck ? ` (${emailToCheck})` : ''}`);
							rotaNeedsUpdate = true;
							
							// Update the name in the correct location
							if (assignee.name) {
								return {
									...assignee,
									name: 'Phil Poulton'
								};
							} else if (assignee.contactId && typeof assignee.contactId === 'object') {
								return {
									...assignee,
									contactId: {
										...assignee.contactId,
										name: 'Phil Poulton'
									}
								};
							}
						}
					}
				}
				return assignee;
			});
			
			if (rotaNeedsUpdate) {
				rotaUpdates.push({
					rotaId: rota.id,
					rotaRole: rota.role,
					updatedRota: {
						...rota,
						assignees: updatedAssignees
					}
				});
				fixedCount++;
			}
		}
		
		if (rotaUpdates.length === 0) {
			console.log('❌ No rotas found with "Phil." as assignee name');
			if (emailFilter) {
				console.log('💡 Try running without email filter to see all "Phil." entries');
			}
			return;
		}
		
		console.log(`\n📝 Found ${rotaUpdates.length} rota(s) to update:`);
		rotaUpdates.forEach(({ rotaId, rotaRole }) => {
			console.log(`   - Rota ${rotaId}: ${rotaRole}`);
		});
		
		// Update rotas in the collection
		console.log('\n💾 Updating rotas...');
		const allRotas = await readCollection('rotas');
		const updatedRotas = allRotas.map(rota => {
			const update = rotaUpdates.find(u => u.rotaId === rota.id);
			return update ? update.updatedRota : rota;
		});
		
		await writeCollection('rotas', updatedRotas);
		console.log(`   ✓ Updated ${rotaUpdates.length} rota(s) in database`);
		
		console.log(`\n✅ Successfully updated ${fixedCount} rota(s)!`);
		console.log('🎉 Phil Poulton\'s name has been fixed in all rotas');
		
	} catch (error) {
		console.error('❌ Error fixing names:', error);
		process.exit(1);
	}
}

// Get email from command line args if provided
const emailFilter = process.argv[2] || null;

if (emailFilter && !emailFilter.includes('@')) {
	console.error('❌ Invalid email format. Usage: node scripts/fix-phil-poulton-name.js [email]');
	process.exit(1);
}

fixPhilPoultonName(emailFilter).catch(error => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
