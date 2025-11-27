const { google } = require('googleapis');
require('dotenv').config();

async function fixAdminRole() {
    console.log('🔧 Fixing admin role...\n');

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // Update admin user (row 2) to have 'admin' role in column J
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'USERS!J2',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['admin']]
            }
        });

        console.log('✓ Updated admin user role to "admin"');

        // Update other users to have 'user' role
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'USERS!J3:J5',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['user'], ['user'], ['user']]
            }
        });

        console.log('✓ Updated other users to "user" role');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixAdminRole();
