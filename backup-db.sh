#!/bin/bash
# Backup database to a persistent location

BACKUP_DIR="/workspaces/.codespaces/.persistedshare/rc-inv-backup"
DB_FILE="user_info/users.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Copy database to backup location
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/users.db.backup"
    echo "✓ Database backed up to $BACKUP_DIR/users.db.backup"
else
    echo "⚠ Database file not found: $DB_FILE"
fi
