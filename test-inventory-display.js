const axios = require('axios');

const BASE_URL = 'http://localhost:10000';

async function test() {
    console.log('🧪 Testing Inventory Display...\n');

    try {
        // Login
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        const token = loginRes.data.token;

        // Get inventory
        console.log('Getting inventory...');
        const invRes = await axios.get(`${BASE_URL}/api/inventory`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('\n📦 Inventory Items:');
        if (invRes.data.items && invRes.data.items.length > 0) {
            invRes.data.items.slice(0, 3).forEach(item => {
                console.log(`\nItem: ${item.name}`);
                console.log(`  ID: ${item.id}`);
                console.log(`  Quantity: ${item.quantity}`);
                console.log(`  Price: ${item.price}`);
                console.log(`  Unit: ${item.unit}`);
                console.log(`  Total Value: ${item.total_value}`);
            });
        } else {
            console.log('  No items found');
        }

        // Get stats
        console.log('\n\n📊 Statistics:');
        const statsRes = await axios.get(`${BASE_URL}/api/inventory/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (statsRes.data.stats) {
            console.log(`  Total Items: ${statsRes.data.stats.totalItems}`);
            console.log(`  Total Value: $${statsRes.data.stats.totalValue}`);
            console.log(`  Low Stock: ${statsRes.data.stats.lowStockItems}`);
            console.log(`  Categories: ${statsRes.data.stats.totalCategories}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

test();
