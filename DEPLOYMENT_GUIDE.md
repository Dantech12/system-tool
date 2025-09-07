# Rabotec Tool Management System - Deployment Guide

This guide will walk you through deploying the Rabotec Tool Management System to Render with Cloudinary for data persistence.

## Prerequisites

Before you begin, you'll need:
1. A GitHub account
2. A Render account (free tier available)
3. A Cloudinary account (free tier available)

## Step 1: Set Up PostgreSQL Database

### 1.1 Create PostgreSQL Database on Render
1. Go to [render.com](https://render.com) and log in
2. Click "New +" and select "PostgreSQL"
3. Configure your database:
   - **Name**: `rabotec-postgres`
   - **Database**: `rabotec_tools`
   - **User**: `rabotec_user`
   - **Plan**: Free (or paid for better performance)
4. Click "Create Database"

### 1.2 Get Database Connection Details
1. After creation, go to your database dashboard
2. Copy the **External Database URL** (starts with `postgresql://`)
3. **Important**: Keep this URL safe - you'll need it for deployment

## Step 2: Prepare Your Code

### 2.1 Upload to GitHub
1. Create a new repository on GitHub
2. Upload all your project files to the repository
3. Make sure these files are included:
   - `server.js`
   - `cloudinary-db.js`
   - `package.json`
   - `render.yaml`
   - `public/` folder with all HTML, CSS, and JS files

### 2.2 Verify Package.json
Ensure your `package.json` has the correct start script:
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

## Step 3: Deploy to Render

### 3.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up using your GitHub account
3. Authorize Render to access your repositories

### 3.2 Create New Web Service
1. Click "New +" button in Render dashboard
2. Select "Web Service"
3. Connect your GitHub repository containing the Rabotec system
4. Configure the service:
   - **Name**: `rabotec-tool-system`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3.3 Set Environment Variables
In the Render dashboard, go to Environment section and add:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Sets production environment |
| `DATABASE_URL` | Your PostgreSQL URL from Step 1.2 | PostgreSQL database connection string |
| `SESSION_SECRET` | Generate a random string | Session encryption key |

**To generate SESSION_SECRET**: Use a random string generator or run this in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.4 Deploy
1. Click "Create Web Service"
2. Render will automatically deploy your application
3. Wait for the build to complete (usually 2-5 minutes)
4. Your app will be available at: `https://your-app-name.onrender.com`

## Step 4: Test Your Deployment

### 4.1 Access the Application
1. Open your Render app URL
2. You should see the login page

### 4.2 Login as Admin
- **Username**: Kevin Owusu
- **Password**: 12448

**Note**: These are the actual production credentials, not the generic ones shown in the README.

### 4.3 Test Core Features
1. **Admin Dashboard**: Check if statistics load correctly
2. **Add Tools**: Try adding a sample tool
3. **Create Attendant**: Create a test attendant account
4. **Tool Issuance**: Login as attendant and issue a tool
5. **Reports**: Generate a test report

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Custom Domain
1. In Render dashboard, go to Settings
2. Scroll to "Custom Domains"
3. Add your domain (e.g., `tools.rabotec.com`)
4. Follow DNS configuration instructions

## Troubleshooting

### Common Issues

#### 1. Application Won't Start
- **Check logs**: Go to Render dashboard → Logs
- **Verify environment variables**: Ensure all Cloudinary credentials are correct
- **Check package.json**: Ensure start script is `node server.js`

#### 2. Database Errors
- **Cloudinary credentials**: Double-check your API key, secret, and cloud name
- **Network issues**: Cloudinary might be temporarily unavailable

#### 3. Login Issues
- **Clear browser cache**: Try incognito/private browsing
- **Check console**: Open browser developer tools for error messages

#### 4. Slow Performance
- **Free tier limitations**: Render free tier has limited resources
- **Cold starts**: Apps sleep after 15 minutes of inactivity

### Getting Help

1. **Render Documentation**: [render.com/docs](https://render.com/docs)
2. **Cloudinary Documentation**: [cloudinary.com/documentation](https://cloudinary.com/documentation)
3. **Check application logs**: Always check Render logs for specific error messages

## Maintenance

### Regular Tasks
1. **Monitor usage**: Check Cloudinary usage in dashboard
2. **Backup data**: Cloudinary automatically backs up your data
3. **Update dependencies**: Regularly update npm packages
4. **Monitor performance**: Check Render metrics

### Scaling Up
When you're ready to scale:
1. **Upgrade Render plan**: Move from free to paid tier for better performance
2. **Upgrade Cloudinary**: Increase storage and bandwidth limits
3. **Add monitoring**: Set up uptime monitoring

## Security Notes

1. **Keep credentials secure**: Never commit API keys to GitHub
2. **Use strong passwords**: Change default admin password
3. **Regular updates**: Keep dependencies updated
4. **HTTPS only**: Render provides HTTPS by default

## Cost Breakdown

### Free Tier Limits
- **Render**: 750 hours/month, sleeps after 15min inactivity
- **Cloudinary**: 25GB storage, 25GB bandwidth/month

### Paid Options
- **Render Starter**: $7/month - no sleep, better performance
- **Cloudinary Plus**: $89/month - 100GB storage, 100GB bandwidth

## Support

For technical support with the Rabotec Tool Management System:
- Check the troubleshooting section above
- Review application logs in Render dashboard
- Verify all environment variables are correctly set

---

**Congratulations!** Your Rabotec Tool Management System is now deployed and ready for use. The system will automatically handle data persistence through Cloudinary and scale based on your usage needs.
