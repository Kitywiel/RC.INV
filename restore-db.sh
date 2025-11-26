#!/bin/bash
# Restore database from backup

BACKUP_DIR="/workspaces/.codespaces/.persistedshare/rc-inv-backup"
DB_FILE="user_info/users.db"
BACKUP_FILE="$BACKUP_DIR/users.db.backup"

# Check if backup exists
if [ -f "$BACKUP_FILE" ]; then
    # Create user_info directory if it doesn't exist
    mkdir -p user_info
    
    # Restore backup
    cp "$BACKUP_FILE" "$DB_FILE"
    echo "✓ Database restored from backup"
    echo "✓ Your accounts and data have been recovered!"
else
    echo "⚠ No backup found at $BACKUP_FILE"
    echo "  Run './backup-db.sh' to create a backup first"
fi
