import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

// Environment variable configuration
const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

// Path resolution function
function getDbPath() {
	let finalPath;
	if (DB_PATH.startsWith('./') || DB_PATH.startsWith('../')) {
		// Relative path - resolve from project root (local development)
		finalPath = join(process.cwd(), DB_PATH);
	} else {
		// Absolute path (e.g., /data/database.json for Railway volumes)
		finalPath = DB_PATH;
	}

	// Ensure the directory exists
	const dir = dirname(finalPath);
	try {
		mkdirSync(dir, { recursive: true });
	} catch (error) {
		// Directory might already exist, or volume might not be mounted yet (during build)
		console.warn('[DB] Could not create directory:', error);
	}

	return finalPath;
}

// Default database structure
const defaultDatabase = {
	pages: [],
	team: [],
	services: [],
	heroSlides: [],
	images: [],
	podcasts: [],
	communityGroups: [],
	events: [],
	contact: {
		address: '542 Westhorne Avenue, Eltham, London, SE9 6RR',
		phone: '020 8850 1331',
		email: 'enquiries@egcc.co.uk',
		googleMapsUrl:
			'https://www.google.com/maps/place/Eltham+Green+Community+Church/@51.4551128,0.0400237,15z'
	},
	serviceTimes: {
		sunday: '11:00 AM (Doors open at 10:30 AM)',
		weekday: 'Various times - see Community Groups',
		notes: ''
	},
	settings: {
		siteName: 'Eltham Green Community Church',
		primaryColor: '#4BB170',
		podcastAuthor: 'Eltham Green Community Church',
		podcastEmail: 'johnawatson72@gmail.com',
		podcastImage: 'http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png',
		podcastDescription: 'Latest sermons from Eltham Green Community Church',
		teamDescription: 'EGCC is led by an Eldership Team. The team is led by our Lead Pastor John Watson who will seek God for the vision of the church.&nbsp; We take responsibility together for the life and care of the church.&nbsp; The Elders, with their wives, are supported by many others who take a leadership role whether that be in leading Worship, Ministry, Community Groups, Youth and Children\'s work and other church and community activities.',
		teamHeroTitle: 'Developing leaders of tomorrow',
		youtubePlaylistId: '',
		youtubeChannelId: ''
	}
};

// Read function - Safe initialization in production ONLY if file doesn't exist
export function readDatabase() {
	const dbPath = getDbPath();
	try {
		const data = readFileSync(dbPath, 'utf-8');
		return JSON.parse(data);
	} catch (error) {
		const isProduction = process.env.NODE_ENV === 'production' || dbPath.startsWith('/');
		
		// Check if file doesn't exist (ENOENT) vs other errors
		const fileDoesNotExist = error.code === 'ENOENT';
		
		if (isProduction && fileDoesNotExist) {
			// In production, if file doesn't exist, try to restore from git history ONCE
			// This is safe because the file doesn't exist - we're not overwriting anything
			console.warn('[DB] Database file not found in production, attempting one-time restore from git history...');
			console.warn('[DB] Database file path:', dbPath);
			
			try {
				// Try to restore from git history (commit fc4b61b has the last good version)
				const gitDb = execSync('git show fc4b61b:data/database.json', { 
					encoding: 'utf-8',
					cwd: process.cwd(),
					timeout: 10000
				});
				
				// Validate JSON
				const parsed = JSON.parse(gitDb);
				
				// Write to volume
				writeDatabase(parsed);
				console.log('[DB] ✅ Successfully restored database from git history to', dbPath);
				
				return parsed;
			} catch (restoreError) {
				console.error('[DB] ❌ Failed to restore from git history:', restoreError.message);
				console.error('[DB] This is a production environment - cannot proceed without database');
				throw new Error(`Database file not found at ${dbPath} and could not restore from backup. Please restore manually.`);
			}
		} else if (isProduction) {
			// Other errors in production - don't auto-initialize
			console.error('[DB] CRITICAL: Failed to read database in production:', error);
			console.error('[DB] Database file path:', dbPath);
			console.error('[DB] This is a production environment - NOT initializing to prevent data loss');
			throw new Error(`Database file error at ${dbPath}: ${error.message}`);
		}
		
		// Only auto-initialize in development
		console.warn('[DB] Failed to read database from persistent location:', error);
		console.log('[DB] Database file does not exist (development mode), initializing with default structure...');

		// Initialize with default structure and save to persistent location (development only)
		try {
			writeDatabase(defaultDatabase);
			console.log('[DB] Successfully initialized database with default structure');
		} catch (writeError) {
			console.warn('[DB] Could not write to persistent location:', writeError);
			console.log('[DB] Returning default structure in memory (changes will not persist)');
		}

		return defaultDatabase;
	}
}

// Write function
export function writeDatabase(data) {
	const dbPath = getDbPath();
	const dir = dirname(dbPath);

	try {
		mkdirSync(dir, { recursive: true });
	} catch (error) {
		// Directory might already exist, ignore
		console.warn('[DB] Directory creation warning:', error);
	}

	try {
		const jsonData = JSON.stringify(data, null, 2);
		writeFileSync(dbPath, jsonData, 'utf-8');
		console.log('[DB] Successfully wrote database to', dbPath);
	} catch (error) {
		console.error('[DB] Could not write database:', error);
		throw error;
	}
}

// CRUD operations for Pages
export function getPages() {
	const db = readDatabase();
	return db.pages || [];
}

export function getPage(id) {
	const db = readDatabase();
	return db.pages.find((p) => p.id === id);
}

export function savePage(page) {
	const db = readDatabase();
	const index = db.pages.findIndex((p) => p.id === page.id);
	if (index >= 0) {
		// CRITICAL: Preserve sections and other fields that might not be in the incoming page object
		// Only update fields that are actually provided in the page object
		const existingPage = db.pages[index];
		db.pages[index] = {
			...existingPage,
			...page,
			// Explicitly preserve sections if they exist in existing page but not in new page
			sections: page.sections !== undefined ? page.sections : existingPage.sections,
			// Preserve other important fields
			heroMessages: page.heroMessages !== undefined ? page.heroMessages : existingPage.heroMessages,
			heroButtons: page.heroButtons !== undefined ? page.heroButtons : existingPage.heroButtons,
		};
	} else {
		db.pages.push(page);
	}
	writeDatabase(db);
}

export function deletePage(id) {
	const db = readDatabase();
	db.pages = db.pages.filter((p) => p.id !== id);
	writeDatabase(db);
}

// CRUD operations for Team
export function getTeam() {
	const db = readDatabase();
	return db.team || [];
}

export function getTeamMember(id) {
	const db = readDatabase();
	return db.team.find((t) => t.id === id);
}

export function saveTeamMember(member) {
	const db = readDatabase();
	const index = db.team.findIndex((t) => t.id === member.id);
	if (index >= 0) {
		db.team[index] = member;
	} else {
		db.team.push(member);
	}
	writeDatabase(db);
}

export function deleteTeamMember(id) {
	const db = readDatabase();
	db.team = db.team.filter((t) => t.id !== id);
	writeDatabase(db);
}

// CRUD operations for Services
export function getServices() {
	const db = readDatabase();
	return db.services || [];
}

export function saveService(service) {
	const db = readDatabase();
	const index = db.services.findIndex((s) => s.id === service.id);
	if (index >= 0) {
		db.services[index] = service;
	} else {
		db.services.push(service);
	}
	writeDatabase(db);
}

export function deleteService(id) {
	const db = readDatabase();
	db.services = db.services.filter((s) => s.id !== id);
	writeDatabase(db);
}

// CRUD operations for Activities
export function getActivities() {
	const db = readDatabase();
	// DO NOT auto-write on read - this could overwrite production data
	// Only initialize in memory if missing
	if (!db.activities) {
		db.activities = [];
	}
	return db.activities || [];
}

export function getActivity(id) {
	const db = readDatabase();
	return db.activities?.find((a) => a.id === id);
}

export function saveActivity(activity) {
	const db = readDatabase();
	if (!db.activities) {
		db.activities = [];
	}
	const index = db.activities.findIndex((a) => a.id === activity.id);
	if (index >= 0) {
		db.activities[index] = activity;
	} else {
		db.activities.push(activity);
	}
	writeDatabase(db);
}

export function deleteActivity(id) {
	const db = readDatabase();
	if (db.activities) {
		db.activities = db.activities.filter((a) => a.id !== id);
		writeDatabase(db);
	}
}

// CRUD operations for Hero Slides
export function getHeroSlides() {
	const db = readDatabase();
	return db.heroSlides || [];
}

export function saveHeroSlide(slide) {
	const db = readDatabase();
	const index = db.heroSlides.findIndex((s) => s.id === slide.id);
	if (index >= 0) {
		db.heroSlides[index] = slide;
	} else {
		db.heroSlides.push(slide);
	}
	writeDatabase(db);
}

export function deleteHeroSlide(id) {
	const db = readDatabase();
	db.heroSlides = db.heroSlides.filter((s) => s.id !== id);
	writeDatabase(db);
}

// Contact info operations
export function getContactInfo() {
	const db = readDatabase();
	return db.contact || defaultDatabase.contact;
}

export function saveContactInfo(contact) {
	const db = readDatabase();
	db.contact = contact;
	writeDatabase(db);
}

// Service times operations
export function getServiceTimes() {
	const db = readDatabase();
	return db.serviceTimes || defaultDatabase.serviceTimes;
}

export function saveServiceTimes(times) {
	const db = readDatabase();
	db.serviceTimes = times;
	writeDatabase(db);
}

// Settings operations
export function getSettings() {
	const db = readDatabase();
	return db.settings || defaultDatabase.settings;
}

export function saveSettings(settings) {
	const db = readDatabase();
	db.settings = { ...db.settings, ...settings };
	writeDatabase(db);
}

// CRUD operations for Images
export function getImages() {
	const db = readDatabase();
	return db.images || [];
}

export function getImage(id) {
	const db = readDatabase();
	return db.images.find((img) => img.id === id);
}

export function saveImage(image) {
	const db = readDatabase();
	const index = db.images.findIndex((img) => img.id === image.id);
	if (index >= 0) {
		db.images[index] = image;
	} else {
		db.images.push(image);
	}
	writeDatabase(db);
}

export function deleteImage(id) {
	const db = readDatabase();
	db.images = db.images.filter((img) => img.id !== id);
	writeDatabase(db);
}

// CRUD operations for Podcasts
export function getPodcasts() {
	const db = readDatabase();
	return (db.podcasts || []).sort((a, b) => {
		// Sort by published date, newest first
		return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
	});
}

export function getPodcast(id) {
	const db = readDatabase();
	return db.podcasts.find((p) => p.id === id);
}

export function savePodcast(podcast) {
	const db = readDatabase();
	const index = db.podcasts.findIndex((p) => p.id === podcast.id);
	if (index >= 0) {
		db.podcasts[index] = podcast;
	} else {
		// Generate GUID if not provided
		if (!podcast.guid) {
			podcast.guid = podcast.id;
		}
		db.podcasts.push(podcast);
	}
	writeDatabase(db);
}

export function deletePodcast(id) {
	const db = readDatabase();
	db.podcasts = db.podcasts.filter((p) => p.id !== id);
	writeDatabase(db);
}

// CRUD operations for Community Groups
export function getCommunityGroups() {
	const db = readDatabase();
	// DO NOT auto-write on read - this could overwrite production data
	// Only initialize in memory if missing
	if (!db.communityGroups) {
		db.communityGroups = [];
	}
	return db.communityGroups || [];
}

export function getCommunityGroup(id) {
	const db = readDatabase();
	return db.communityGroups?.find((g) => g.id === id);
}

export function saveCommunityGroup(group) {
	const db = readDatabase();
	if (!db.communityGroups) {
		db.communityGroups = [];
	}
	const index = db.communityGroups.findIndex((g) => g.id === group.id);
	if (index >= 0) {
		db.communityGroups[index] = group;
	} else {
		db.communityGroups.push(group);
	}
	writeDatabase(db);
}

export function deleteCommunityGroup(id) {
	const db = readDatabase();
	if (db.communityGroups) {
		db.communityGroups = db.communityGroups.filter((g) => g.id !== id);
		writeDatabase(db);
	}
}

// CRUD operations for Events
export function getEvents() {
	const db = readDatabase();
	// DO NOT auto-write on read - this could overwrite production data
	// Only initialize in memory if missing
	if (!db.events) {
		db.events = [];
	}
	return db.events || [];
}

export function getEvent(id) {
	const db = readDatabase();
	return db.events?.find((e) => e.id === id);
}

export function saveEvent(event) {
	const db = readDatabase();
	if (!db.events) {
		db.events = [];
	}
	const index = db.events.findIndex((e) => e.id === event.id);
	if (index >= 0) {
		db.events[index] = event;
	} else {
		db.events.push(event);
	}
	writeDatabase(db);
}

export function deleteEvent(id) {
	const db = readDatabase();
	if (db.events) {
		db.events = db.events.filter((e) => e.id !== id);
		writeDatabase(db);
	}
}

// Health check
export function checkDatabaseHealth() {
	const dbPath = getDbPath();
	const exists = existsSync(dbPath);
	const isAbsolute = dbPath.startsWith('/');

	return {
		path: dbPath,
		exists,
		isAbsolute,
		volumeMounted: isAbsolute && exists
	};
}
