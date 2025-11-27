/**
 * Test all three fixes:
 * 1. Guest accounts show up in /api/auth/guests
 * 2. User limits show properly in /api/auth/limits
 * 3. Guests only in GUESTS tab, not duplicated in USERS
 */

const http = require('http');

function apiCall(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 10000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Google Sheets Integration...\n');

    try {
        // Test 1: Login as owner and get user limits
        console.log('1️⃣  Testing user limits...');
        const loginResult = await apiCall('/api/auth/login', 'POST', {
            username: 'admin',
            password: 'admin123'
        });

        if (!loginResult.data.success) {
            console.log('   ❌ Login failed:', loginResult.data.error);
            return;
        }

        const token = loginResult.data.token;
        console.log('   ✓ Logged in as:', loginResult.data.user.username);

        // Check limits
        const limitsResult = await apiCall('/api/auth/limits', 'GET', null, token);
        console.log('   ✓ Item limit:', limitsResult.data.itemLimit);
        console.log('   ✓ Has unlimited:', limitsResult.data.hasUnlimited);
        console.log('   ✓ Current count:', limitsResult.data.currentCount);
        console.log('   ✓ Remaining:', limitsResult.data.remaining);

        // Test 2: Get guest accounts
        console.log('\n2️⃣  Testing guest account retrieval...');
        const guestsResult = await apiCall('/api/auth/guests', 'GET', null, token);
        
        if (guestsResult.data.guests) {
            console.log('   ✓ Guests found:', guestsResult.data.guests.length);
            guestsResult.data.guests.forEach(guest => {
                console.log(`     - ${guest.username} (${guest.email})`);
            });
        } else {
            console.log('   ⚠️  No guests found');
        }

        // Test 3: Create a new guest
        console.log('\n3️⃣  Testing guest creation (should only go to GUESTS tab)...');
        const newGuestResult = await apiCall('/api/auth/create-guest', 'POST', {
            username: 'testguest',
            email: 'testguest@test.com',
            password: 'password123'
        }, token);

        if (newGuestResult.data.success) {
            console.log('   ✓ Guest created:', newGuestResult.data.guestId);
            
            // Verify it's in GUESTS tab only
            const { getInstance } = require('./server/google-sheets-db');
            const db = await getInstance();
            
            const usersData = await db.read('USERS');
            const hasGuestInUsers = usersData.slice(1).some(row => row[9] === 'guest');
            
            const guestsData = await db.read('GUESTS');
            const hasGuestInGuests = guestsData.slice(1).some(row => row[2] === 'testguest');
            
            if (hasGuestInUsers) {
                console.log('   ❌ Guest found in USERS tab (should not be there!)');
            } else {
                console.log('   ✓ Guest NOT in USERS tab (correct!)');
            }
            
            if (hasGuestInGuests) {
                console.log('   ✓ Guest found in GUESTS tab (correct!)');
            } else {
                console.log('   ❌ Guest NOT in GUESTS tab (should be there!)');
            }
        } else {
            console.log('   ❌ Guest creation failed:', newGuestResult.data.error);
        }

        // Test 4: Login as guest
        console.log('\n4️⃣  Testing guest login...');
        const guestLoginResult = await apiCall('/api/auth/login', 'POST', {
            username: 'testguest',
            password: 'password123'
        });

        if (guestLoginResult.data.success) {
            console.log('   ✓ Guest logged in successfully');
            console.log('   ✓ Role:', guestLoginResult.data.user.role);
            console.log('   ✓ Owner ID:', guestLoginResult.data.user.owner_id);
        } else {
            console.log('   ❌ Guest login failed:', guestLoginResult.data.error);
        }

        console.log('\n✅ All tests completed!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Wait a bit for server to be ready
setTimeout(runTests, 2000);
