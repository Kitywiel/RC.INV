# Fixing Email on Render

## Problem
Render blocks outbound SMTP connections (ports 25, 465, 587) for security reasons. This prevents direct Gmail SMTP from working.

## Solution Options

### Option 1: Use SendGrid (Recommended - Free Tier Available)
SendGrid provides a reliable email API that works on Render.

1. **Sign up for SendGrid**: https://signup.sendgrid.com/
2. **Create an API Key**:
   - Go to Settings → API Keys
   - Create a new API Key with "Mail Send" permissions
   - Copy the key (you'll only see it once)

3. **Install SendGrid**:
   ```bash
   npm install @sendgrid/mail
   ```

4. **Update Environment Variables in Render**:
   - `SENDGRID_API_KEY` = your_api_key_here
   - Remove `EMAIL_USER` and `EMAIL_PASS`

5. **Update server.js** - I can do this for you!

### Option 2: Use Mailgun (Free Tier Available)
Similar to SendGrid with 5,000 emails/month free.

1. Sign up: https://www.mailgun.com/
2. Get your API key from the dashboard
3. Install: `npm install mailgun.js`
4. Add to Render environment: `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`

### Option 3: Use AWS SES (Very Cheap)
Best for production, requires AWS account.

1. Set up AWS SES
2. Verify your email domain
3. Get SMTP credentials (SES provides special SMTP servers that aren't blocked)

### Option 4: Continue with File-Only Storage
Current setup saves all contact submissions to `/contacts/` folder. You can:
- Download the files periodically from Render
- Set up a scheduled task to email you the daily submissions
- Access logs directly in Render dashboard

## Quick Fix: Let Me Set Up SendGrid

If you have a SendGrid API key, I can update the code to use it instead of Gmail SMTP.

Just provide:
1. Your SendGrid API Key
2. Or let me know you want to continue with file-only storage

## Current Status
✅ Contact form works and saves all submissions
✅ File backup in `/contacts/` folder  
❌ Email sending blocked by Render's firewall
