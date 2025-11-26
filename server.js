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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Create contacts directory if it doesn't exist
const contactsDir = path.join(__dirname, 'contacts');
if (!fs.existsSync(contactsDir)) {
    fs.mkdirSync(contactsDir);
}

// Email configuration - using ethereal for testing or real SMTP
let transporter;
async function setupEmailTransporter() {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Use real Gmail credentials if provided
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // Use SendGrid or other service (no auth required for dev)
        // For now, we'll use a simple SMTP that requires less config
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: 'ethereal.user@ethereal.email',
                pass: 'ethereal.pass'
            }
        });
    }
}

setupEmailTransporter();

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Validate input
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
        try {
            const mailOptions = {
                from: email,
                to: 'kitiwiel@gmail.com',
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

            await transporter.sendMail(mailOptions);
            console.log(`✓ Email sent to kitiwiel@gmail.com from ${name} (${email})`);
        } catch (emailError) {
            console.log('Email sending failed (saved to file instead):', emailError.message);
            console.log('To enable email: Configure EMAIL_USER and EMAIL_PASS in .env');
        }

        console.log(`Contact form submission received from ${name} (${email})`);
        console.log(`Saved to: ${filename}`);
        
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
