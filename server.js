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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

// Initialize SQLite database
const dbPath = path.join(userInfoDir, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✓ Database connected');
        initializeDatabase();
    }
});

// Create database tables
function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'owner',
            owner_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating users table:', err);
        } else {
            console.log('✓ Users table ready');
            // Add role column if it doesn't exist (for existing databases)
            db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'owner'`, () => {});
            db.run(`ALTER TABLE users ADD COLUMN owner_id INTEGER`, () => {});
        }
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
            console.error('❌ Error creating inventory_items table:', err);
        } else {
            console.log('✓ Inventory items table ready');
        }
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
            console.error('❌ Error creating categories table:', err);
        } else {
            console.log('✓ Categories table ready');
        }
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
            console.error('❌ Error creating inventory_transactions table:', err);
        } else {
            console.log('✓ Inventory transactions table ready');
        }
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ============ AUTHENTICATION ROUTES ============

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Check if user already exists
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, existingUser) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (existingUser) {
                if (existingUser.username === username) {
                    return res.status(400).json({ error: 'Username already exists' });
                } else {
                    return res.status(400).json({ error: 'Email already registered' });
                }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            db.run(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Error creating user:', err);
                        return res.status(500).json({ error: 'Failed to create account' });
                    }

                    console.log(`✓ New user registered: ${username} (${email})`);
                    res.json({
                        success: true,
                        message: 'Account created successfully',
                        userId: this.lastID
                    });
                }
            );
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
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Verify password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Update last login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    email: user.email,
                    role: user.role || 'owner',
                    owner_id: user.owner_id
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            console.log(`✓ User logged in: ${username} (${user.role || 'owner'})`);
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role || 'owner',
                    owner_id: user.owner_id
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user (protected route example)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    });
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

        db.run(
            `INSERT INTO users (username, email, password, role, owner_id) VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, 'guest', req.user.id],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint')) {
                        return res.status(400).json({ error: 'Username or email already exists' });
                    }
                    return res.status(500).json({ error: 'Failed to create guest account' });
                }
                res.json({ 
                    success: true, 
                    message: 'Guest account created successfully',
                    guestId: this.lastID
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all guest accounts for owner
app.get('/api/auth/guests', authenticateToken, (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.all(
        `SELECT id, username, email, created_at, last_login FROM users WHERE owner_id = ? AND role = 'guest'`,
        [req.user.id],
        (err, guests) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch guests' });
            }
            res.json({ guests });
        }
    );
});

// Delete guest account
app.delete('/api/auth/guest/:id', authenticateToken, (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.run(
        `DELETE FROM users WHERE id = ? AND owner_id = ? AND role = 'guest'`,
        [req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete guest' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Guest not found' });
            }
            res.json({ success: true, message: 'Guest account deleted' });
        }
    );
});

// ============ INVENTORY MANAGEMENT ROUTES ============

// Get all inventory items for user
app.get('/api/inventory', authenticateToken, (req, res) => {
    // If guest, show owner's inventory; if owner, show own inventory
    const userId = req.user.role === 'guest' ? req.user.owner_id : req.user.id;
    
    db.all(
        `SELECT * FROM inventory_items WHERE user_id = ? ORDER BY updated_at DESC`,
        [userId],
        (err, items) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch inventory' });
            }
            res.json({ items, isReadOnly: req.user.role === 'guest' });
        }
    );
});

// Get inventory statistics (MUST be before /:id route)
app.get('/api/inventory/stats', authenticateToken, (req, res) => {
    const stats = {};
    const userId = req.user.role === 'guest' ? req.user.owner_id : req.user.id;

    // Total items
    db.get(`SELECT COUNT(*) as count FROM inventory_items WHERE user_id = ?`, [userId], (err, result) => {
        stats.totalItems = result ? result.count : 0;

        // Total value
        db.get(`SELECT SUM(quantity * price) as value FROM inventory_items WHERE user_id = ?`, [userId], (err, result) => {
            stats.totalValue = result && result.value ? result.value.toFixed(2) : '0.00';

            // Low stock items
            db.get(`SELECT COUNT(*) as count FROM inventory_items WHERE user_id = ? AND quantity <= min_quantity AND min_quantity > 0`, [userId], (err, result) => {
                stats.lowStockItems = result ? result.count : 0;

                // Categories count
                db.get(`SELECT COUNT(DISTINCT category) as count FROM inventory_items WHERE user_id = ? AND category IS NOT NULL`, [userId], (err, result) => {
                    stats.totalCategories = result ? result.count : 0;

                    res.json({ stats });
                });
            });
        });
    });
});

// Get single inventory item
app.get('/api/inventory/:id', authenticateToken, (req, res) => {
    db.get(
        `SELECT * FROM inventory_items WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        (err, item) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch item' });
            }
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
            res.json({ item });
        }
    );
});

// Create new inventory item
app.post('/api/inventory', authenticateToken, (req, res) => {
    // Block guests from creating items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { name, description, category, quantity, unit, price, sku, location, min_quantity, image_url } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Item name is required' });
    }

    db.run(
        `INSERT INTO inventory_items 
        (user_id, name, description, category, quantity, unit, price, sku, location, min_quantity, image_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, name, description, category, quantity || 0, unit || 'units', price || 0, sku, location, min_quantity || 0, image_url],
        function(err) {
            if (err) {
                console.error('Error creating item:', err);
                return res.status(500).json({ error: 'Failed to create item' });
            }

            const itemId = this.lastID;

            // Log transaction
            db.run(
                `INSERT INTO inventory_transactions (user_id, item_id, type, quantity_change, old_quantity, new_quantity, notes)
                VALUES (?, ?, 'add', ?, 0, ?, ?)`,
                [req.user.id, itemId, quantity || 0, quantity || 0, `Initial stock: ${name}`]
            );

            console.log(`✓ New inventory item created: ${name} by user ${req.user.username}`);
            res.json({ success: true, itemId, message: 'Item created successfully' });
        }
    );
});

// Update inventory item
app.put('/api/inventory/:id', authenticateToken, (req, res) => {
    // Block guests from updating items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { name, description, category, quantity, unit, price, sku, location, min_quantity, image_url } = req.body;

    // First get old item for transaction log
    db.get(
        `SELECT * FROM inventory_items WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        (err, oldItem) => {
            if (err || !oldItem) {
                return res.status(404).json({ error: 'Item not found' });
            }

            db.run(
                `UPDATE inventory_items SET 
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                category = COALESCE(?, category),
                quantity = COALESCE(?, quantity),
                unit = COALESCE(?, unit),
                price = COALESCE(?, price),
                sku = COALESCE(?, sku),
                location = COALESCE(?, location),
                min_quantity = COALESCE(?, min_quantity),
                image_url = COALESCE(?, image_url),
                updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?`,
                [name, description, category, quantity, unit, price, sku, location, min_quantity, image_url, req.params.id, req.user.id],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update item' });
                    }

                    // Log transaction if quantity changed
                    if (quantity !== undefined && quantity !== oldItem.quantity) {
                        db.run(
                            `INSERT INTO inventory_transactions (user_id, item_id, type, quantity_change, old_quantity, new_quantity, notes)
                            VALUES (?, ?, 'update', ?, ?, ?, ?)`,
                            [req.user.id, req.params.id, quantity - oldItem.quantity, oldItem.quantity, quantity, `Updated: ${name || oldItem.name}`]
                        );
                    }

                    res.json({ success: true, message: 'Item updated successfully' });
                }
            );
        }
    );
});

// Delete inventory item
app.delete('/api/inventory/:id', authenticateToken, (req, res) => {
    // Block guests from deleting items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    db.run(
        `DELETE FROM inventory_items WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete item' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            console.log(`✓ Item deleted by user ${req.user.username}`);
            res.json({ success: true, message: 'Item deleted successfully' });
        }
    );
});

// Adjust inventory quantity (add/remove stock)
app.post('/api/inventory/:id/adjust', authenticateToken, (req, res) => {
    // Block guests from adjusting items
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify inventory' });
    }

    const { quantity, notes } = req.body;

    if (quantity === undefined || quantity === 0) {
        return res.status(400).json({ error: 'Quantity adjustment required' });
    }

    db.get(
        `SELECT * FROM inventory_items WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        (err, item) => {
            if (err || !item) {
                return res.status(404).json({ error: 'Item not found' });
            }

            const newQuantity = item.quantity + quantity;

            if (newQuantity < 0) {
                return res.status(400).json({ error: 'Cannot reduce below 0' });
            }

            db.run(
                `UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newQuantity, req.params.id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to adjust quantity' });
                    }

                    // Log transaction
                    db.run(
                        `INSERT INTO inventory_transactions (user_id, item_id, type, quantity_change, old_quantity, new_quantity, notes)
                        VALUES (?, ?, 'adjust', ?, ?, ?, ?)`,
                        [req.user.id, req.params.id, quantity, item.quantity, newQuantity, notes || '']
                    );

                    res.json({ 
                        success: true, 
                        message: 'Quantity adjusted successfully',
                        oldQuantity: item.quantity,
                        newQuantity
                    });
                }
            );
        }
    );
});

// Get inventory history/transactions
app.get('/api/inventory/:id/history', authenticateToken, (req, res) => {
    db.all(
        `SELECT * FROM inventory_transactions WHERE item_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.params.id, req.user.id],
        (err, transactions) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch history' });
            }
            res.json({ transactions });
        }
    );
});

// Get all categories for user
app.get('/api/categories', authenticateToken, (req, res) => {
    db.all(
        `SELECT * FROM categories WHERE user_id = ? ORDER BY name`,
        [req.user.id],
        (err, categories) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch categories' });
            }
            res.json({ categories });
        }
    );
});

// Create category
app.post('/api/categories', authenticateToken, (req, res) => {
    // Block guests from creating categories
    if (req.user.role === 'guest') {
        return res.status(403).json({ error: 'Guests cannot modify categories' });
    }

    const { name, description, color } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    db.run(
        `INSERT INTO categories (user_id, name, description, color) VALUES (?, ?, ?, ?)`,
        [req.user.id, name, description, color || '#667eea'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Category already exists' });
                }
                return res.status(500).json({ error: 'Failed to create category' });
            }
            res.json({ success: true, categoryId: this.lastID, message: 'Category created' });
        }
    );
});

// ============ EMAIL CONFIGURATION ============

// Email configuration - supports Resend, SendGrid, and Gmail SMTP
let transporter;
let emailProvider = 'none';
let resend;

if (process.env.RESEND_API_KEY) {
    // Use Resend (100 emails/day free, no credit card)
    resend = new Resend(process.env.RESEND_API_KEY);
    emailProvider = 'resend';
    console.log('📧 Email configured with Resend');
} else if (process.env.SENDGRID_API_KEY) {
    // Use SendGrid for production
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    emailProvider = 'sendgrid';
    console.log('📧 Email configured with SendGrid');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Use Gmail SMTP for local development
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
    console.log('⚠️  No email service configured - messages will be saved to files only');
    console.log('   Add RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_USER/EMAIL_PASS');
}

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    console.log('📧 Contact form request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    const { name, email, subject, message } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
        console.log('❌ Validation failed - missing fields');
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
                console.log(`✓ Email sent via Resend to ${recipientEmail} from ${name} (${email})`);
                
            } else if (emailProvider === 'sendgrid') {
                // Use SendGrid API
                await sgMail.send({
                    to: recipientEmail,
                    from: process.env.SENDGRID_FROM || recipientEmail,
                    replyTo: email,
                    subject: `Contact Form: ${subject}`,
                    html: htmlContent
                });
                emailSent = true;
                console.log(`✓ Email sent via SendGrid to ${recipientEmail} from ${name} (${email})`);
                
            } else if (emailProvider === 'gmail') {
                // Use SMTP (Gmail)
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
                console.log(`✓ Email sent via Gmail SMTP to ${recipientEmail} from ${name} (${email})`);
            }
        } catch (emailError) {
            console.error(`❌ Email failed: ${emailError.message}`);
            if (emailError.code === 'ETIMEDOUT' || emailError.message.includes('timeout')) {
                console.error('⚠️  SMTP ports blocked - use RESEND_API_KEY or SENDGRID_API_KEY');
            }
            // Continue - message is saved to file
        }

        console.log(`✓ Contact form submission from ${name} (${email})`);
        console.log(`✓ Saved to: ${filename}`);
        console.log(`✓ Environment: ${process.env.NODE_ENV}`);
        
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

// Start server
app.listen(PORT, () => {
    console.log(`RC.INV Server running on http://localhost:${PORT}`);
});

module.exports = app;
