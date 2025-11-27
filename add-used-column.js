const { google } = require('googleapis');
require('dotenv').config();

async function addUsedQuantityColumn() {
    console.log('🔧 Adding USED_QUANTITY column to INVENTORY tab...\n');

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // Read current headers
        const headersRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'INVENTORY!A1:P1'
        });

        console.log('Current headers:', headersRes.data.values ? headersRes.data.values[0] : 'None');

        // Insert USED_QUANTITY between QUANTITY (F) and UNIT (G)
        // This means inserting at column G (index 6)
        const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const inventorySheet = spreadsheetInfo.data.sheets.find(s => s.properties.title === 'INVENTORY');
        
        if (!inventorySheet) {
            console.error('❌ INVENTORY sheet not found');
            return;
        }

        const sheetId = inventorySheet.properties.sheetId;

        // Insert a new column at position 6 (after QUANTITY, before UNIT)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'COLUMNS',
                            startIndex: 6,
                            endIndex: 7
                        }
                    }
                }]
            }
        });

        console.log('✓ Inserted new column');

        // Set the header for the new column
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'INVENTORY!G1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['USED_QUANTITY']]
            }
        });

        console.log('✓ Added USED_QUANTITY header');

        // Set default value of 0 for all existing rows
        const dataRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'INVENTORY!A2:A1000'
        });

        if (dataRes.data.values && dataRes.data.values.length > 0) {
            const defaultValues = dataRes.data.values.map(() => ['0']);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `INVENTORY!G2:G${dataRes.data.values.length + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: defaultValues
                }
            });
            console.log(`✓ Set default value of 0 for ${dataRes.data.values.length} existing items`);
        }

        console.log('\n✅ Done! USED_QUANTITY column added successfully.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

addUsedQuantityColumn();
