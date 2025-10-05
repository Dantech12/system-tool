# Rabotec Tool Management System - Railway Deployment Guide

This comprehensive guide will walk you through deploying the Rabotec Tool Management System to Railway with PostgreSQL for data persistence. This guide is designed for beginners and includes step-by-step instructions with screenshots and troubleshooting tips.

## 🚀 What is Railway?

Railway is a modern cloud platform that makes it easy to deploy applications. It automatically handles:
- Building your application
- Setting up databases
- Managing environment variables
- Providing HTTPS certificates
- Scaling your application

## 📋 Prerequisites

Before you begin, you'll need:
1. **A GitHub account** - [Sign up here](https://github.com)
2. **A Railway account** - [Sign up here](https://railway.app) (free tier available)
3. **Basic understanding of environment variables** (we'll explain this)
4. **Your project files ready** (we'll help you prepare them)

## 📁 Step 1: Prepare Your Code Repository

### 1.1 Upload to GitHub

1. **Create a new repository on GitHub:**
   - Go to [github.com](https://github.com)
   - Click the green "New" button
   - Name your repository (e.g., "rabotec-tool-system")
   - Make it **Public** (required for Railway free tier)
   - Click "Create repository"

2. **Upload your project files:**
   - You can use GitHub's web interface to drag and drop files
   - Or use Git commands if you're familiar with them
   - Make sure ALL these files are included:
     - `server.js` (main application file)
     - `postgres-db.js` (database connection file)
     - `package.json` (dependencies and scripts)
     - `railway.json` (Railway configuration - already created)
     - `nixpacks.toml` (build configuration - already created)
     - `public/` folder with all HTML, CSS, and JS files
     - `.env.example` (environment variables template)

### 1.2 Verify Your Files

Double-check that your `package.json` looks like this:
```json
{
  "name": "industrial-tool-management",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "multer": "^1.4.5-lts.1",
    "pdfkit": "^0.13.0",
    "pg": "^8.11.3",
    "xlsx": "^0.18.5"
  }
}
```

## 🚂 Step 2: Create Railway Account and Project

### 2.1 Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Click "Login" in the top right
3. Choose "Login with GitHub" (recommended)
4. Authorize Railway to access your GitHub account
5. Complete your profile setup

### 2.2 Create a New Project

1. **In your Railway dashboard:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository from the list
   - Click "Deploy Now"

2. **Railway will automatically:**
   - Detect that it's a Node.js project
   - Install dependencies
   - Try to build your application

⚠️ **Don't worry if the build fails initially** - we need to set up the database first!

## 🗄️ Step 3: Set Up PostgreSQL Database

### 3.1 Add PostgreSQL to Your Project

1. **In your Railway project dashboard:**
   - Click "New Service"
   - Select "Database"
   - Choose "PostgreSQL"
   - Railway will automatically create and configure the database

2. **Wait for provisioning:**
   - This usually takes 1-2 minutes
   - You'll see a green "Active" status when ready

### 3.2 Get Database Connection Details

1. **Click on your PostgreSQL service**
2. **Go to the "Connect" tab**
3. **Copy the "DATABASE_URL"** - it looks like:
   ```
   postgresql://postgres:password@hostname:port/railway
   ```
4. **Keep this URL safe** - you'll need it in the next step

## ⚙️ Step 4: Configure Environment Variables

### 4.1 Set Up Environment Variables

Environment variables are secure ways to store sensitive information like database passwords.

1. **In your Railway project, click on your web service (not the database)**
2. **Go to the "Variables" tab**
3. **Add these variables one by one:**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `NODE_ENV` | `production` | Tells the app it's running in production |
| `DATABASE_URL` | *Your PostgreSQL URL from Step 3.2* | Database connection string |
| `SESSION_SECRET` | *Generate a random string* | Session encryption key |

### 4.2 Generate SESSION_SECRET

**Option 1: Online Generator (Easy)**
- Go to [passwordsgenerator.net](https://passwordsgenerator.net)
- Generate a 32-character random string
- Use only letters and numbers

**Option 2: Command Line (Advanced)**
If you have Node.js installed locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example SESSION_SECRET:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### 4.3 Save Variables

1. Click "Add Variable" for each one
2. Enter the name and value
3. Click "Add" to save each variable

## 🚀 Step 5: Deploy Your Application

### 5.1 Trigger Deployment

1. **Go back to your web service**
2. **Click "Deploy"** or wait for automatic deployment
3. **Monitor the build logs:**
   - Click on "Deployments" tab
   - Click on the latest deployment
   - Watch the logs for any errors

### 5.2 Check Deployment Status

**Successful deployment indicators:**
- ✅ Build completed successfully
- ✅ Application is running
- ✅ You can see "Server starting..." in the logs
- ✅ Railway provides a public URL

**Your app will be available at:** `https://your-app-name.up.railway.app`

## 🧪 Step 6: Test Your Deployment

### 6.1 Access the Application

1. **Click on your web service**
2. **Go to "Settings" tab**
3. **Find "Public Networking"**
4. **Click on the generated URL**

You should see the login page!

### 6.2 Test Login

Use the default admin credentials:
- **Username:** Kevin Owusu
- **Password:** 12448

### 6.3 Test Core Features

1. **Admin Dashboard:** Check if statistics load correctly
2. **Add Tools:** Try adding a sample tool
3. **Create Attendant:** Create a test attendant account
4. **Tool Issuance:** Login as attendant and issue a tool
5. **Reports:** Generate a test report

## 🌐 Step 7: Custom Domain (Optional)

### 7.1 Add Your Own Domain

If you have a custom domain (like `tools.yourcompany.com`):

1. **In Railway, go to your web service**
2. **Settings tab → Custom Domain**
3. **Add your domain**
4. **Update your DNS settings** as instructed by Railway
5. **Wait for SSL certificate** (automatic)

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. "Application Error" or Won't Start

**Symptoms:** App shows error page or won't load

**Solutions:**
- Check the deployment logs in Railway dashboard
- Verify all environment variables are set correctly
- Ensure `DATABASE_URL` is correct
- Check that `package.json` has the right start script

#### 2. Database Connection Errors

**Symptoms:** "Connection refused" or "Database error" messages

**Solutions:**
- Verify `DATABASE_URL` is copied correctly
- Ensure PostgreSQL service is running (green status)
- Check that the database URL includes the correct password

#### 3. Session/Login Issues

**Symptoms:** Can't login or session expires immediately

**Solutions:**
- Verify `SESSION_SECRET` is set
- Clear browser cache and cookies
- Try incognito/private browsing mode

#### 4. Build Failures

**Symptoms:** Deployment fails during build

**Solutions:**
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility
- Look for syntax errors in your code

#### 5. Slow Performance

**Symptoms:** App loads slowly or times out

**Solutions:**
- Railway free tier has resource limitations
- Consider upgrading to a paid plan for better performance
- Optimize your database queries

### Getting Help

1. **Railway Documentation:** [docs.railway.app](https://docs.railway.app)
2. **Railway Discord:** [railway.app/discord](https://railway.app/discord)
3. **Check deployment logs:** Always check Railway logs for specific error messages
4. **GitHub Issues:** Create an issue in your repository for code-specific problems

## 💰 Cost Breakdown

### Railway Free Tier
- **$5 credit per month** (no credit card required)
- **500 hours of usage** (about 20 days of continuous running)
- **1GB RAM, 1 vCPU** per service
- **1GB disk space**
- **Perfect for testing and small applications**

### Railway Pro Plan
- **$20/month** for the team
- **$0.000463 per GB-hour** for usage
- **Better performance and reliability**
- **More resources and priority support**

### Typical Monthly Costs (Free Tier)
- **Small usage:** $0-3 (within free credits)
- **Medium usage:** $3-5 (may exceed free credits)
- **Heavy usage:** $5+ (definitely need paid plan)

## 🔒 Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env` files to GitHub
- ✅ Use Railway's variable system for secrets
- ✅ Regularly rotate your `SESSION_SECRET`

### 2. Database Security
- ✅ Railway PostgreSQL is automatically secured
- ✅ Use strong passwords (Railway generates these)
- ✅ Regularly backup your data

### 3. Application Security
- ✅ Keep dependencies updated
- ✅ Change default admin password
- ✅ Use HTTPS only (Railway provides this automatically)

## 📊 Monitoring and Maintenance

### Regular Tasks

1. **Monitor Usage:**
   - Check Railway dashboard for resource usage
   - Monitor your monthly credits/costs

2. **Update Dependencies:**
   - Regularly update npm packages
   - Test updates in a development environment first

3. **Backup Data:**
   - Railway automatically backs up PostgreSQL
   - Consider additional backups for critical data

4. **Monitor Performance:**
   - Check application logs regularly
   - Monitor response times and errors

### Scaling Up

When you're ready to scale:

1. **Upgrade Railway Plan:**
   - Move from free to Pro for better performance
   - Get more resources and priority support

2. **Optimize Database:**
   - Add database indexes for better performance
   - Consider connection pooling for high traffic

3. **Add Monitoring:**
   - Set up uptime monitoring
   - Add error tracking and logging

## 🎉 Congratulations!

Your Rabotec Tool Management System is now deployed on Railway! Here's what you've accomplished:

✅ **Deployed a full-stack Node.js application**
✅ **Set up a PostgreSQL database**
✅ **Configured environment variables securely**
✅ **Got a public URL with HTTPS**
✅ **Learned Railway deployment basics**

## 📞 Support

For technical support with the Rabotec Tool Management System:

1. **Check this guide first** - most issues are covered here
2. **Review Railway logs** - they often contain the exact error
3. **Verify environment variables** - most issues are configuration-related
4. **Test locally first** - ensure your code works before deploying

## 🔄 Making Updates

To update your deployed application:

1. **Make changes to your code**
2. **Commit and push to GitHub**
3. **Railway automatically redeploys** (usually within 1-2 minutes)
4. **Monitor the deployment logs**

## 📚 Additional Resources

- **Railway Documentation:** [docs.railway.app](https://docs.railway.app)
- **Node.js Best Practices:** [nodejs.org/en/docs/guides](https://nodejs.org/en/docs/guides)
- **PostgreSQL Documentation:** [postgresql.org/docs](https://postgresql.org/docs)
- **Express.js Guide:** [expressjs.com/en/guide](https://expressjs.com/en/guide)

---

**Happy Deploying! 🚀**

Your Rabotec Tool Management System is now live and ready to help manage your industrial tools efficiently. The system will automatically handle data persistence through PostgreSQL and scale based on your usage needs.
