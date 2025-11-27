const { getInstance } = require('./server/google-sheets-db');

/**
 * Test script for Google Sheets database connection
 */
async function testConnection() {
    console.log('🧪 Testing Google Sheets Database Connection...\n');

    try {
        // Get database instance
        console.log('1️⃣  Connecting to Google Sheets...');
        const db = await getInstance();
        console.log('   ✓ Connected successfully\n');

        // Get spreadsheet info
        console.log('2️⃣  Fetching spreadsheet information...');
        const info = await db.getSpreadsheetInfo();
        console.log(`   ✓ Spreadsheet: ${info.properties.title}`);
        console.log(`   ✓ Tabs: ${info.sheets.map(s => s.properties.title).join(', ')}\n`);

        // Test reading users
        console.log('3️⃣  Reading USERS tab...');
        const users = await db.getUsers();
        console.log(`   ✓ Found ${users.length} user(s)\n`);

        // Test reading inventory
        console.log('4️⃣  Reading INVENTORY tab...');
        const data = await db.read(db.TABS.INVENTORY, 'A1:O1');
        if (data.length > 0) {
            console.log(`   ✓ Headers: ${data[0].join(', ')}\n`);
        }

        // Test reading guests
        console.log('5️⃣  Reading GUESTS tab...');
        const guestData = await db.read(db.TABS.GUESTS, 'A1:F1');
        if (guestData.length > 0) {
            console.log(`   ✓ Headers: ${guestData[0].join(', ')}\n`);
        }

        console.log('✅ All tests passed!\n');
        console.log('📝 Your Google Sheets database is ready to use.');
        console.log('   To enable it, set: USE_GOOGLE_SHEETS=true in .env\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\n📋 Troubleshooting:');
        console.error('   1. Check GOOGLE_SPREADSHEET_ID is correct');
        console.error('   2. Verify service account has Editor access to the sheet');
        console.error('   3. Ensure Google Sheets API is enabled in Cloud Console');
        console.error('   4. Confirm credentials are properly configured\n');
        console.error('   Full error:', error);
        process.exit(1);
    }
}

// Add example usage
async function exampleUsage() {
    console.log('\n📚 Example Usage:\n');
    console.log('const { getInstance } = require(\'./server/google-sheets-db\');\n');
    console.log('// Get database instance');
    console.log('const db = await getInstance();\n');
    console.log('// Read users');
    console.log('const users = await db.getUsers();\n');
    console.log('// Get user inventory');
    console.log('const items = await db.getInventoryByUserId(userId);\n');
    console.log('// Add new item');
    console.log('await db.addInventoryItem(userId, itemData);\n');
    console.log('// Get stats');
    console.log('const stats = await db.getInventoryStats(userId);\n');
}

// Run tests
if (require.main === module) {
    testConnection()
        .then(() => exampleUsage())
        .catch(err => {
            console.error('Unexpected error:', err);
            process.exit(1);
        });
}

module.exports = { testConnection };
