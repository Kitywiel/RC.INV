# Email Setup for Render

## ✅ Multiple Email Providers Supported!

Choose your preferred email service:

---

## 🎯 Option 1: Resend (EASIEST - Recommended)

**Why Resend?**
- ✅ 100 emails/day FREE forever
- ✅ No credit card required
- ✅ 2-minute setup
- ✅ Works perfectly on Render

### Setup Steps:

1. **Sign up**: https://resend.com/signup (use GitHub login)
2. **Get API Key**: Dashboard → API Keys → Create
3. **Add to Render**:
   ```
   RESEND_API_KEY = re_xxxxx
   EMAIL_TO = kitiwiel@gmail.com
   ```
4. **Done!** Use the default `onboarding@resend.dev` as sender, or verify your own domain

---

## Option 2: SendGrid (More Features)

**Free tier**: 100 emails/day

1. Sign up: https://signup.sendgrid.com/
2. **Verify sender email**:
   - Settings → Sender Authentication
   - Verify Single Sender → `kitiwiel@gmail.com`
3. **Create API Key**:
   - Settings → API Keys → Create
   - Enable "Mail Send" only
4. **Add to Render**:
   ```
   SENDGRID_API_KEY = SG.xxxxx
   SENDGRID_FROM = kitiwiel@gmail.com
   EMAIL_TO = kitiwiel@gmail.com
   ```

---

## Option 3: Gmail SMTP (Local Dev Only)

Works on your local machine, blocked on Render.

Already configured in your `.env` file!

---

## How to Add to Render

1. Go to: https://dashboard.render.com
2. Select your service
3. Environment tab
4. Add variables (choose one provider above)
5. Save → Auto-redeploys

---

## Current Status

- **Code ready** for all 3 providers
- **Locally**: Uses Gmail SMTP
- **On Render**: Use Resend or SendGrid
- **Backup**: Always saves to `/contacts/` folder

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
