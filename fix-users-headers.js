/**
 * Fix USERS tab headers to include all required columns
 */

const { getInstance } = require('./server/google-sheets-db');

async function fixUsersHeaders() {
    console.log('🔧 Fixing USERS tab headers...\n');

    try {
        const db = await getInstance();
        
        // Read current USERS data
        const data = await db.read('USERS');
        console.log('Current headers:', data[0]);
        console.log('Current rows:', data.length - 1);
        
        // Correct headers with all 12 columns
        const newHeaders = [
            'USER_NAME',
            'PASSCODE',
            'EMAIL',
            'USER_ID',
            'INV_USED',
            'USER_UNLIMITID',
            'CREATED',
            'LAST_LOGGED_IN',
            'STATUS',
            'ROLE',
            'OWNER_ID',
            'ITEM_LIMIT'
        ];
        
        // Update header row
        await db.write('USERS', 'A1:L1', [newHeaders]);
        console.log('\n✓ Headers updated to:', newHeaders);
        
        // Update existing rows to include the missing columns
        if (data.length > 1) {
            console.log('\n⚠️  Updating existing user rows...');
            for (let i = 1; i < data.length; i++) {
                const oldRow = data[i];
                if (!oldRow[0]) continue; // Skip empty rows
                
                // Old format: 9 columns
                // New format: 12 columns (add ROLE, OWNER_ID, ITEM_LIMIT)
                const newRow = [
                    oldRow[0],  // USER_NAME
                    oldRow[1],  // PASSCODE
                    oldRow[2],  // EMAIL
                    oldRow[3],  // USER_ID
                    oldRow[4] || '0',  // INV_USED
                    oldRow[5] || 'FALSE',  // USER_UNLIMITID
                    oldRow[6],  // CREATED
                    oldRow[7] || '',  // LAST_LOGGED_IN
                    oldRow[8] || 'ACTIVE',  // STATUS
                    oldRow[9] || 'owner',  // ROLE (default to owner)
                    oldRow[10] || '',  // OWNER_ID
                    oldRow[11] || '20'  // ITEM_LIMIT (default to 20)
                ];
                await db.write('USERS', `A${i+1}:L${i+1}`, [newRow]);
                console.log(`  ✓ Updated user: ${oldRow[0]}`);
            }
        }
        
        console.log('\n✅ USERS tab structure fixed!');
        console.log('All users now have ROLE, OWNER_ID, and ITEM_LIMIT columns.');
        
    } catch (error) {
        console.error('\n❌ Failed to fix headers:', error);
        process.exit(1);
    }
}

fixUsersHeaders();
