# Email Setup Instructions

To enable email functionality, you need to configure Gmail credentials:

## Steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Gmail App Password:**
   - Go to your Google Account: https://myaccount.google.com/
   - Navigate to Security
   - Enable 2-Step Verification if not already enabled
   - Search for "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Update .env file:**
   - Open `.env` file
   - Replace `your-email@gmail.com` with your Gmail address
   - Replace `your-app-password` with the 16-character app password you generated
   - The EMAIL_TO is already set to kitiwiel@gmail.com

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access the website:**
   - Open browser to http://localhost:3000
   - Navigate to Contact page
   - Fill out the form - emails will be sent server-side to kitiwiel@gmail.com

## Note:
- Users won't need to open their email client
- Emails are sent directly from the server
- Form submissions show success/error messages
