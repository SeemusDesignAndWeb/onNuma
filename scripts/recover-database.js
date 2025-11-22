import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔄 Recovering database from git history...\n');

try {
	// Try to get the database from the commit before it was removed
	const dbPath = process.env.DATABASE_PATH || './data/database.json';
	const gitDb = execSync('git show ca6813b:data/database.json', { encoding: 'utf-8', cwd: join(__dirname, '..') });
	
	// Write recovered database
	writeFileSync(dbPath, gitDb, 'utf-8');
	console.log(`✅ Database recovered to: ${dbPath}`);
	console.log('📋 Now run: npm run sync-cloudinary-images\n');
} catch (error) {
	console.error('❌ Error recovering database:', error.message);
	console.log('\n💡 You can manually recover by running:');
	console.log('   git show ca6813b:data/database.json > data/database.json\n');
	process.exit(1);
}





