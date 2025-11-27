/**
 * Migration Script: SQLite to Google Sheets
 * Copies all data from SQLite database to Google Sheets
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getInstance } = require('./server/google-sheets-db');

async function migrate() {
    console.log('🔄 Starting migration from SQLite to Google Sheets...\n');

    try {
        // Connect to SQLite
        const dbPath = path.join(__dirname, 'user_info', 'users.db');
        const db = new sqlite3.Database(dbPath);
        
        // Connect to Google Sheets
        const googleDB = await getInstance();
        console.log('✓ Connected to both databases\n');

        // Migrate Users
        console.log('1️⃣  Migrating users...');
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`   Found ${users.length} users in SQLite`);
        
        for (const user of users) {
            try {
                await googleDB.createUser({
                    username: user.username,
                    email: user.email,
                    password: user.password, // Already hashed
                    role: user.role || 'owner',
                    owner_id: user.owner_id || null,
                    item_limit: user.item_limit || 20,
                    has_unlimited: user.has_unlimited || 0,
                    is_active: user.is_active !== undefined ? user.is_active : 1,
                    created_at: user.created_at || new Date().toISOString(),
                    last_login: user.last_login || null
                });
                console.log(`   ✓ Migrated user: ${user.username}`);
            } catch (error) {
                console.log(`   ⚠️  User ${user.username} may already exist or error: ${error.message}`);
            }
        }

        // Migrate Inventory Items
        console.log('\n2️⃣  Migrating inventory items...');
        const items = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM inventory_items', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`   Found ${items.length} items in SQLite`);

        for (const item of items) {
            try {
                await googleDB.addInventoryItem(item.user_id, {
                    name: item.name,
                    description: item.description || '',
                    category: item.category || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || 'units',
                    price: item.price || 0,
                    sku: item.sku || '',
                    location: item.location || '',
                    min_quantity: item.min_quantity || 0,
                    image_url: item.image_url || '',
                    created_at: item.created_at || new Date().toISOString(),
                    updated_at: item.updated_at || new Date().toISOString()
                });
                console.log(`   ✓ Migrated item: ${item.name}`);
            } catch (error) {
                console.log(`   ⚠️  Failed to migrate item ${item.name}: ${error.message}`);
            }
        }

        db.close();

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Users migrated: ${users.length}`);
        console.log(`   Items migrated: ${items.length}`);
        console.log('\n💡 Next step: Set USE_GOOGLE_SHEETS=true in .env file');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
