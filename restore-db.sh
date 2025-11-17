#!/bin/bash
# Database restore script for Railway
# This creates the database file from the git history

# Create /data directory if it doesn't exist (should be mounted by volume)
mkdir -p /data

# Restore database from git history
git show fc4b61b:data/database.json > /data/database.json

# Verify it was created
if [ -f /data/database.json ]; then
    echo "✅ Database restored successfully to /data/database.json"
    ls -lh /data/database.json
else
    echo "❌ Failed to restore database"
    exit 1
fi

