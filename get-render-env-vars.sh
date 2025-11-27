#!/bin/bash

# Extract Google Sheets environment variables for Render
# This script reads your google-credentials.json and shows you what to add to Render

echo "=== Google Sheets Environment Variables for Render ==="
echo ""
echo "Copy these values to your Render dashboard:"
echo ""

if [ ! -f google-credentials.json ]; then
    echo "❌ Error: google-credentials.json not found!"
    exit 1
fi

echo "1. USE_GOOGLE_SHEETS"
echo "   Value: true"
echo ""

echo "2. GOOGLE_SPREADSHEET_ID"
grep GOOGLE_SPREADSHEET_ID .env | cut -d= -f2
echo ""

echo "3. GOOGLE_SERVICE_ACCOUNT_EMAIL"
echo "   Value: $(cat google-credentials.json | grep client_email | cut -d'"' -f4)"
echo ""

echo "4. GOOGLE_PRIVATE_KEY"
echo "   ⚠️  IMPORTANT: Copy the entire private_key value from google-credentials.json"
echo "   It should start with: -----BEGIN PRIVATE KEY-----"
echo "   And end with: -----END PRIVATE KEY-----"
echo "   Keep all the \\n characters in the string!"
echo ""
echo "   Private key preview (first 50 chars):"
cat google-credentials.json | grep private_key | cut -d'"' -f4 | head -c 50
echo "..."
echo ""

echo "✅ After adding these to Render, save and it will auto-redeploy"
echo "✅ Check the logs for: '✓ Connected to Google Sheets'"
