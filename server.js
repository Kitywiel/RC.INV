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

// Create users table
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating users table:', err);
        } else {
            console.log('✓ Users table ready');
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
                { id: user.id, username: user.username, email: user.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            console.log(`✓ User logged in: ${username}`);
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
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
