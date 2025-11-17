import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Restore database from git history to Railway volume
 */
async function restoreToRailway() {
	try {
		console.log('🔄 Restoring database from git history to Railway...\n');
		
		// Check if Railway CLI is available
		try {
			execSync('railway --version', { stdio: 'ignore' });
		} catch (error) {
			console.error('❌ Railway CLI not found!');
			console.error('   Please install Railway CLI: npm i -g @railway/cli');
			console.error('   Then run: railway login && railway link');
			process.exit(1);
		}
		
		// Restore database from git history (commit fc4b61b has the last good version)
		console.log('📖 Restoring database from git history (commit fc4b61b)...');
		const gitDb = execSync('git show fc4b61b:data/database.json', { 
			encoding: 'utf-8', 
			cwd: join(__dirname, '..') 
		});
		
		// Validate JSON
		try {
			JSON.parse(gitDb);
		} catch (error) {
			console.error('❌ Invalid JSON from git history!');
			process.exit(1);
		}
		
		// Save temporarily
		const tempPath = join(__dirname, '../data/database-restore.json');
		writeFileSync(tempPath, gitDb, 'utf-8');
		console.log('✅ Database restored from git history\n');
		
		// Copy to Railway volume
		console.log('📤 Copying database to Railway volume at /data/database.json...');
		try {
			// Read the file content
			const fileContent = readFileSync(tempPath, 'utf-8');
			
			// Write directly to Railway using echo/cat (Railway volumes should be writable)
			// Use base64 encoding to avoid shell escaping issues
			const base64Content = Buffer.from(fileContent).toString('base64');
			
			console.log('   Writing database file to Railway volume...');
			execSync(`railway run sh -c 'echo "${base64Content}" | base64 -d > /data/database.json'`, {
				cwd: join(__dirname, '..'),
				stdio: 'inherit'
			});
			
			// Clean up temp file
			try {
				execSync(`rm ${tempPath}`);
			} catch (e) {
				// Ignore cleanup errors
			}
			
			console.log('\n✅ Database successfully restored to Railway!');
			console.log('   The production database has been restored from git history.');
			console.log('   Your application should now be able to read the database.\n');
		} catch (error) {
			console.error('\n❌ Error copying to Railway:');
			console.error('   Make sure you are logged in: railway login');
			console.error('   Make sure the project is linked: railway link');
			console.error('   Make sure the volume is mounted at /data\n');
			
			console.log('💡 Alternative: You can manually upload the file:');
			console.log(`   1. The restored database is at: ${tempPath}`);
			console.log('   2. Go to Railway dashboard → Volume → Upload file\n');
			
			process.exit(1);
		}
		
	} catch (error) {
		console.error('❌ Error restoring database:', error);
		process.exit(1);
	}
}

// Run the restore
restoreToRailway();

