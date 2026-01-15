# Cleanup Orphaned Rota Data

This script finds and removes disassociated/orphaned data in rotas that can cause issues in emails and other parts of the system.

## What It Checks

The script identifies:
- **Invalid eventId**: Rotas referencing events that no longer exist
- **Invalid occurrenceId**: Rotas or assignees referencing occurrences that no longer exist
- **Invalid contactId**: Assignees referencing contacts that no longer exist
- **Invalid ownerId**: Rotas with owners that no longer exist
- **Mismatched occurrences**: Assignees with occurrenceIds that don't belong to the rota's event

## Usage

### Local Development

```bash
# Dry run (recommended first) - only reports issues
node scripts/cleanup-orphaned-rota-data.js

# Or explicitly
node scripts/cleanup-orphaned-rota-data.js --dry-run

# Actually remove orphaned data
node scripts/cleanup-orphaned-rota-data.js --remove
```

### Production (Railway)

1. **SSH into your Railway service**:
   ```bash
   railway run bash
   ```

2. **Run the script in dry-run mode first**:
   ```bash
   node scripts/cleanup-orphaned-rota-data.js --dry-run
   ```

3. **Review the output** to see what will be cleaned

4. **Run with --remove to actually clean**:
   ```bash
   node scripts/cleanup-orphaned-rota-data.js --remove
   ```

### Alternative: Via Railway CLI

If you have Railway CLI set up:

```bash
# Dry run
railway run node scripts/cleanup-orphaned-rota-data.js --dry-run

# Remove orphaned data
railway run node scripts/cleanup-orphaned-rota-data.js --remove
```

## Example Output

```
🔍 DRY RUN MODE - No changes will be made

🔍 Scanning for orphaned rota data...

Data directory: /data

Loaded 7 rotas, 1 events, 15 occurrences, 57 contacts

📊 Summary:

Total rotas checked: 7
Rotas with issues: 2
Total issues found: 2
Assignees to be removed: 1
Rotas to be updated: 1

📋 Detailed Issues:

Rota: "Welcome team" (01KE7H48JM5Q8M3DFR3XTKCWS0)
  ❌ invalid_ownerId: Rota "Welcome team" (01KE7H48JM5Q8M3DFR3XTKCWS0) references non-existent ownerId: 01KE7A55GXCERW2GPE5VNCGWWT

Rota: "Hospitality (drinks)" (01KE7H7EWTDQN6S5M7Y8FJXDGR)
  ❌ invalid_assignee: Rota "Hospitality (drinks)" (01KE7H7EWTDQN6S5M7Y8FJXDGR) has invalid assignee: contactId: 01KE7A55GXCERW2GPE5VNCGWWT - Contact ID 01KE7A55GXCERW2GPE5VNCGWWT does not exist

💡 This was a dry run. Use --remove to actually clean the data.
```

## What Gets Cleaned

When you run with `--remove`, the script will:

1. **Remove invalid assignees** from rota assignee arrays
2. **Clear invalid ownerIds** (set to null)
3. **Keep rotas with invalid eventIds** (these need manual review as they may need to be deleted entirely)

## Important Notes

- **Always run in dry-run mode first** to see what will be changed
- The script **does not delete rotas** with invalid eventIds - these need manual review
- **Backup your data** before running with `--remove` in production
- The script validates that occurrenceIds belong to the correct event
- Public signups (assignees with email/name objects) are preserved as long as they have valid occurrenceIds

## Troubleshooting

### Script can't find data directory

Make sure `CRM_DATA_DIR` environment variable is set correctly, or the script will default to `./data` relative to where you run it.

### Permission errors

Make sure the script has write permissions to the data directory:
```bash
chmod +x scripts/cleanup-orphaned-rota-data.js
```

## Related Issues

This script addresses issues where:
- Emails show "Unknown Contact" for assignees
- Rota update notifications reference deleted contacts
- Rotas appear broken in the UI due to missing references
