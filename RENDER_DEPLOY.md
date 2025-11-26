# Deploying RC.INV to Render

## Steps to Deploy:

### 1. Push your code to GitHub
Your code is already on GitHub at: https://github.com/Kitywiel/RC.INV

### 2. Sign up/Login to Render
Go to https://render.com and sign up or log in with your GitHub account.

### 3. Create a New Web Service
1. Click "New +" button and select "Web Service"
2. Connect your GitHub repository: `Kitywiel/RC.INV`
3. Configure the service:
   - **Name**: rc-inv (or any name you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or choose a paid plan)

### 4. Add Environment Variables
In the Render dashboard, add these environment variables:
- `NODE_ENV` = `production`
- `JWT_SECRET` = `rc-inv-super-secret-key-change-this-in-production-2024`
- `UNLOCK_CODE` = `UNLIMITED2024`
- `EMAIL_USER` = `kitiwiel@gmail.com` (your Gmail)
- `EMAIL_PASS` = `vcoyxtzhwnhnatzi` (your app password)
- `EMAIL_TO` = `kitiwiel@gmail.com`
- `ADMIN_USERNAME` = `kitywiel` (change for security!)
- `ADMIN_EMAIL` = `admin@rcinv.local`
- `ADMIN_PASSWORD` = `Poliklop0.` (change for security!)

### 5. Deploy
Click "Create Web Service" and Render will automatically deploy your app!

### 6. Access Your Site
Once deployed, Render will give you a URL like:
`https://rc-inv.onrender.com`

**Default Admin Login:**
- Username: `admin` (or your ADMIN_USERNAME)
- Password: `admin123` (or your ADMIN_PASSWORD)

⚠️ **Change the admin password immediately after first login for security!**

## Notes:
- Admin account is automatically created on first server start
- Free tier apps may sleep after 15 minutes of inactivity
- First request after sleeping may take 30-60 seconds to wake up
- Your email functionality will work automatically once deployed
- SSL/HTTPS is automatically provided
- Database is fresh on deployment - you'll need to create user accounts

## Update Your Site:
After deployment, any time you push to GitHub main branch, Render will automatically redeploy!
