/**
 * Fix GUESTS tab to include PASSCODE column
 */

const { getInstance } = require('./server/google-sheets-db');

async function fixGuestsHeaders() {
    console.log('🔧 Fixing GUESTS tab headers...\n');

    try {
        const db = await getInstance();
        
        // Read current GUESTS data
        const data = await db.read('GUESTS');
        console.log('Current headers:', data[0]);
        console.log('Current rows:', data.length - 1);
        
        // Check if PASSCODE already exists
        if (data[0].includes('PASSCODE')) {
            console.log('\n✓ PASSCODE column already exists!');
            return;
        }
        
        // New headers with PASSCODE
        const newHeaders = [
            'USER_ID',
            'GUEST_ID', 
            'GUEST_NAME',
            'EMAIL',
            'PASSCODE',
            'ADDED_DATE',
            'ACTIVE'
        ];
        
        // Update header row
        await db.write('GUESTS', 'A1:G1', [newHeaders]);
        
        // If there are existing guest rows, we need to shift data
        if (data.length > 1) {
            console.log('\n⚠️  Found existing guest data. Updating rows...');
            for (let i = 1; i < data.length; i++) {
                const oldRow = data[i];
                // Old format: USER_ID, GUEST_ID, GUEST_NAME, EMAIL, ADDED_DATE, ACTIVE
                // New format: USER_ID, GUEST_ID, GUEST_NAME, EMAIL, PASSCODE, ADDED_DATE, ACTIVE
                const newRow = [
                    oldRow[0], // USER_ID
                    oldRow[1], // GUEST_ID
                    oldRow[2], // GUEST_NAME
                    oldRow[3], // EMAIL
                    '',        // PASSCODE (empty - needs to be set)
                    oldRow[4], // ADDED_DATE
                    oldRow[5]  // ACTIVE
                ];
                await db.write('GUESTS', `A${i+1}:G${i+1}`, [newRow]);
            }
        }
        
        console.log('\n✅ GUESTS tab headers fixed!');
        console.log('New headers:', newHeaders);
        console.log('\n💡 Note: Existing guests will need their passwords reset.');
        
    } catch (error) {
        console.error('\n❌ Failed to fix headers:', error);
        process.exit(1);
    }
}

fixGuestsHeaders();
