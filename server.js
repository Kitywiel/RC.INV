const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

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

// Create contacts directory if it doesn't exist
const contactsDir = path.join(__dirname, 'contacts');
if (!fs.existsSync(contactsDir)) {
    fs.mkdirSync(contactsDir);
}

// Email configuration - Gmail SMTP
let transporter;

// Create transporter synchronously
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        pool: true, // Use connection pool
        maxConnections: 5,
        maxMessages: 10,
        rateDelta: 1000,
        rateLimit: 5
    });
    
    console.log('📧 Email transporter configured for Gmail');
} else {
    console.log('⚠ Email not configured - messages will be saved to files only');
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

        // Try to send email with retry
        let emailSent = false;
        if (transporter) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER || 'noreply@rc-inv.com',
                    to: process.env.EMAIL_TO || 'kitiwiel@gmail.com',
                    subject: `Contact Form: ${subject}`,
                    html: `
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <h3>Message:</h3>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                `,
                    replyTo: email
                };

                // Try to send with a timeout
                await Promise.race([
                    transporter.sendMail(mailOptions),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Email timeout after 15s')), 15000)
                    )
                ]);
                
                emailSent = true;
                console.log(`✓ Email sent to kitiwiel@gmail.com from ${name} (${email})`);
            } catch (emailError) {
                console.error(`❌ Email failed: ${emailError.message}`);
                if (emailError.code === 'ETIMEDOUT' || emailError.message.includes('timeout')) {
                    console.error('⚠️  SMTP ports may be blocked on this hosting platform');
                    console.error('   Consider using SendGrid, Mailgun, or AWS SES instead');
                }
                // Continue - message is saved to file
            }
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
