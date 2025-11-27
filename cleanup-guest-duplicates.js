/**
 * Clean up duplicate guest entries from USERS tab
 * Guests should only be in GUESTS tab, not in USERS tab
 */

const { getInstance } = require('./server/google-sheets-db');

async function cleanupDuplicateGuests() {
    console.log('🧹 Cleaning up duplicate guest entries...\n');

    try {
        const db = await getInstance();
        
        // Read USERS tab
        const usersData = await db.read('USERS');
        if (usersData.length <= 1) {
            console.log('✓ USERS tab is empty, nothing to clean');
            return;
        }
        
        const headers = usersData[0];
        const roleIndex = headers.indexOf('ROLE');
        
        if (roleIndex === -1) {
            console.log('⚠️  ROLE column not found in USERS tab');
            return;
        }
        
        // Find rows where ROLE = 'guest'
        const guestRows = [];
        usersData.slice(1).forEach((row, index) => {
            if (row[roleIndex] === 'guest') {
                guestRows.push({
                    rowNumber: index + 2, // +2 for header and 1-indexing
                    username: row[0],
                    userId: row[3]
                });
            }
        });
        
        if (guestRows.length === 0) {
            console.log('✓ No guest entries found in USERS tab');
            return;
        }
        
        console.log(`Found ${guestRows.length} guest entries in USERS tab:`);
        guestRows.forEach(g => {
            console.log(`  - Row ${g.rowNumber}: ${g.username} (${g.userId})`);
        });
        
        // Delete these rows by marking them as empty
        console.log('\n🗑️  Removing guest entries from USERS tab...');
        for (const guest of guestRows.reverse()) { // Reverse to delete from bottom up
            // Clear the entire row
            await db.clear('USERS', `A${guest.rowNumber}:L${guest.rowNumber}`);
            console.log(`  ✓ Removed row ${guest.rowNumber}: ${guest.username}`);
        }
        
        console.log('\n✅ Cleanup complete!');
        console.log('💡 Guests are now only in GUESTS tab');
        
    } catch (error) {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupDuplicateGuests();
