const axios = require('axios');

const BASE_URL = 'http://localhost:10000';
let authToken = '';
let testGuestId = '';

async function test() {
    console.log('🧪 Testing Guest Deletion...\n');

    try {
        // 1. Login as admin
        console.log('1️⃣  Logging in as admin...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        authToken = loginRes.data.token;
        console.log('   ✓ Logged in\n');

        // 2. Create a test guest
        console.log('2️⃣  Creating test guest...');
        const createRes = await axios.post(`${BASE_URL}/api/auth/create-guest`, {
            username: 'testguest_delete',
            email: 'testdelete@test.com',
            password: 'test123'
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        testGuestId = createRes.data.guestId;
        console.log(`   ✓ Created guest: ${testGuestId}\n`);

        // 3. Get all guests to verify it exists
        console.log('3️⃣  Verifying guest exists...');
        const getRes = await axios.get(`${BASE_URL}/api/auth/guests`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const guest = getRes.data.find(g => g.id === testGuestId);
        console.log(`   ✓ Guest found: ${guest ? guest.username : 'NOT FOUND'}\n`);

        // 4. Delete the guest
        console.log('4️⃣  Deleting guest...');
        try {
            const deleteRes = await axios.delete(`${BASE_URL}/api/auth/guest/${testGuestId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log(`   ✓ Delete successful: ${deleteRes.data.success}`);
        } catch (deleteErr) {
            console.log(`   ❌ Delete failed: ${deleteErr.response?.data?.error || deleteErr.message}`);
            console.log(`   Status: ${deleteErr.response?.status}`);
        }

        // 5. Verify deletion
        console.log('\n5️⃣  Verifying deletion...');
        const getRes2 = await axios.get(`${BASE_URL}/api/auth/guests`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const deletedGuest = getRes2.data.find(g => g.id === testGuestId);
        console.log(`   Guest still exists: ${deletedGuest ? 'YES (ERROR)' : 'NO (CORRECT)'}\n`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
    }

    console.log('✅ Test completed!');
}

test();
