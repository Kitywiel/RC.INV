const { run, usePostgres } = require('./database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
        if (usePostgres) {
            await initializePostgres();
        } else {
            await initializeSQLite();
        }
        
        // Create default admin account
        await createDefaultAdmin();
        
        console.log('✓ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

async function initializePostgres() {
    // Users table
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'owner',
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            item_limit INTEGER DEFAULT 20,
            has_unlimited BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    `);
    console.log('✓ Users table ready');

    // Inventory items table
    await run(`
        CREATE TABLE IF NOT EXISTS inventory_items (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(255),
            quantity INTEGER DEFAULT 0,
            unit VARCHAR(50) DEFAULT 'units',
            price DECIMAL(10, 2) DEFAULT 0,
            sku VARCHAR(255),
            location VARCHAR(255),
            min_quantity INTEGER DEFAULT 0,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✓ Inventory items table ready');

    // Categories table
    await run(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            color VARCHAR(7) DEFAULT '#667eea',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        )
    `);
    console.log('✓ Categories table ready');

    // Inventory transactions table
    await run(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL CHECK(type IN ('add', 'remove', 'update', 'adjust')),
            quantity_change INTEGER,
            old_quantity INTEGER,
            new_quantity INTEGER,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✓ Inventory transactions table ready');

    // Create indexes
    await run('CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_items(user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_transactions_user ON inventory_transactions(user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_transactions_item ON inventory_transactions(item_id)');
}

async function initializeSQLite() {
    // Users table
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'owner',
            owner_id INTEGER,
            item_limit INTEGER DEFAULT 20,
            has_unlimited BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    console.log('✓ Users table ready');

    // Inventory items table
    await run(`
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            unit TEXT DEFAULT 'units',
            price REAL DEFAULT 0,
            sku TEXT,
            location TEXT,
            min_quantity INTEGER DEFAULT 0,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    console.log('✓ Inventory items table ready');

    // Categories table
    await run(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#667eea',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
    `);
    console.log('✓ Categories table ready');

    // Inventory transactions table
    await run(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('add', 'remove', 'update', 'adjust')),
            quantity_change INTEGER,
            old_quantity INTEGER,
            new_quantity INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
        )
    `);
    console.log('✓ Inventory transactions table ready');

    // Add columns if they don't exist (for existing SQLite databases)
    try {
        await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'owner'`);
    } catch (e) { /* Column already exists */ }
    try {
        await run(`ALTER TABLE users ADD COLUMN owner_id INTEGER`);
    } catch (e) { /* Column already exists */ }
    try {
        await run(`ALTER TABLE users ADD COLUMN item_limit INTEGER DEFAULT 20`);
    } catch (e) { /* Column already exists */ }
    try {
        await run(`ALTER TABLE users ADD COLUMN has_unlimited BOOLEAN DEFAULT 0`);
    } catch (e) { /* Column already exists */ }
    try {
        await run(`ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1`);
    } catch (e) { /* Column already exists */ }
}

async function createDefaultAdmin() {
    const { get, run } = require('./database');
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@rcinv.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if admin already exists
    const existingAdmin = await get(
        'SELECT id FROM users WHERE username = $1 OR role = $2',
        [adminUsername, 'admin']
    );
    
    if (!existingAdmin) {
        // Create admin account
        const hash = await bcrypt.hash(adminPassword, 10);
        
        const insertSQL = usePostgres
            ? 'INSERT INTO users (username, email, password, role, item_limit, has_unlimited, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id'
            : 'INSERT INTO users (username, email, password, role, item_limit, has_unlimited, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)';
        
        await run(insertSQL, [adminUsername, adminEmail, hash, 'admin', 20, usePostgres ? true : 1, usePostgres ? true : 1]);
        
        console.log('✓ Default admin account created');
        console.log(`  Username: ${adminUsername}`);
        console.log(`  Password: ${adminPassword}`);
    } else {
        console.log('✓ Admin account already exists');
    }
}

module.exports = { initializeDatabase };
