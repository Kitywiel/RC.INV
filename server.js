const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { Resend } = require('resend');

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
