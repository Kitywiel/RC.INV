const { google } = require('googleapis');
require('dotenv').config();

async function fixItemOwnership() {
    console.log('🔧 Updating item ownership...\n');

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // Get the admin user ID
        const usersRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'USERS!A1:L10'
        });

        const adminRow = usersRes.data.values.find(row => row[0] === 'admin');
        const adminId = adminRow ? adminRow[3] : null;

        console.log('Admin User ID:', adminId);

        // Update the inventory item to belong to admin
        if (adminId) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'INVENTORY!A2',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[adminId]]
                }
            });

            console.log('✓ Updated inventory item to belong to admin');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixItemOwnership();
