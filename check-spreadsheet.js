const { google } = require('googleapis');
require('dotenv').config();

async function checkSpreadsheet() {
    console.log('🔍 Checking Google Sheets data...\n');

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // Read USERS tab
        console.log('📋 USERS Tab:');
        const usersRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'USERS!A1:L10'
        });

        if (usersRes.data.values) {
            const headers = usersRes.data.values[0];
            console.log('Headers:', headers.join(' | '));
            console.log('');
            
            usersRes.data.values.slice(1).forEach((row, idx) => {
                console.log(`User ${idx + 1}:`);
                console.log(`  Username: ${row[0]}`);
                console.log(`  Email: ${row[2]}`);
                console.log(`  User ID: ${row[3]}`);
                console.log(`  Role: ${row[9]}`);
                console.log(`  Status: ${row[8]}`);
                console.log('');
            });
        }

        // Read INVENTORY tab
        console.log('\n📦 INVENTORY Tab (first 3 items):');
        const invRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'INVENTORY!A1:P4'
        });

        if (invRes.data.values) {
            const headers = invRes.data.values[0];
            console.log('Headers:', headers.join(' | '));
            console.log('');
            
            if (invRes.data.values.length > 1) {
                invRes.data.values.slice(1).forEach((row, idx) => {
                    console.log(`Item ${idx + 1}:`);
                    console.log(`  User ID: ${row[0]}`);
                    console.log(`  Name: ${row[2]}`);
                    console.log(`  Quantity: ${row[5]}`);
                    console.log(`  Used: ${row[6]}`);
                    console.log(`  Price: ${row[8]}`);
                    console.log(`  Total Value: ${row[9]}`);
                    console.log(`  Active: ${row[15]}`);
                    console.log('');
                });
            } else {
                console.log('  No inventory items');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSpreadsheet();
