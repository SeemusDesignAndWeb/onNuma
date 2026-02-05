# Railway `/data` Store: Data Migration and Protection Strategy

This document explains how the EGCC website uses Railway's persistent volume storage at `/data` to manage the database, how data is migrated from local development to production for the first time, and how the system prevents overwriting production data during subsequent deployments.

## Overview

The website uses a JSON file-based database that is stored in different locations depending on the environment:
- **Local Development**: `./data/database.json` (relative path in project directory)
- **Production (Railway)**: `/data/database.json` (absolute path on Railway volume)

The Railway volume mounted at `/data` provides persistent storage that survives deployments, container restarts, and code updates.

## Railway Volume Configuration

### Volume Setup

1. **Volume Creation**: A Railway volume named `data-storage` is created in the Railway dashboard
2. **Mount Path**: The volume is mounted at `/data` (must be exactly `/data`)
3. **Persistence**: Data stored in `/data` persists across all deployments and container restarts
4. **Environment Variable**: `DATABASE_PATH` is set to `/data/database.json` in production

### How the Application Detects Environment

The database module (`src/lib/server/database.js`) uses the `DATABASE_PATH` environment variable to determine where to read/write data:

```javascript
const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

function getDbPath() {
  let finalPath;
  if (DB_PATH.startsWith('./') || DB_PATH.startsWith('../')) {
    // Relative path - local development
    finalPath = join(process.cwd(), DB_PATH);
  } else {
    // Absolute path - production (Railway volume)
    finalPath = DB_PATH;
  }
  return finalPath;
}
```

- **Local**: `DATABASE_PATH=./data/database.json` (or not set, defaults to relative path)
- **Production**: `DATABASE_PATH=/data/database.json` (absolute path pointing to volume)

## Initial Data Migration: Local to Production

When deploying for the first time, the production volume is empty. Several methods are available to migrate local data to the Railway volume:

### Method 1: Using `sync-database-to-production.js`

This script copies the local database file directly to the Railway volume:

```bash
node scripts/sync-database-to-production.js
```

**How it works:**
1. Reads local database from `./data/database.json`
2. Validates the JSON structure
3. Uses Railway CLI to copy the file to `/data/database.json` on the volume
4. Requires Railway CLI to be installed and authenticated (`railway login` and `railway link`)

### Method 2: Using `write-db-to-railway.js`

This script runs **inside** the Railway container to write data to the volume:

```bash
railway run --service EGCCNewWebsite node scripts/write-db-to-railway.js
```

**How it works:**
1. Reads from `data/database-restore.json` (must be prepared locally first)
2. Writes directly to `/data/database.json` on the mounted volume
3. Verifies the write was successful
4. Must be run via `railway run` to execute inside the container where the volume is mounted

### Method 3: Using `restore-to-railway.js`

This script restores data from git history to the Railway volume:

```bash
node scripts/restore-to-railway.js
```

**How it works:**
1. Extracts database from git commit `fc4b61b` (last known good version)
2. Saves temporarily to `data/database-restore.json`
3. Uses Railway CLI with base64 encoding to write to `/data/database.json`
4. Useful for recovering from data loss or initializing from a known good state

### Method 4: Using the Init-Database API Endpoint

The API endpoint at `/api/init-database` can initialize the database via HTTP:

```bash
curl -X POST https://new.egcc.co.uk/api/init-database \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d @data/database.json
```

**How it works:**
1. Requires admin password authentication
2. **Checks if database already exists** - if it does, returns an error without overwriting
3. Only writes if the database file doesn't exist
4. Accepts database content in request body

### Method 5: Using `init-production-db.js`

A script that calls the init-database API endpoint:

```bash
node scripts/init-production-db.js
```

**How it works:**
1. Reads from `data/database-restore.json`
2. Sends POST request to `/api/init-database` endpoint
3. Protected by admin password
4. Only initializes if database doesn't exist

## Protection Against Overwriting Production Data

The system has multiple safeguards to prevent accidental overwriting of production data:

### 1. Production Mode Detection

The `readDatabase()` function in `src/lib/server/database.js` detects production mode and **never auto-initializes** in production:

```javascript
export function readDatabase() {
  const dbPath = getDbPath();
  try {
    const data = readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production' || dbPath.startsWith('/');
    
    if (isProduction) {
      // In production, database MUST exist - throw error instead of creating
      throw new Error(`Database file not found at ${dbPath}. 
        Please ensure the Railway volume is mounted and the database file exists.`);
    }
    
    // Only auto-initialize in development
    // ... creates default database only in dev mode
  }
}
```

**Key Protection**: If the database file doesn't exist in production (detected by absolute path starting with `/`), the application **throws an error** instead of creating a new empty database. This prevents accidental data loss.

### 2. Init-Database Endpoint Safety Check

The `/api/init-database` endpoint explicitly checks if the database exists before writing:

```javascript
if (existsSync(DB_PATH)) {
  return json({ 
    message: 'Database already exists',
    path: DB_PATH,
    exists: true
  });
}
```

**Key Protection**: The endpoint refuses to initialize if a database already exists, preventing overwrites.

### 3. No Automatic Initialization Scripts

The initialization scripts (`init-database.js`, `init-production-db.js`) are **one-time use only**:
- They check if database exists before writing
- They are meant to be run manually, not as part of deployment
- They require explicit authentication (admin password)

### 4. Read-Only Operations Don't Modify Data

Many database read operations are designed to be safe:

```javascript
// Example: getActivities() doesn't auto-write
export function getActivities() {
  const db = readDatabase();
  // DO NOT auto-write on read - this could overwrite production data
  // Only initialize in memory if missing
  if (!db.activities) {
    db.activities = [];
  }
  return db.activities || [];
}
```

**Key Protection**: Read operations that encounter missing fields only initialize them **in memory** for that request, but don't write to disk unless explicitly saved via a write operation.

### 5. Explicit Write Operations Only

All data modifications require explicit write operations:
- `savePage()`, `saveTeamMember()`, `savePodcast()`, etc. all call `writeDatabase()`
- Admin interface changes go through authenticated API endpoints
- No automatic background writes that could overwrite data

## Data Flow During Normal Operations

### Local Development
1. Application reads/writes to `./data/database.json`
2. If file doesn't exist, auto-creates with default structure
3. All changes persist locally

### Production (Railway)
1. Application reads/writes to `/data/database.json` (on volume)
2. If file doesn't exist, **application fails** (doesn't auto-create)
3. All changes persist on the Railway volume
4. Volume persists across deployments

### Deployment Process
1. Code is built and deployed to Railway
2. Container starts with volume mounted at `/data`
3. Application reads from `/data/database.json` (existing data from previous deployments)
4. **No data is overwritten** - existing database continues to be used
5. New code can read and write to the same persistent database

## Best Practices

### Initial Setup
1. **First Deployment**: Use one of the migration scripts to populate `/data/database.json`
2. **Verify**: Check that database exists and is readable
3. **Test**: Make a small change via admin interface to verify writes work

### Ongoing Maintenance
1. **Never** run initialization scripts after first setup
2. **Always** backup production database before major changes
3. **Use** admin interface for all data modifications
4. **Monitor** Railway logs for database errors

### Backup Strategy
- Railway volumes can be backed up using Railway CLI
- Database can be exported via admin interface
- Git history can serve as backup (if database was committed at some point)

## Troubleshooting

### Database Not Found in Production
- **Symptom**: Application fails to start with "Database file not found"
- **Cause**: Volume not mounted or database file missing
- **Solution**: Run one of the initialization scripts to create the database

### Data Not Persisting
- **Symptom**: Changes disappear after deployment
- **Cause**: Writing to wrong path or volume not mounted
- **Solution**: Verify `DATABASE_PATH=/data/database.json` and volume is attached

### Accidental Overwrite Prevention
- **Symptom**: Want to restore data but afraid of overwriting
- **Solution**: The system is designed to prevent this - init scripts check for existing database first

## Summary

The Railway `/data` volume provides persistent storage that:
- ✅ Survives deployments and container restarts
- ✅ Is initialized once from local data using migration scripts
- ✅ Is protected from accidental overwrites through multiple safeguards
- ✅ Only allows writes through explicit, authenticated operations
- ✅ Fails safely in production if database is missing (doesn't auto-create empty database)

This architecture ensures that production data is safe while allowing seamless code deployments without data loss.




