# Environment Variables Guide

Complete reference for all environment variables required by ChatApp Server.

## Overview

Environment variables are stored in `.env` file in the server root directory. Never commit `.env` to version control.

## Quick Start

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

## Required Variables

### 🔴 CRITICAL (Must be set in production)

#### `MONGODB_URI`

- **Type:** String (MongoDB connection string)
- **Required:** YES
- **Default:** `mongodb://localhost:27017/chat-app`
- **Example:** `mongodb+srv://user:password@cluster.mongodb.net/chat-app?retryWrites=true&w=majority`
- **Description:** MongoDB database connection URL
- **Notes:**
  - Use MongoDB Atlas for cloud hosting: https://www.mongodb.com/cloud/atlas
  - For local development: `mongodb://localhost:27017/chat-app`
  - Must have `chat-app` database created

#### `JWT_SECRET`

- **Type:** String (random secret key)
- **Required:** YES
- **Default:** `your_jwt_secret_key_here_change_in_production`
- **Example:** `a7f3k9mL2qP8xJ6vN5wB4cD1eR9sT2uI`
- **Description:** Secret key for signing JWT tokens
- **Notes:**
  - Generate: `openssl rand -hex 32`
  - Change this immediately in production
  - Never share or expose this key

#### `CLIENT_URL`

- **Type:** String (Frontend URL)
- **Required:** YES
- **Default:** `http://localhost:3000`
- **Example:** `https://chatapp.com` or `https://app.chatapp.com`
- **Description:** Frontend application URL for CORS validation
- **Notes:**
  - Must match your frontend's origin exactly
  - Include protocol (http/https) but no trailing slash
  - Used in CORS and email reset links

---

## Email Configuration Variables

#### `EMAIL_SERVICE`

- **Type:** String
- **Required:** For password reset (YES in production)
- **Default:** `gmail`
- **Options:** `gmail`, `outlook`, `yahoo`, `custom`
- **Description:** Email service provider
- **Notes:**
  - For Gmail: Enable "App Passwords" (not regular password)
  - For Outlook: Use business email with App Password
  - For custom: Use SMTP settings

#### `EMAIL_SENDER_USER`

- **Type:** String (email address)
- **Required:** For password reset (YES in production)
- **Default:** None
- **Example:** `noreply@chatapp.com` or `your-email@gmail.com`
- **Description:** Email address from which password reset emails are sent
- **Notes:**
  - Must be verified with your email service
  - Gmail: Use your full Gmail address

#### `EMAIL_SENDER_PASSWORD`

- **Type:** String (password/app password)
- **Required:** For password reset (YES in production)
- **Default:** None
- **Example:** `xyzabc123def456ghi`
- **Description:** Password or app password for email service
- **Notes:**
  - For Gmail: Generate App Password (not regular password)
  - For Outlook: Use App Password
  - Never use regular passwords in environment variables
  - Keep this secret

#### `FRONTEND_URL`

- **Type:** String (Frontend URL)
- **Required:** For password reset (YES in production)
- **Default:** `http://localhost:3000`
- **Example:** `https://chatapp.com`
- **Description:** Frontend URL for password reset links
- **Notes:**
  - User receives: `https://chatapp.com/reset-password/{token}`
  - Must be accessible by users
  - Should match CLIENT_URL in most cases

---

## Server Configuration Variables

#### `PORT`

- **Type:** Number
- **Required:** NO
- **Default:** `5000`
- **Example:** `3001`, `8000`, `5000`
- **Description:** Server port to listen on
- **Notes:**
  - In production, typically behind a reverse proxy on port 80/443

#### `NODE_ENV`

- **Type:** String (enum)
- **Required:** NO
- **Default:** `development`
- **Options:** `development`, `production`, `staging`, `test`
- **Description:** Application environment
- **Notes:**
  - Controls security settings (HTTPS, error messages, logging)
  - Set to `production` for production deployments
  - Affects cookie secure flag

#### `JWT_EXPIRY`

- **Type:** String (time format)
- **Required:** NO
- **Default:** `7d`
- **Examples:** `7d`, `24h`, `1w`, `30d`
- **Description:** JWT token expiration time
- **Notes:**
  - Format: `${number}${unit}` where unit is `d|h|m|s|ms`
  - Shorter = more secure but requires more login
  - Longer = better UX but higher security risk if token stolen

---

## Complete `.env` Example

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/chat-app?retryWrites=true&w=majority

# JWT
JWT_SECRET=a7f3k9mL2qP8xJ6vN5wB4cD1eR9sT2uI
JWT_EXPIRY=7d

# Frontend
CLIENT_URL=https://chatapp.com
FRONTEND_URL=https://chatapp.com

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_SENDER_USER=noreply@chatapp.com
EMAIL_SENDER_PASSWORD=xyzabc123def456ghi
```

---

## Setup Instructions by Environment

### 🖥️ Local Development

```bash
# Use defaults or customize
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=dev-secret-key-change-in-production
CLIENT_URL=http://localhost:3000
EMAIL_SERVICE=gmail
EMAIL_SENDER_USER=your-email@gmail.com
EMAIL_SENDER_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

**MongoDB Setup:**

```bash
# If using Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Or install locally: https://docs.mongodb.com/manual/installation/
```

### 🌐 Staging Environment

```bash
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@staging-cluster.mongodb.net/chat-app
JWT_SECRET=<generate-new-secret>
CLIENT_URL=https://staging.chatapp.com
EMAIL_SERVICE=gmail
EMAIL_SENDER_USER=noreply-staging@chatapp.com
EMAIL_SENDER_PASSWORD=<app-password>
FRONTEND_URL=https://staging.chatapp.com
```

### 🚀 Production Environment

```bash
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@production-cluster.mongodb.net/chat-app?retryWrites=true&w=majority
JWT_SECRET=<generate-strong-secret>
CLIENT_URL=https://chatapp.com
EMAIL_SERVICE=gmail
EMAIL_SENDER_USER=noreply@chatapp.com
EMAIL_SENDER_PASSWORD=<app-password>
FRONTEND_URL=https://chatapp.com
```

---

## Security Best Practices

### ✅ DO:

- ✅ Generate strong `JWT_SECRET`: `openssl rand -hex 32`
- ✅ Use unique passwords/app passwords for email
- ✅ Store `.env` in secure vaults (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Rotate secrets regularly
- ✅ Use HTTPS in production
- ✅ Use managed databases (MongoDB Atlas, AWS RDS, etc.)
- ✅ Set `NODE_ENV=production` in production

### ❌ DON'T:

- ❌ Commit `.env` to version control
- ❌ Share secrets in chat, email, or Slack
- ❌ Use weak secrets like `123456` or `password`
- ❌ Use the same secrets across environments
- ❌ Use production secrets in development
- ❌ Expose secrets in logs or error messages
- ❌ Use regular passwords for email (use App Passwords)

---

## Generating Secure Values

### JWT_SECRET

```bash
# Generate 32-byte random hex string
openssl rand -hex 32
# Output: a7f3k9mL2qP8xJ6vN5wB4cD1eR9sT2uI

# Or on macOS
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### APP PASSWORDS

**Gmail:**

1. Go to: https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Generate App Password for "Mail" and "Windows Computer"
4. Use the 16-character password

**Outlook:**

1. Go to: https://account.microsoft.com/security
2. Security settings
3. Generate App Password
4. Use the generated password

---

## Troubleshooting

### "MongoDB connection error"

- Check `MONGODB_URI` is correct
- Verify MongoDB is running
- Check network connectivity
- Whitelist your IP on MongoDB Atlas

### "Invalid email configuration"

- Verify `EMAIL_SENDER_USER` is correct email
- Check `EMAIL_SENDER_PASSWORD` is an app password, not regular password
- Ensure email service supports SMTP
- Check firewall isn't blocking port 587 (SMTP)

### "CORS error"

- Ensure `CLIENT_URL` matches your frontend exactly
- No trailing slash
- Include protocol (http/https)
- Check frontend actually uses this URL

### "Cookies not working"

- Ensure `NODE_ENV=production` for HTTPS
- Check `secure: true` is only set with HTTPS
- Verify SameSite cookie policy matches your setup

---

## Environment Variable Validation

Server validates on startup:

- Throws error if `MONGODB_URI` is missing
- Throws error if `JWT_SECRET` is missing
- Throws error if `CLIENT_URL` is missing
- Throws error if production email vars are missing (when `NODE_ENV=production`)

Check logs for validation errors on startup.

---

## References

- [12 Factor App - Config](https://12factor.net/config)
- [OWASP - Sensitive Data Exposure](https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure)
- [Node.js dotenv Package](https://github.com/motdotla/dotenv)
- [MongoDB Connection Strings](https://docs.mongodb.com/manual/reference/connection-string/)
