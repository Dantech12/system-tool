# Quick Railway Deployment Checklist

This is a quick reference for deploying the Rabotec Tool Management System to Railway.

## ✅ Pre-Deployment Checklist

### Files Required
- [ ] `server.js` - Main application file
- [ ] `postgres-db.js` - Database connection
- [ ] `package.json` - Dependencies and scripts
- [ ] `railway.json` - Railway configuration
- [ ] `nixpacks.toml` - Build configuration
- [ ] `public/` folder - Frontend files
- [ ] `.env.example` - Environment template

### GitHub Repository
- [ ] Repository is public (required for Railway free tier)
- [ ] All files are committed and pushed
- [ ] Repository is accessible from Railway

## 🚀 Deployment Steps

### 1. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### 2. Add PostgreSQL Database
1. Click "New Service" in your project
2. Select "Database" → "PostgreSQL"
3. Wait for provisioning (1-2 minutes)

### 3. Configure Environment Variables
Go to your web service → Variables tab and add:

| Variable | Value | Example |
|----------|-------|---------|
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | From PostgreSQL service | `postgresql://postgres:...` |
| `SESSION_SECRET` | Random 32-char string | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

### 4. Deploy
1. Railway automatically deploys after configuration
2. Monitor deployment logs
3. Get your app URL from the web service

## 🧪 Testing

### Quick Tests
- [ ] App loads at Railway URL
- [ ] Login page appears
- [ ] Admin login works (Kevin Owusu / 12448)
- [ ] Dashboard loads with statistics
- [ ] Can create a test tool
- [ ] Can create a test attendant

## 🔧 Common Issues

### Build Fails
- Check `package.json` has correct start script
- Verify all dependencies are listed
- Check deployment logs for specific errors

### Database Connection Error
- Verify `DATABASE_URL` is set correctly
- Ensure PostgreSQL service is running
- Check the connection string format

### App Won't Start
- Check environment variables are set
- Verify `SESSION_SECRET` is configured
- Look at deployment logs for errors

## 📞 Need Help?

1. Check the full [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review Railway deployment logs
3. Verify all environment variables
4. Test locally first

## 💡 Pro Tips

- **Free Tier**: Keep app usage under $5/month
- **Monitoring**: Check Railway dashboard regularly
- **Updates**: Push to GitHub to auto-deploy
- **Backups**: Railway auto-backs up PostgreSQL
- **Custom Domain**: Add in Railway settings

---

**Happy Deploying! 🎉**
