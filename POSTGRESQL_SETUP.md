# PostgreSQL Setup for Render

Your app now supports **both SQLite (local) and PostgreSQL (production)**!

## 🎯 How It Works

- **Local Development**: Uses SQLite (`user_info/users.db`)
- **Production (Render)**: Uses PostgreSQL (persistent database)

The app automatically detects which database to use based on the `DATABASE_URL` environment variable.

## 📝 Setup Steps on Render

### 1. Create PostgreSQL Database

1. Go to your [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `rc-inv-db` (or any name)
   - **Database**: `rcinv` (or any name)
   - **User**: (auto-generated)
   - **Region**: Choose closest to your web service
   - **Plan**: **Free** (500 MB, expires after 90 days)
4. Click **"Create Database"**
5. Wait for it to provision (~1 minute)

### 2. Connect Database to Web Service

1. Go to your **Web Service** (rc-inv)
2. Go to **"Environment"** tab
3. Render should auto-suggest connecting the database
   - OR manually add: `DATABASE_URL` = (copy "Internal Database URL" from your PostgreSQL database)

### 3. Add Environment Variables

Make sure these are set in your web service:

```
NODE_ENV=production
PORT=10000
JWT_SECRET=rc-inv-super-secret-key-change-this-in-production-2024
UNLOCK_CODE=UNLIMITED2024
EMAIL_USER=kitiwiel@gmail.com
EMAIL_PASS=vcoyxtzhwnhnatzi
EMAIL_TO=kitiwiel@gmail.com
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@rcinv.local
ADMIN_PASSWORD=admin123
DATABASE_URL=(automatically added by Render when you connect PostgreSQL)
```

### 4. Deploy

1. Render will automatically redeploy with the new database
2. The PostgreSQL tables will be created on first startup
3. Admin account will be auto-created

## ✅ Benefits

- **Data persists** across deployments
- **No more resets** when you push code changes
- **Free tier** gives you 500 MB storage
- **Automatic backups** (on paid plans)

## ⚠️ Important Notes

**Free PostgreSQL expires after 90 days**
- Render will email you before expiration
- You can create a new free database and migrate data
- Or upgrade to a paid plan ($7/month) for permanent storage

**Local Development**
- Still uses SQLite locally
- Use `./backup-db.sh` and `./restore-db.sh` for local persistence
- Production and local databases are separate

## 🔄 Migration

When you first deploy with PostgreSQL:
- Database starts empty
- Admin account auto-creates on startup
- Users need to sign up again
- This is normal - it's a fresh database!

## 🆘 Troubleshooting

**Database not connecting?**
- Check `DATABASE_URL` is set in environment variables
- Make sure PostgreSQL database is "Available" status
- Check logs for connection errors

**Data still resetting?**
- Verify you're using the "Internal Database URL" not "External"
- Make sure DATABASE_URL is set before deploying
- Check server logs for "Using PostgreSQL database" message

## 📊 Checking Your Database

View PostgreSQL dashboard:
1. Go to your PostgreSQL database in Render
2. Click "Connect" to get connection commands
3. Use any PostgreSQL client to inspect data
