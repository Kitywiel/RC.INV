# Setting Up Google Sheets on Render

## Required Environment Variables

You need to add these environment variables in your Render dashboard:

### 1. Go to your Render service
- Log in to https://dashboard.render.com
- Select your RC.INV service
- Go to "Environment" tab

### 2. Add Google Sheets Variables

Click "Add Environment Variable" for each of these:

#### USE_GOOGLE_SHEETS
- **Key**: `USE_GOOGLE_SHEETS`
- **Value**: `true`

#### GOOGLE_SPREADSHEET_ID
- **Key**: `GOOGLE_SPREADSHEET_ID`
- **Value**: `1-dQONQ2gHbBv2ZPLKXpaUmpXnlMMccRIeVfuh_1n1vo`

#### GOOGLE_PROJECT_ID
- **Key**: `GOOGLE_PROJECT_ID`
- **Value**: Get from your `.env` file (the value after `GOOGLE_PROJECT_ID=`)

#### GOOGLE_PRIVATE_KEY_ID
- **Key**: `GOOGLE_PRIVATE_KEY_ID`
- **Value**: Get from your `.env` file (the value after `GOOGLE_PRIVATE_KEY_ID=`)

#### GOOGLE_PRIVATE_KEY
- **Key**: `GOOGLE_PRIVATE_KEY`
- **Value**: Get from your `.env` file
- **IMPORTANT**: Copy the ENTIRE key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Make sure to keep all the `\n` characters (they represent newlines)

#### GOOGLE_CLIENT_EMAIL
- **Key**: `GOOGLE_CLIENT_EMAIL`
- **Value**: `rc-inv-service@rc-inv.iam.gserviceaccount.com`

#### GOOGLE_CLIENT_ID
- **Key**: `GOOGLE_CLIENT_ID`
- **Value**: Get from your `.env` file (the value after `GOOGLE_CLIENT_ID=`)

### 3. Save and Deploy

After adding all variables:
1. Click "Save Changes"
2. Render will automatically redeploy your service
3. Wait for the deployment to complete
4. Check the logs to verify connection to Google Sheets

### 4. Verify Setup

In your Render logs, you should see:
```
📊 Using Google Sheets as database
✓ Connected to Google Sheets
✓ Google Sheets connected
```

If you see errors, check that:
- All environment variables are set correctly
- The private key is complete with `\n` characters preserved
- The service account email matches exactly
- The spreadsheet is shared with the service account email

## Quick Copy Commands

To get the values from your local `.env` file:

```bash
# Get GOOGLE_PROJECT_ID
grep GOOGLE_PROJECT_ID .env

# Get GOOGLE_PRIVATE_KEY_ID
grep GOOGLE_PRIVATE_KEY_ID .env

# Get GOOGLE_PRIVATE_KEY (be careful with this one)
grep GOOGLE_PRIVATE_KEY= .env

# Get GOOGLE_CLIENT_ID
grep GOOGLE_CLIENT_ID .env
```

## Troubleshooting

### "No email service configured" warning
This is normal and won't affect Google Sheets functionality.

### "Cannot read properties of undefined"
Make sure all Google Sheets environment variables are set.

### "Failed to connect to Google Sheets"
- Verify the private key is complete
- Check that the service account has access to the spreadsheet
- Ensure the spreadsheet ID is correct
