#!/bin/bash

# Script to write database to Railway volume
# Usage: railway run < scripts/write-to-railway.sh

# Read the database content from stdin (base64 encoded)
base64 -d > /data/database.json

