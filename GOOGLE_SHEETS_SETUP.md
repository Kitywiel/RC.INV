# Google Sheets as Database - Setup Guide

## Overview
This guide shows you how to use Google Sheets as a database backend for RC.INV using Google Sheets API v4.

## Prerequisites
1. Google Account
2. Google Cloud Project
3. Service Account credentials
4. Google Sheets API enabled

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project"
3. Name it "RC-INV" and click "Create"
4. Wait for project creation to complete

## Step 2: Enable Google Sheets API

1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and click "Enable"
4. Also enable "Google Drive API" (needed for file access)

## Step 3: Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in details:
   - **Name**: RC-INV Service Account
   - **Service account ID**: rc-inv-service
   - **Description**: Service account for RC.INV inventory management
4. Click "Create and Continue"
5. Skip optional steps (Grant access, Grant users access)
6. Click "Done"

## Step 4: Create Service Account Key

1. Click on your new service account email
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose **JSON** format
5. Click "Create"
6. A JSON file will download - **KEEP THIS SAFE!**

## Step 5: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named "RC-INV Database"
3. Create 4 tabs with these exact names:
   - **USERS**
   - **INVENTORY**
   - **SETTINGS**
   - **GUESTS**

### Tab 1: USERS
Add these column headers in Row 1:
```
USER_NAME | PASSCODE | EMAIL | USER_ID | INV_USED | USER_UNLIMITED | CREATED | LAST_LOGGED_IN | STATUS
```

### Tab 2: INVENTORY
Add these column headers in Row 1:
```
USER_ID | DESCRIPTION | ITEM_NAME | CATEGORY | SKU | QUANTITY | USED_QUANTITY | UNIT | PRICE | TOTAL_VALUE | LOCATION | MINIMUM_QUANTITY | INV_NUMBER | DATE_ADDED | DATE_UPDATED | ACTIVE
```

### Tab 3: SETTINGS
Leave empty for now (future configuration storage)

### Tab 4: GUESTS
Add these column headers in Row 1:
```
USER_ID | GUEST_ID | GUEST_NAME | EMAIL | ADDED_DATE | ACTIVE
```

## Step 6: Share Sheet with Service Account

1. Copy the service account email from the JSON file (looks like: `rc-inv-service@project-id.iam.gserviceaccount.com`)
2. In your Google Sheet, click "Share"
3. Paste the service account email
4. Give it **Editor** access
5. Uncheck "Notify people"
6. Click "Share"

## Step 7: Get Your Spreadsheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/1ABC...XYZ/edit
                                      ^^^^^^^^^
                                      This is your SPREADSHEET_ID
```

Copy the long ID between `/d/` and `/edit`

## Step 8: Install Required Package

```bash
npm install googleapis
```

## Step 9: Configure Environment Variables

Add to your `.env` file:

```bash
# Google Sheets Database Configuration
USE_GOOGLE_SHEETS=true
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com

# Service Account Credentials (from JSON file)
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"
```

**Important for GOOGLE_PRIVATE_KEY:**
- Copy the entire "private_key" value from your JSON file
- Keep the quotes
- Keep the `\n` characters (they represent newlines)

## Step 10: Alternative - Use JSON File

Instead of environment variables, you can place the entire JSON file in your project:

```bash
# Place credentials file
mv ~/Downloads/rc-inv-service-account-xxxxx.json /workspaces/RC.INV/google-credentials.json

# Add to .env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here

# Add to .gitignore
echo "google-credentials.json" >> .gitignore
```

---

## Security Best Practices

### ⚠️ NEVER commit credentials to Git!

Add to `.gitignore`:
```
google-credentials.json
.env
*.pem
*.key
```

### Environment Variables on Render/Heroku

When deploying, add these environment variables in your hosting platform:
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (paste the full private key with \n characters)

---

## Testing Your Setup

Use the test script provided in `test-google-sheets.js`:

```bash
node test-google-sheets.js
```

You should see:
```
✓ Connected to Google Sheets
✓ Spreadsheet: RC-INV Database
✓ Tabs: USERS, INVENTORY, SETTINGS, GUESTS
✓ Sample data read successfully
```

---

## Advantages of Google Sheets

✅ **Real-time Collaboration**: Multiple users can view/edit simultaneously  
✅ **Visual Interface**: Easy to view and manually edit data  
✅ **No Database Server**: No need to manage PostgreSQL/MySQL  
✅ **Built-in Backup**: Google automatically saves versions  
✅ **Easy Export**: Download as Excel, CSV, PDF  
✅ **Free**: No hosting costs for the database  
✅ **Formulas**: Use spreadsheet formulas for calculations  

## Limitations

⚠️ **Performance**: Slower than traditional databases (1-2 second API calls)  
⚠️ **Rate Limits**: 100 requests per 100 seconds per user  
⚠️ **Scale**: Best for <10,000 rows  
⚠️ **Concurrency**: Limited concurrent write operations  
⚠️ **Queries**: No complex SQL queries available  

---

## Recommended Hybrid Approach

**Best Practice**: Use both SQLite and Google Sheets

1. **SQLite (Primary)**: Fast local operations
2. **Google Sheets (Sync)**: Periodic backup and cloud access

This gives you:
- ⚡ Fast local performance
- ☁️ Cloud backup and access
- 📊 Visual data management
- 🔄 Best of both worlds

---

## Need Help?

Common issues:
1. **"Permission denied"** - Make sure you shared the sheet with service account email
2. **"Invalid credentials"** - Check your private key has `\n` characters preserved
3. **"Spreadsheet not found"** - Verify your SPREADSHEET_ID is correct
4. **"API not enabled"** - Enable Google Sheets API and Google Drive API

---

## Next Steps

Once setup is complete:
1. Run `node test-google-sheets.js` to verify connection
2. The app will automatically use Google Sheets if `USE_GOOGLE_SHEETS=true`
3. You can switch back to SQLite by setting `USE_GOOGLE_SHEETS=false`

