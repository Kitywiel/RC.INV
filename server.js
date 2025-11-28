const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { getInstance: getGoogleSheetsDB } = require('./server/google-sheets-db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const USE_GOOGLE_SHEETS = process.env.USE_GOOGLE_SHEETS === 'true';

// Database instances
let db = null; // SQLite database
let googleDB = null; // Google Sheets database

// Create necessary directories
const userInfoDir = path.join(__dirname, 'user_info');
if (!fs.existsSync(userInfoDir)) {
    fs.mkdirSync(userInfoDir);
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Create contacts directory
const contactsDir = path.join(__dirname, 'contacts');
if (!fs.existsSync(contactsDir)) {
    fs.mkdirSync(contactsDir);
}

// Initialize database based on configuration
async function initializeDatabases() {
    if (USE_GOOGLE_SHEETS) {
        console.log('📊 Using Google Sheets as database');
        try {
            googleDB = await getGoogleSheetsDB();
            console.log('✓ Google Sheets connected');
        } catch (error) {
            console.error('Failed to connect to Google Sheets:', error.message);
            console.log('⚠️  Falling back to SQLite');
            await initializeSQLite();
        }
    } else {
        await initializeSQLite();
    }
}

// Initialize SQLite database
function initializeSQLite() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(userInfoDir, 'users.db');
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Database connection error:', err);
                reject(err);
            } else {
                console.log('✓ SQLite database connected');
                initializeDatabase();
                resolve();
            }
        });
    });
}

// Create database tables
function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            owner_id INTEGER,
            item_limit INTEGER DEFAULT 20,
            has_unlimited BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
            return;
        }
        console.log('✓ Users table ready');
        // Add columns if they don't exist (for existing databases)
        db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN owner_id INTEGER`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN item_limit INTEGER DEFAULT 20`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN has_unlimited BOOLEAN DEFAULT 0`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN permission TEXT DEFAULT 'read-only'`, () => {});
    });

    // Inventory items table
    db.run(`
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
    `, (err) => {
        if (err) {
            console.error('Error creating inventory_items table:', err);
            return;
        }
        console.log('✓ Inventory items table ready');
    });

    // Inventory categories table
    db.run(`
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
    `, (err) => {
        if (err) {
            console.error('Error creating categories table:', err);
            return;
        }
        console.log('✓ Categories table ready');
    });

    // Inventory transactions (history log)
    db.run(`
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
    `, (err) => {
        if (err) {
            console.error('Error creating inventory_transactions table:', err);
            return;
        }
        console.log('✓ Inventory transactions table ready');
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Admins bypass active status check
        if (user.role === 'admin') {
            req.user = user;
            return next();
        }
        
        // Check if user account is active
        try {
            const result = await dbGetUser('SELECT is_active FROM users WHERE id = ?', [user.id]);
            if (!result || !result.is_active) {
                return res.status(403).json({ error: 'Account has been disabled. Please contact administrator.' });
            }
            req.user = user;
            next();
        } catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    });
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ============ DATABASE WRAPPER FUNCTIONS ============
// These functions route to either SQLite or Google Sheets based on USE_GOOGLE_SHEETS

async function dbGetUser(query, params) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        // Google Sheets implementation
        if (query.includes('username = ?')) {
            // Check regular users first
            let user = await googleDB.getUserByUsername(params[0]);
            // If not found, check guests
            if (!user) {
                user = await googleDB.getGuestByUsername(params[0]);
            }
            return user;
        } else if (query.includes('email = ?')) {
            return await googleDB.getUserByEmail(params[0]);
        } else if (query.includes('WHERE id = ?')) {
            const users = await googleDB.getUsers();
            let user = users.find(u => u.id === params[0]);
            // If not found in users, check guests
            if (!user) {
                const allGuestsData = await googleDB.read('GUESTS');
                if (allGuestsData.length > 1) {
                    const guestRow = allGuestsData.slice(1).find(row => row[1] === params[0]);
                    if (guestRow) {
                        user = {
                            id: guestRow[1],
                            username: guestRow[2],
                            email: guestRow[3],
                            password: guestRow[4],
                            role: 'guest',
                            owner_id: guestRow[0],
                            is_active: guestRow[6] === 'TRUE' ? 1 : 0,
                            item_limit: 20,
                            has_unlimited: 0
                        };
                    }
                }
            }
            return user;
        }
    } else {
        // SQLite implementation
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function dbGetAllUsers(query, params) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        let users = await googleDB.getUsers();
        // Filter out admin users if query specifies
        if (query.includes("role != 'admin'")) {
            users = users.filter(u => u.role !== 'admin');
        }
        // Filter by owner_id if specified (for guests)
        if (params && params.length > 0 && query.includes('owner_id = ?')) {
            return await googleDB.getGuestsByUserId(params[0]);
        }
        return users;
    } else {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function dbCreateUser(userData) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.createUser(userData);
    } else {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, email, password, role, owner_id, item_limit, has_unlimited, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userData.username, userData.email, userData.password, userData.role || 'user', 
                 userData.owner_id || null, userData.item_limit || 20, userData.has_unlimited || 0, 
                 userData.is_active !== undefined ? userData.is_active : 1],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...userData });
                }
            );
        });
    }
}

async function dbUpdateUser(userId, updates) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.updateUser(userId, updates);
    } else {
        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), userId];
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET ${setClauses} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }
}

async function dbDeleteUser(userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.deleteUser(userId);
    } else {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }
}

async function dbGetInventory(userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.getInventoryByUserId(userId);
    } else {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM inventory_items WHERE user_id = ? ORDER BY updated_at DESC', 
                [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function dbGetInventoryItem(itemId, userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        const items = await googleDB.getInventoryByUserId(userId);
        return items.find(item => item.id === itemId);
    } else {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', 
                [itemId, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function dbGetInventoryStats(userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.getInventoryStats(userId);
    } else {
        return new Promise((resolve, reject) => {
            db.get(`SELECT 
                COUNT(*) as totalItems,
                COALESCE(SUM(quantity * price), 0) as totalValue,
                COUNT(CASE WHEN quantity <= min_quantity AND min_quantity > 0 THEN 1 END) as lowStockItems,
                COUNT(DISTINCT category) as totalCategories
                FROM inventory_items WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function dbCreateInventoryItem(userId, itemData) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.addInventoryItem(userId, itemData);
    } else {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO inventory_items 
                (user_id, name, description, category, quantity, unit, price, sku, location, min_quantity, image_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, itemData.name, itemData.description, itemData.category, 
                 itemData.quantity || 0, itemData.unit || 'units', itemData.price || 0,
                 itemData.sku, itemData.location, itemData.min_quantity || 0, itemData.image_url],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...itemData });
                }
            );
        });
    }
}

async function dbUpdateInventoryItem(itemId, userId, updates) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.updateInventoryItem(itemId, updates);
    } else {
        const setClauses = [];
        const values = [];
        Object.keys(updates).forEach(key => {
            setClauses.push(`${key} = ?`);
            values.push(updates[key]);
        });
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(itemId, userId);
        
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE inventory_items SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }
}

async function dbDeleteInventoryItem(itemId, userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        return await googleDB.deleteInventoryItem(itemId);
    } else {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM inventory_items WHERE id = ? AND user_id = ?', 
                [itemId, userId], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }
}

async function dbCountUserItems(userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        const items = await googleDB.getInventoryByUserId(userId);
        return items.length;
    } else {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM inventory_items WHERE user_id = ?', 
                [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }
}

async function dbDeleteUserItems(userId) {
    if (USE_GOOGLE_SHEETS && googleDB) {
        const items = await googleDB.getInventoryByUserId(userId);
        let deleted = 0;
        for (const item of items) {
            await googleDB.deleteInventoryItem(item.id);
            deleted++;
        }
        return deleted;
    } else {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM inventory_items WHERE user_id = ?', [userId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
}

// ============ AUTHENTICATION ROUTES ============

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Check if username exists
        const userByUsername = await dbGetUser('SELECT * FROM users WHERE username = ?', [username]);
        if (userByUsername) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Check if email exists
        const userByEmail = await dbGetUser('SELECT * FROM users WHERE email = ?', [email]);
        if (userByEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await dbCreateUser({
            username,
            email,
            password: hashedPassword,
            role: 'user',
            item_limit: 20,
            has_unlimited: 0,
            is_active: 1
        });

        console.log(`✓ New user registered: ${username} (${email})`);
        res.json({
            success: true,
            message: 'Account created successfully',
            userId: newUser.id
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await dbGetUser('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Update last login
        await dbUpdateUser(user.id, { last_login: new Date().toISOString() });

        // Check if account is active
        if (!user.is_active && user.role !== 'admin') {
            return res.status(403).json({ error: 'Your account has been disabled. Please contact administrator.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                role: user.role || 'user',
                owner_id: user.owner_id
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✓ User logged in: ${username} (${user.role || 'user'})`);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role || 'user',
                owner_id: user.owner_id,
                item_limit: user.item_limit || 20,
                has_unlimited: user.has_unlimited || 0
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user (protected route example)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await dbGetUser('SELECT id, username, email, role, item_limit, has_unlimited, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Create guest account (only for owners)
app.post('/api/auth/create-guest', authenticateToken, async (req, res) => {
    const { username, email, password } = req.body;

    // Check if user is an owner (not a guest)
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot create guest accounts' });
    }

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const guest = await dbCreateUser({
            username,
            email,
            password: hashedPassword,
            role: 'guest',
            owner_id: req.user.id,
            item_limit: 20,
            has_unlimited: 0,
            is_active: 1
        });

        res.json({ 
            success: true, 
            message: 'Guest account created successfully',
            guestId: guest.id
        });
    } catch (error) {
        if (error.message && error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all guest accounts for owner
app.get('/api/auth/guests', authenticateToken, async (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const guests = await dbGetAllUsers(
            `SELECT id, username, email, created_at, last_login FROM users WHERE owner_id = ? AND role = 'guest'`,
            [req.user.id]
        );
        res.json({ guests });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch guests' });
    }
});

// Delete guest account
app.delete('/api/auth/guest/:id', authenticateToken, async (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        // Verify guest belongs to owner
        const guest = await dbGetUser('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!guest || guest.owner_id !== req.user.id || guest.role !== 'guest') {
            return res.status(404).json({ error: 'Guest not found' });
        }

        await dbDeleteUser(req.params.id);
        res.json({ success: true, message: 'Guest account deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete guest' });
    }
});

// Reset guest password
app.post('/api/auth/guest/:id/reset-password', authenticateToken, async (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Verify guest belongs to owner
        const guest = await dbGetUser('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!guest || guest.owner_id !== req.user.id || guest.role !== 'guest') {
            return res.status(404).json({ error: 'Guest not found' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await dbUpdateUser(req.params.id, { password: hashedPassword });
        
        console.log(`✓ Password reset for guest: ${guest.username}`);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Update guest permission
app.post('/api/auth/guest/:id/permission', authenticateToken, async (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { permission } = req.body;
    const validPermissions = ['read-only', 'edit-inv', 'full-access'];
    
    if (!permission || !validPermissions.includes(permission)) {
        return res.status(400).json({ error: 'Invalid permission level' });
    }

    try {
        // Verify guest belongs to owner
        const guest = await dbGetUser('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!guest || guest.owner_id !== req.user.id || guest.role !== 'guest') {
            return res.status(404).json({ error: 'Guest not found' });
        }

        await dbUpdateUser(req.params.id, { permission });
        
        console.log(`✓ Permission updated for guest ${guest.username}: ${permission}`);
        res.json({ success: true, message: 'Permission updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update permission' });
    }
});

// Unlock unlimited items with code
app.post('/api/auth/unlock-unlimited', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const UNLOCK_CODE = process.env.UNLOCK_CODE || 'UNLIMITED2024';

    if (!code) {
        return res.status(400).json({ error: 'Unlock code is required' });
    }

    if (code !== UNLOCK_CODE) {
        return res.status(403).json({ error: 'Invalid unlock code' });
    }

    try {
        await dbUpdateUser(req.user.id, { has_unlimited: 1 });
        console.log(`✓ Unlimited items unlocked for user ${req.user.username}`);
        
        // Return updated user data
        const updatedUser = await dbGetUser('SELECT id, username, email, role, item_limit, has_unlimited FROM users WHERE id = ?', [req.user.id]);
        res.json({ 
            success: true, 
            message: 'Unlimited items unlocked!',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                item_limit: updatedUser.item_limit,
                has_unlimited: updatedUser.has_unlimited
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unlock unlimited items' });
    }
});

// Get user limits
app.get('/api/auth/limits', authenticateToken, async (req, res) => {
    try {
        const user = await dbGetUser('SELECT item_limit, has_unlimited FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(500).json({ error: 'Failed to fetch limits' });
        }

        const count = await dbCountUserItems(req.user.id);

        res.json({
            itemLimit: user.item_limit,
            hasUnlimited: user.has_unlimited === 1,
            currentCount: count,
            remaining: user.has_unlimited ? 'unlimited' : Math.max(0, user.item_limit - count)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch limits' });
    }
});

// ============ ADMIN ROUTES ============

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await dbGetAllUsers(
            `SELECT id, username, email, role, is_active, item_limit, has_unlimited, created_at, last_login FROM users WHERE role != 'admin' ORDER BY created_at DESC`,
            []
        );
        
        // Add item count for each user
        for (const user of users) {
            user.item_count = await dbCountUserItems(user.id);
        }
        
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Toggle user active status (admin only)
app.post('/api/admin/user/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await dbGetUser('SELECT is_active, username FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newStatus = user.is_active ? 0 : 1;
        await dbUpdateUser(userId, { is_active: newStatus });
        
        console.log(`✓ User ${user.username} ${newStatus ? 'enabled' : 'disabled'} by admin ${req.user.username}`);
        res.json({ 
            success: true, 
            message: `User ${newStatus ? 'enabled' : 'disabled'} successfully`,
            isActive: newStatus === 1
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Unlock unlimited items for user (admin only)
app.post('/api/admin/user/:id/unlock-unlimited', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await dbGetUser('SELECT username FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await dbUpdateUser(userId, { has_unlimited: 1 });
        console.log(`✓ Unlimited items unlocked for ${user.username} by admin ${req.user.username}`);
        res.json({ success: true, message: 'Unlimited items unlocked for user' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unlock unlimited' });
    }
});

// Delete user's inventory items (admin only)
app.delete('/api/admin/user/:id/items', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await dbGetUser('SELECT username FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const deletedCount = await dbDeleteUserItems(userId);
        console.log(`✓ Deleted ${deletedCount} items for user ${user.username} by admin ${req.user.username}`);
        res.json({ 
            success: true, 
            message: `Deleted ${deletedCount} items`,
            deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete items' });
    }
});

// Delete user account (admin only)
app.delete('/api/admin/user/:id', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await dbGetUser('SELECT username, role FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin accounts' });
        }

        await dbDeleteUser(userId);
        console.log(`✓ User ${user.username} deleted by admin ${req.user.username}`);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get user details with inventory (admin only)
app.get('/api/admin/user/:id', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await dbGetUser(
            `SELECT id, username, email, role, is_active, item_limit, has_unlimited, created_at, last_login FROM users WHERE id = ?`,
            [userId]
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const items = await dbGetInventory(userId);
        res.json({ user, items });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// ============ INVENTORY MANAGEMENT ROUTES ============

// Get all inventory items for user
app.get('/api/inventory', authenticateToken, async (req, res) => {
    // If guest, show owner's inventory; if owner, show own inventory
    const userId = req.user.role === 'guest' ? req.user.owner_id : req.user.id;
    
    try {
        const items = await dbGetInventory(userId);
        res.json({ items, isReadOnly: req.user.role === 'guest' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Get inventory statistics (MUST be before /:id route)
app.get('/api/inventory/stats', authenticateToken, async (req, res) => {
    const userId = req.user.role === 'guest' ? req.user.owner_id : req.user.id;

    try {
        console.log('Stats request for user:', userId, 'role:', req.user.role);
        const stats = await dbGetInventoryStats(userId);
        console.log('Stats result:', stats);
        res.json({ 
            stats: {
                totalItems: stats.totalItems || 0,
                totalValue: stats.totalValue || '0.00',
                lowStockItems: stats.lowStockItems || 0,
                totalCategories: stats.totalCategories || 0
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
});

// Get single inventory item
app.get('/api/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const item = await dbGetInventoryItem(req.params.id, req.user.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ item });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

// Create new inventory item
app.post('/api/inventory', authenticateToken, async (req, res) => {
    // Block guests from creating items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { name, description, category, quantity, unit, price, sku, location, min_quantity, image_url } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Item name is required' });
    }

    try {
        // Check item limit
        const user = await dbGetUser('SELECT item_limit, has_unlimited FROM users WHERE id = ?', [req.user.id]);
        const currentCount = await dbCountUserItems(req.user.id);

        // Skip limit check if user has unlimited
        if (!user.has_unlimited && currentCount >= user.item_limit) {
            return res.status(403).json({ 
                error: `Item limit reached. You can only have ${user.item_limit} items. Upgrade to unlimited in settings.`,
                limitReached: true,
                currentCount,
                limit: user.item_limit
            });
        }

        await insertItem();
    } catch (error) {
        console.error('Error creating item:', error);
        return res.status(500).json({ error: 'Failed to create item' });
    }

    async function insertItem() {
        const item = await dbCreateInventoryItem(req.user.id, {
            name,
            description,
            category,
            quantity: quantity || 0,
            unit: unit || 'units',
            price: price || 0,
            sku,
            location,
            min_quantity: min_quantity || 0,
            image_url
        });

        console.log(`✓ Item created: ${name}`);
        res.json({ success: true, itemId: item.id, message: 'Item created successfully' });
    }
});

// Update inventory item
app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
    // Block guests from updating items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { name, description, category, quantity, unit, price, sku, location, min_quantity, image_url } = req.body;

    try {
        // First get old item for transaction log
        const oldItem = await dbGetInventoryItem(req.params.id, req.user.id);
        if (!oldItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (category !== undefined) updates.category = category;
        if (quantity !== undefined) updates.quantity = quantity;
        if (unit !== undefined) updates.unit = unit;
        if (price !== undefined) updates.price = price;
        if (sku !== undefined) updates.sku = sku;
        if (location !== undefined) updates.location = location;
        if (min_quantity !== undefined) updates.min_quantity = min_quantity;
        if (image_url !== undefined) updates.image_url = image_url;

        await dbUpdateInventoryItem(req.params.id, req.user.id, updates);
        res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Delete inventory item
app.delete('/api/inventory/:id', authenticateToken, async (req, res) => {
    // Block guests from deleting items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    try {
        const result = await dbDeleteInventoryItem(req.params.id, req.user.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        console.log('✓ Item deleted');
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Adjust inventory quantity (add/remove stock)
app.post('/api/inventory/:id/adjust', authenticateToken, async (req, res) => {
    // Block guests from adjusting items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { quantity, notes } = req.body;

    if (quantity === undefined || quantity === 0) {
        return res.status(400).json({ error: 'Quantity adjustment required' });
    }

    try {
        const item = await dbGetInventoryItem(req.params.id, req.user.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const newQuantity = item.quantity + quantity;

        if (newQuantity < 0) {
            return res.status(400).json({ error: 'Cannot reduce below 0' });
        }

        await dbUpdateInventoryItem(req.params.id, req.user.id, { quantity: newQuantity });

        res.json({ 
            success: true, 
            message: 'Quantity adjusted successfully',
            oldQuantity: item.quantity,
            newQuantity
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to adjust quantity' });
    }
});

// Get inventory history/transactions
app.get('/api/inventory/:id/history', authenticateToken, async (req, res) => {
    // Transactions not yet implemented in Google Sheets
    if (USE_GOOGLE_SHEETS && googleDB) {
        return res.json({ transactions: [] });
    }
    
    try {
        const transactions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM inventory_transactions WHERE item_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50`,
                [req.params.id, req.user.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        res.json({ transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get all categories for user
app.get('/api/categories', authenticateToken, async (req, res) => {
    // Categories not yet implemented in Google Sheets
    if (USE_GOOGLE_SHEETS && googleDB) {
        // Extract unique categories from inventory items
        try {
            const items = await dbGetInventory(req.user.id);
            const uniqueCategories = [...new Set(items.map(item => item.category).filter(c => c))];
            const categories = uniqueCategories.map((cat, index) => ({
                id: index + 1,
                user_id: req.user.id,
                name: cat,
                description: '',
                color: '#667eea'
            }));
            return res.json({ categories });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
    }
    
    try {
        const categories = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM categories WHERE user_id = ? ORDER BY name`,
                [req.user.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create category
app.post('/api/categories', authenticateToken, async (req, res) => {
    // Block guests from creating categories
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify categories' });
    }

    const { name, description, color } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    // Categories not fully implemented in Google Sheets - just return success
    if (USE_GOOGLE_SHEETS && googleDB) {
        return res.json({ success: true, categoryId: Date.now(), message: 'Category created' });
    }

    try {
        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO categories (user_id, name, description, color) VALUES (?, ?, ?, ?)`,
                [req.user.id, name, description, color || '#667eea'],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
        res.json({ success: true, categoryId: result.id, message: 'Category created' });
    } catch (error) {
        if (error.message && error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Category already exists' });
        }
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// ============ EMAIL CONFIGURATION ============

// Email configuration - supports Resend, SendGrid, and Gmail SMTP
let transporter;
let emailProvider = 'none';
let resend;

// Configure email provider based on available credentials
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    emailProvider = 'resend';
    console.log('✓ Email configured: Resend');
} else if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    emailProvider = 'sendgrid';
    console.log('✓ Email configured: SendGrid');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Gmail SMTP for local development
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 10,
        rateDelta: 1000,
        rateLimit: 5
    });
    emailProvider = 'gmail';
    console.log('📧 Email configured with Gmail SMTP');
} else {
    console.log('⚠️  No email service configured');
    console.log('   Contact form submissions will be saved to files only');
    console.log('   Configure RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_USER/EMAIL_PASS');
}

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Create contact submission object
        const submission = {
            timestamp: new Date().toISOString(),
            name,
            email,
            subject,
            message,
            recipientEmail: 'kitiwiel@gmail.com'
        };

        // Save to file (backup)
        const filename = `contact_${Date.now()}.json`;
        const filepath = path.join(contactsDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(submission, null, 2));

        // Also append to a contacts log
        const logFile = path.join(contactsDir, 'contacts_log.txt');
        const logEntry = `
=====================================
Date: ${submission.timestamp}
From: ${name} (${email})
To: kitiwiel@gmail.com
Subject: ${subject}
Message:
${message}
=====================================

`;
        fs.appendFileSync(logFile, logEntry);

        // Try to send email
        let emailSent = false;
        const recipientEmail = process.env.EMAIL_TO || 'kitiwiel@gmail.com';
        const htmlContent = `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <h3>Message:</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `;
        
        try {
            if (emailProvider === 'resend') {
                // Use Resend API (100 emails/day free)
                await resend.emails.send({
                    from: process.env.RESEND_FROM || 'onboarding@resend.dev',
                    to: recipientEmail,
                    replyTo: email,
                    subject: `Contact Form: ${subject}`,
                    html: htmlContent
                });
                emailSent = true;
                console.log(`✓ Email sent via Resend to ${recipientEmail}`);
                
            } else if (emailProvider === 'sendgrid') {
                await sgMail.send({
                    to: recipientEmail,
                    from: process.env.SENDGRID_FROM || recipientEmail,
                    replyTo: email,
                    subject: `Contact Form: ${subject}`,
                    html: htmlContent
                });
                emailSent = true;
                console.log(`✓ Email sent via SendGrid to ${recipientEmail}`);
                
            } else if (emailProvider === 'gmail') {
                await Promise.race([
                    transporter.sendMail({
                        from: process.env.EMAIL_USER || 'noreply@rc-inv.com',
                        to: recipientEmail,
                        subject: `Contact Form: ${subject}`,
                        html: htmlContent,
                        replyTo: email
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Email timeout after 15s')), 15000)
                    )
                ]);
                emailSent = true;
                console.log(`✓ Email sent via Gmail SMTP to ${recipientEmail}`);
            }
        } catch (emailError) {
            console.error('Email sending failed:', emailError.message);
            if (emailError.code === 'ETIMEDOUT' || emailError.message.includes('timeout')) {
                console.error('SMTP ports may be blocked - consider using RESEND_API_KEY or SENDGRID_API_KEY');
            }
        }

        console.log(`✓ Contact form submission saved: ${filename}`);
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }
});

// Serve start page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'start.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'RC.INV Server is running' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server with async database initialization
async function startServer() {
    try {
        await initializeDatabases();
        
        app.listen(PORT, () => {
            console.log(`\n🚀 RC.INV Server running on http://localhost:${PORT}`);
            console.log(`📊 Database: ${USE_GOOGLE_SHEETS ? 'Google Sheets' : 'SQLite'}`);
            console.log(`\nReady to accept connections!\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
