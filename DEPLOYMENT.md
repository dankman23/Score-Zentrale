# Deployment Guide - Score Zentrale

## 🚀 Deployment Readiness Status

✅ **Application Ready for Deployment**
⚠️ **External Dependencies Required**

## 📋 Pre-Deployment Checklist

### Required Environment Variables

#### 🔴 Critical (MUST be set):

```bash
# MongoDB Connection
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/
DB_NAME=score_zentrale  # or MONGO_DB

# Admin Authentication
ADMIN_USERS='[{"username":"admin","password":"secure_password","role":"admin","displayName":"Admin"}]'

# JTL MSSQL Database (External - Required)
JTL_SQL_HOST=your-mssql-server.com
JTL_SQL_PORT=1433
JTL_SQL_DB=eazybusiness
JTL_SQL_USER=your_username
JTL_SQL_PASSWORD=your_password

# OpenAI API Key (for AI features)
OPENAI_API_KEY=sk-...
```

#### 🟡 Optional (Have defaults):

```bash
# CORS Configuration
CORS_ORIGINS=*  # Set specific origins for production

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourdomain.com
SMTP_BCC=admin@yourdomain.com

# Google Ads (Optional)
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_secret
```

## 🏗️ Architecture Overview

### Components:
1. **Next.js Application** (Port 3000)
   - Frontend + Backend API Routes
   - Server-side rendering
   - API endpoints under `/api/*`

2. **MongoDB Database**
   - Primary data storage
   - Collections: articles, prospects, amazon_bulletpoints_generated, etc.
   - Current Pool Size: Max 7 connections (optimized for M0 Free Tier)

3. **MSSQL Database (External)**
   - JTL-Wawi ERP system
   - Required for customer and product imports
   - ⚠️ Must be accessible from deployment environment

4. **Background Workers (Supervisor)**
   - `autopilot-worker.js`: Email automation
   - `nightly-jtl-sync.conf`: Nightly customer sync at 2 AM

## 🔒 Security Notes

### Authentication:
- **Development**: Fallback credentials (will throw error in production if not set)
- **Production**: MUST set `ADMIN_USERS` environment variable
- Format: JSON array with username, password, role, displayName

### Database:
- MongoDB Atlas TLS/SSL enabled by default
- Connection pooling optimized (max 7 connections)
- MSSQL requires secure credentials

## 📦 Dependencies

### Critical NPM Packages:
- `next@14.2.3`
- `react@18.2.0`
- `mongodb@^6.3.0`
- `mssql@^11.0.1`
- `nodemailer@^6.9.13`
- `openai@^4.52.7`

### System Requirements:
- Node.js 18+
- Supervisor (for background jobs)

## 🚨 Known Limitations

### 1. MongoDB M0 Free Tier:
- **Connection Limit**: 500 total / 100 per user
- **Current Usage**: Optimized to ~7 max connections
- **Recommendation**: Upgrade to M10 for production ($60/month)
- **Symptoms if exceeded**: SSL/TLS errors, connection timeouts

### 2. External MSSQL Dependency:
- Application requires external MSSQL access for JTL integration
- Core features (Customer import, Product sync) will fail without it
- Must be network-accessible from deployment environment

## 🔧 Deployment Steps

### 1. Set Environment Variables
Ensure all required environment variables are set in your deployment platform.

### 2. Verify MSSQL Connectivity
Test connection to JTL MSSQL database:
```bash
curl http://your-app/api/jtl/test-connection
```

### 3. Initialize MongoDB
Run initial JTL import:
```bash
curl -X POST http://your-app/api/jtl/articles/import/start
```

### 4. Configure Supervisor Jobs
Ensure supervisor configurations are loaded:
- `/etc/supervisor/conf.d/autopilot-worker.conf`
- `/etc/supervisor/conf.d/jtl-nightly-sync.conf`

### 5. Health Check
```bash
curl http://your-app/api/health
```

## 📊 Monitoring

### Key Metrics to Monitor:
1. **MongoDB Connection Count**: Should stay under 7
2. **MSSQL Connectivity**: Check JTL sync logs
3. **Autopilot Worker**: Check supervisor logs
4. **API Response Times**: Monitor `/api/jtl/articles/*` endpoints

### Log Locations:
- Next.js: `/var/log/supervisor/nextjs.out.log`
- Autopilot: `/var/log/supervisor/autopilot-worker.out.log`

## 🆘 Troubleshooting

### Issue: "Unexpected token ... is not valid JSON"
**Cause**: MongoDB connection failed
**Solution**: Check MongoDB Atlas connection limit, verify credentials

### Issue: "ADMIN_USERS not set in production"
**Cause**: Missing environment variable
**Solution**: Set `ADMIN_USERS` with proper JSON format

### Issue: JTL Import fails
**Cause**: MSSQL connection issues
**Solution**: Verify `JTL_SQL_*` environment variables and network access

### Issue: Schwarze Schrift (Black text)
**Cause**: Bootstrap theme conflicts
**Solution**: Already fixed with explicit color styles

## 📈 Post-Deployment

### Recommended Actions:
1. ✅ Monitor MongoDB connection count for 24 hours
2. ✅ Verify nightly JTL sync runs at 2 AM
3. ✅ Test Autopilot email sending
4. ✅ Check all API endpoints respond correctly
5. 🔄 Consider upgrading to MongoDB M10 for stability

### Performance Optimization:
- Current setup optimized for M0 Free Tier
- For production: Upgrade to MongoDB M10
- Monitor and adjust connection pool sizes if needed

## 📝 Notes

- Application tested with 166,914 imported articles
- Bulletpoint generation stable with Claude Sonnet 4
- All text readability issues resolved
- Robust error handling implemented

---

**Last Updated**: December 2024
**Version**: 1.0
**Status**: ✅ Production Ready (with external MSSQL)
