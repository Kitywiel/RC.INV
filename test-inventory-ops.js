const axios = require('axios');

const BASE_URL = 'http://localhost:10000';
let authToken = '';
let testItemId = '';

async function test() {
    console.log('🧪 Testing Inventory Operations...\n');

    try {
        // 1. Login
        console.log('1️⃣  Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        authToken = loginRes.data.token;
        console.log('   ✓ Logged in\n');

        // 2. Create a test item
        console.log('2️⃣  Creating test item...');
        const createRes = await axios.post(`${BASE_URL}/api/inventory`, {
            name: 'Test Item for Ops',
            description: 'Testing edit and delete',
            category: 'Test',
            quantity: 10,
            price: 5.99
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        testItemId = createRes.data.itemId;
        console.log(`   ✓ Created item: ${testItemId}\n`);

        // 3. Get all inventory to find the item
        console.log('3️⃣  Getting inventory...');
        const getRes = await axios.get(`${BASE_URL}/api/inventory`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const items = getRes.data.items || getRes.data;
        const item = items.find(i => i.id === testItemId);
        console.log(`   ✓ Found item: ${item ? item.name : 'NOT FOUND'}`);
        console.log(`   ✓ Item ID: ${item ? item.id : 'N/A'}\n`);

        // 4. Try to update the item
        console.log('4️⃣  Updating item...');
        try {
            const updateRes = await axios.put(`${BASE_URL}/api/inventory/${testItemId}`, {
                name: 'Updated Test Item',
                quantity: 20
            }, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log(`   ✓ Update successful: ${updateRes.data.success}`);
        } catch (updateErr) {
            console.log(`   ❌ Update failed: ${updateErr.response?.data?.error || updateErr.message}`);
        }

        // 5. Verify update
        console.log('\n5️⃣  Verifying update...');
        const getRes2 = await axios.get(`${BASE_URL}/api/inventory`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const items2 = getRes2.data.items || getRes2.data;
        const updatedItem = items2.find(i => i.id === testItemId);
        console.log(`   Item name: ${updatedItem ? updatedItem.name : 'NOT FOUND'}`);
        console.log(`   Item quantity: ${updatedItem ? updatedItem.quantity : 'N/A'}\n`);

        // 6. Try to delete the item
        console.log('6️⃣  Deleting item...');
        try {
            const deleteRes = await axios.delete(`${BASE_URL}/api/inventory/${testItemId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log(`   ✓ Delete successful: ${deleteRes.data.success}`);
        } catch (deleteErr) {
            console.log(`   ❌ Delete failed: ${deleteErr.response?.data?.error || deleteErr.message}`);
        }

        // 7. Verify deletion
        console.log('\n7️⃣  Verifying deletion...');
        const getRes3 = await axios.get(`${BASE_URL}/api/inventory`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const items3 = getRes3.data.items || getRes3.data;
        const deletedItem = items3.find(i => i.id === testItemId);
        console.log(`   Item still exists: ${deletedItem ? 'YES (ERROR)' : 'NO (CORRECT)'}\n`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
    }

    console.log('✅ All tests completed!');
}

test();
