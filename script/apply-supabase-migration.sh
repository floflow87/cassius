#!/bin/bash
# Script to apply migrations to Supabase production database
# Usage: ./script/apply-supabase-migration.sh [migration_file]

set -e

# Check if SUPABASE_DATABASE_URL is set
if [ -z "$SUPABASE_DATABASE_URL" ]; then
    echo "Error: SUPABASE_DATABASE_URL environment variable is not set"
    echo "Set it with your production database connection string"
    exit 1
fi

# Default to all migrations in supabase/migrations if no specific file provided
MIGRATION_DIR="supabase/migrations"

if [ -n "$1" ]; then
    # Specific migration file provided
    MIGRATION_FILE="$1"
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo "Error: Migration file not found: $MIGRATION_FILE"
        exit 1
    fi
    echo "Applying migration: $MIGRATION_FILE"
    psql "$SUPABASE_DATABASE_URL" -f "$MIGRATION_FILE"
    echo "Migration applied successfully!"
else
    # Apply all migrations in order
    echo "Applying all migrations from $MIGRATION_DIR..."
    for file in $(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
        echo "Applying: $file"
        psql "$SUPABASE_DATABASE_URL" -f "$file"
    done
    echo "All migrations applied successfully!"
fi
