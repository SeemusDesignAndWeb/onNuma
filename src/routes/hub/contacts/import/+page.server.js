import { fail } from '@sveltejs/kit';
import { readCollection, readCollectionCount, create } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { getConfiguredPlanFromAreaPermissions, getConfiguredPlanMaxContacts } from '$lib/crm/server/permissions.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Excel file magic bytes (Office Open XML format)
const EXCEL_MAGIC_BYTES = [
	[0x50, 0x4B, 0x03, 0x04], // ZIP signature (XLSX is a ZIP file)
	[0x50, 0x4B, 0x05, 0x06], // ZIP end of central directory
	[0x50, 0x4B, 0x07, 0x08]  // ZIP central directory
];

/**
 * Check if buffer starts with Excel magic bytes
 */
function isExcelFile(buffer) {
	if (buffer.length < 4) return false;
	const firstBytes = Array.from(buffer.slice(0, 4));
	return EXCEL_MAGIC_BYTES.some(magic => 
		magic.every((byte, i) => byte === firstBytes[i])
	);
}

/**
 * Validate file type by checking magic bytes
 */
function validateFileType(buffer, fileName) {
	const fileNameLower = fileName.toLowerCase();
	const isExcelExtension = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
	const isCSVExtension = fileNameLower.endsWith('.csv');
	
	if (isExcelExtension) {
		if (!isExcelFile(buffer)) {
			throw new Error('File does not appear to be a valid Excel file (magic bytes mismatch)');
		}
		return 'excel';
	} else if (isCSVExtension) {
		// CSV files don't have magic bytes, but we can check for common CSV patterns
		// For now, we'll trust the extension for CSV files
		return 'csv';
	} else {
		throw new Error('Unsupported file type. Please upload a CSV or Excel (.xlsx) file.');
	}
}

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

// Cache xlsx module to avoid reloading
let xlsxModule = null;

// Parse Excel file
async function parseExcel(fileBuffer, fileName) {
	try {
		// Load xlsx module once and cache it
		if (!xlsxModule) {
			// Use dynamic import with createRequire to handle CommonJS module
			const { createRequire } = await import('module');
			const require = createRequire(import.meta.url);
			
			// Make require available globally for xlsx's internal use
			if (typeof globalThis !== 'undefined') {
				globalThis.require = require;
			}
			
			xlsxModule = require('xlsx');
		}
		
		const XLSX = xlsxModule;
		
		// Ensure we have the read function
		if (!XLSX || !XLSX.read) {
			throw new Error('xlsx library not loaded correctly - missing read function');
		}
		
		// Read workbook with options to avoid formula evaluation (which might use require)
		const workbook = XLSX.read(fileBuffer, { 
			type: 'buffer',
			cellDates: false, // Don't parse dates (we'll handle them manually)
			cellNF: false, // Don't parse number formats
			cellStyles: false, // Don't parse styles
			sheetStubs: false // Don't create stubs for missing sheets
		});
		
		// Get the first sheet
		if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
			throw new Error('Excel file has no sheets');
		}
		
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];
		
		if (!worksheet) {
			throw new Error(`Sheet "${sheetName}" not found in Excel file`);
		}
		
		// Convert to JSON with header row
		// Use raw: true and convert manually to avoid any internal require() calls
		const data = XLSX.utils.sheet_to_json(worksheet, { 
			defval: '', // Default value for empty cells
			raw: true, // Get raw values to avoid any processing that might use require()
			dateNF: 'yyyy-mm-dd' // Date format
		});
		
		if (data.length === 0) {
			throw new Error('Excel file is empty');
		}
		
		// Get headers from first row
		const headers = Object.keys(data[0]);
		
		// Convert array of objects to array of row objects
		// Process each row carefully to avoid any issues
		const rows = [];
		for (const row of data) {
			const rowObj = {};
			for (const header of headers) {
				// Handle Excel date serial numbers and various value types
				let value = row[header];
				
				// Handle undefined/null
				if (value === undefined || value === null) {
					value = '';
				} 
				// Handle numbers (could be dates or regular numbers)
				else if (typeof value === 'number') {
					// Check if it's an Excel date serial number (typically > 1 and < 100000)
					// Excel epoch is 1900-01-00 (day 0), but JavaScript uses 1970-01-01
					// Offset is 25569 days (accounting for Excel's 1900 leap year bug)
					if (value > 1 && value < 100000) {
						try {
							// Excel date serial number
							const date = new Date((value - 25569) * 86400 * 1000);
							// Check if date is valid
							if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
								value = date.toISOString().split('T')[0]; // YYYY-MM-DD format
							} else {
								value = String(value);
							}
						} catch (err) {
							// If date conversion fails, just convert to string
							value = String(value);
						}
					} else {
						value = String(value);
					}
				} 
				// Handle Date objects
				else if (value instanceof Date) {
					value = value.toISOString().split('T')[0];
				} 
				// Handle everything else as string
				else {
					value = String(value).trim();
				}
				rowObj[header] = value;
			}
			rows.push(rowObj);
		}
		
		return { headers, rows };
	} catch (error) {
		throw new Error(`Failed to parse Excel file: ${error.message}`);
	}
}

// Parse CSV content
function parseCSV(csvText) {
	const lines = csvText.split('\n').filter(line => line.trim());
	if (lines.length === 0) {
		throw new Error('CSV file is empty');
	}

	// Parse header row
	const headers = parseCSVLine(lines[0]);
	
	// Parse data rows
	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);
		if (values.length === 0 || values.every(v => !v.trim())) continue; // Skip empty rows
		
		const row = {};
		headers.forEach((header, index) => {
			row[header.trim()] = values[index]?.trim() || '';
		});
		rows.push(row);
	}
	
	return { headers, rows };
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line) {
	const values = [];
	let current = '';
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];
		
		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// End of field
			values.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	
	// Add last field
	values.push(current);
	
	return values;
}

// Map CSV columns to contact fields
function mapCSVToContact(row, fieldMapping) {
	const contact = {};
	
	for (const [csvField, contactField] of Object.entries(fieldMapping)) {
		if (contactField && contactField !== 'skip' && row[csvField] !== undefined && row[csvField] !== null) {
			// Convert to string and trim, handling various data types
			let value = row[csvField];
			if (typeof value !== 'string') {
				value = String(value || '');
			}
			value = value.trim();
			
			// Skip empty values
			if (!value) continue;
			
			// Handle array fields (servingAreas, giftings)
			if (contactField === 'servingAreas' || contactField === 'giftings') {
				contact[contactField] = value.split(',').map(v => v.trim()).filter(v => v);
			} else {
				contact[contactField] = value;
			}
		}
	}
	
	return contact;
}

export const actions = {
	upload: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const file = data.get('file');
			if (!file || !(file instanceof File)) {
				return fail(400, { error: 'No file uploaded' });
			}

			// Check file size
			if (file.size > MAX_FILE_SIZE) {
				return fail(400, { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` });
			}

			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			
			// Validate file type by checking magic bytes
			const fileType = validateFileType(buffer, file.name);
			const isExcel = fileType === 'excel';
			
			let headers, rows, fileText;
			
			if (isExcel) {
				// Parse Excel file
				const parsed = await parseExcel(buffer, file.name);
				headers = parsed.headers;
				rows = parsed.rows;
				fileText = null; // Excel files don't have text representation
			} else {
				// Parse CSV file
				fileText = buffer.toString('utf8');
				const parsed = parseCSV(fileText);
				headers = parsed.headers;
				rows = parsed.rows;
			}

			// Auto-detect field mapping based on common column names
			const fieldMapping = {};
			const commonMappings = {
				'email': ['email', 'e-mail', 'e mail', 'email address'],
				'firstName': ['first name', 'firstname', 'fname', 'given name', 'forename'],
				'lastName': ['last name', 'lastname', 'lname', 'surname', 'family name'],
				'phone': ['phone', 'telephone', 'tel', 'mobile', 'phone number'],
				'addressLine1': ['address', 'address line 1', 'address1', 'street', 'street address'],
				'addressLine2': ['address line 2', 'address2', 'address line two'],
				'city': ['city', 'town'],
				'county': ['county', 'state', 'region', 'province'],
				'postcode': ['postcode', 'post code', 'zip', 'zipcode', 'postal code'],
				'country': ['country'],
				'membershipStatus': ['membership status', 'membership', 'status', 'member status'],
				'dateJoined': ['date joined', 'joined', 'join date', 'member since'],
				'baptismDate': ['baptism date', 'baptism', 'baptised', 'baptized'],
				'servingAreas': ['serving areas', 'serving', 'areas', 'ministries'],
				'giftings': ['giftings', 'gifts', 'spiritual gifts'],
				'notes': ['notes', 'note', 'comments', 'comment']
			};

			headers.forEach(header => {
				const headerLower = header.toLowerCase().trim();
				let mapped = false;
				
				for (const [contactField, possibleNames] of Object.entries(commonMappings)) {
					if (possibleNames.some(name => headerLower.includes(name))) {
						fieldMapping[header] = contactField;
						mapped = true;
						break;
					}
				}
				
				if (!mapped) {
					fieldMapping[header] = 'skip';
				}
			});

			return {
				success: true,
				headers,
				rows: rows.slice(0, 10), // Preview first 10 rows
				totalRows: rows.length,
				fieldMapping,
				fileType: isExcel ? 'excel' : 'csv',
				fileData: isExcel ? buffer.toString('base64') : fileText // Store file data for import step
			};
		} catch (error) {
			return fail(400, { error: error.message });
		}
	},
	
	import: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const fileData = data.get('fileData');
			const fileType = data.get('fileType') || 'csv';
			const fieldMappingJson = data.get('fieldMapping');
			
			if (!fileData || !fieldMappingJson) {
				return fail(400, { error: 'Missing file data or field mapping' });
			}

			const fieldMapping = JSON.parse(fieldMappingJson);
			let rows;
			
			if (fileType === 'excel') {
				// Parse Excel from base64
				try {
					const buffer = Buffer.from(fileData, 'base64');
					const parsed = await parseExcel(buffer, 'import.xlsx');
					rows = parsed.rows;
				} catch (excelError) {
					// Use safe logging in production
					if (process.env.NODE_ENV === 'production') {
						console.error('Excel parsing error:', excelError?.message || 'Unknown error');
					} else {
						console.error('Excel parsing error:', excelError);
					}
					return fail(400, { error: `Failed to parse Excel file: ${excelError.message}` });
				}
			} else {
				// Parse CSV
				const parsed = parseCSV(fileData);
				rows = parsed.rows;
			}
			
			const results = {
				success: [],
				errors: []
			};
			const organisationId = await getCurrentOrganisationId();
			const organisations = await readCollection('organisations');
			const org = (Array.isArray(organisations) ? organisations : []).find((o) => o?.id === organisationId);
			const plan = org ? (await getConfiguredPlanFromAreaPermissions(org.areaPermissions)) || 'free' : 'free';
			const planLimit = await getConfiguredPlanMaxContacts(plan);
			const existingCount = await readCollectionCount('contacts', { organisationId });
			const remainingCapacity = Math.max(0, planLimit - existingCount);
			if (remainingCapacity <= 0) {
				return fail(400, {
					error: `Contact limit reached (${planLimit}). Upgrade your plan to import more contacts.`
				});
			}
			let importedCount = 0;

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
				let contactData = null;
				
				try {
					contactData = mapCSVToContact(row, fieldMapping);
					
					// Check for required email
					if (!contactData.email) {
						results.errors.push({
							row: rowNumber,
							error: 'Email is required'
						});
						continue;
					}
					if (importedCount >= remainingCapacity) {
						results.errors.push({
							row: rowNumber,
							error: `Contact limit reached (${planLimit}).`
						});
						continue;
					}

					// Validate and create contact (scoped to current Hub organisation)
					// Note: Duplicate emails are now allowed (e.g., husband and wife sharing an email)
					const validated = validateContact(contactData);
					const contact = await create('contacts', withOrganisationId(validated, organisationId));
					importedCount += 1;
					
					results.success.push({
						row: rowNumber,
						email: contact.email,
						name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
					});
				} catch (error) {
					// Better error handling - capture the actual error message and stack
					let errorMessage = 'Unknown error';
					if (error instanceof Error) {
						errorMessage = error.message || String(error);
						// Log full error details for debugging
						console.error(`Error importing row ${rowNumber}:`, {
							message: error.message,
							stack: error.stack,
							name: error.name,
							row: row,
							contactData: contactData || 'not created'
						});
					} else {
						errorMessage = String(error);
						console.error(`Error importing row ${rowNumber} (non-Error):`, error);
					}
					results.errors.push({
						row: rowNumber,
						error: errorMessage
					});
				}
			}

			// Log audit event for bulk import
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'bulk_import', 'contact', 'multiple', {
				fileType,
				totalRows: rows.length,
				successCount: results.success.length,
				errorCount: results.errors.length,
				importedContacts: results.success.map(s => ({ email: s.email, name: s.name }))
			}, event);

			return {
				success: true,
				results
			};
		} catch (error) {
			return fail(400, { error: error.message });
		}
	}
};

