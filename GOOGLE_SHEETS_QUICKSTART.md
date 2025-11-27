# Google Sheets Quick Start Guide

## 5-Minute Setup

### Step 1: Install Package (30 seconds)
```bash
npm install googleapis
```

### Step 2: Create Google Sheet (2 minutes)
1. Go to [sheets.google.com](https://sheets.google.com)
2. Create new spreadsheet: "RC-INV Database"
3. Create 4 tabs: `USERS`, `INVENTORY`, `SETTINGS`, `GUESTS`
4. Copy headers from `SPREADSHEET_SETTINGS.md` into each tab

### Step 3: Enable API & Create Service Account (2 minutes)
1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "RC-INV"
3. Enable "Google Sheets API"
4. Create Service Account → Download JSON key
5. Copy service account email (from JSON)

### Step 4: Share Sheet (10 seconds)
1. Open your Google Sheet
2. Click "Share"
3. Paste service account email
4. Give "Editor" access
5. Click "Share"

### Step 5: Configure App (1 minute)
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add:
USE_GOOGLE_SHEETS=true
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_from_url
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Place your downloaded JSON file
mv ~/Downloads/your-service-account-key.json ./google-credentials.json
```

### Step 6: Test Connection (10 seconds)
```bash
node test-google-sheets.js
```

You should see:
```
✅ All tests passed!
📝 Your Google Sheets database is ready to use.
```

### Step 7: Start Server
```bash
npm start
```

## Done! 🎉

Your inventory app now uses Google Sheets as the database!

---

## Switch Back to SQLite

Just change in `.env`:
```bash
USE_GOOGLE_SHEETS=false
```

---

## View Your Data Live

Open your Google Sheet in browser - you'll see data populate as users interact with your app!

---

## Benefits

✅ **See your data visually** in Google Sheets  
✅ **No database server needed** - Google handles it  
✅ **Free forever** - No hosting costs  
✅ **Automatic backups** - Google saves versions  
✅ **Easy to export** - Download as Excel/CSV anytime  
✅ **Collaborate** - Multiple admins can view the sheet  

---

## Need Help?

Check `GOOGLE_SHEETS_SETUP.md` for detailed troubleshooting and advanced configuration.
