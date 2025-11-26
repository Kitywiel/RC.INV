# Database Backup & Restore

Your database resets after rebuilds because codespaces don't persist the `user_info/` folder.

## Solution: Backup & Restore Scripts

### Create a Backup (do this before rebuilding):
```bash
./backup-db.sh
```
This saves your database to a persistent location that survives rebuilds.

### Restore After Rebuild:
```bash
./restore-db.sh
```
This brings back all your accounts and data.

### Automatic Backup
Add this to your workflow - run `./backup-db.sh` whenever you:
- Create new accounts
- Add important inventory data
- Before closing/rebuilding the codespace

The backup is stored in `/workspaces/.codespaces/.persistedshare/` which persists across rebuilds.
