require('dotenv').config();
const { google } = require('googleapis');

const spreadsheetId = '1-dQONQ2gHbBv2ZPLKXpaUmpXnlMMccRIeVfuh_1n1vo';

async function restoreItemOwner() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                type: 'service_account',
                project_id: process.env.GOOGLE_PROJECT_ID,
                private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                client_id: process.env.GOOGLE_CLIENT_ID,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Get the kitywiel user ID
        const usersRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'USERS!A:L',
        });

        const kityUser = usersRes.data.values.find(row => row[0] === 'kitywiel');
        const kityUserId = kityUser ? kityUser[3] : null;

        console.log('Kitywiel User ID:', kityUserId);

        if (!kityUserId) {
            console.error('✗ Could not find kitywiel user');
            return;
        }

        // Update the inventory item back to kitywiel
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'INVENTORY!A2',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[kityUserId]]
            }
        });

        console.log('✓ Restored inventory item to kitywiel account');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

restoreItemOwner();
