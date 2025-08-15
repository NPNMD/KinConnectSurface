# KinConnect Setup Guide

This guide will walk you through setting up the KinConnect application on your local machine.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Firebase project (you can use the existing one: `claritystream-uldp9`)
- Google Cloud Console access

## Step 1: Environment Setup

Create a `.env` file in the root directory with the following content:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"claritystream-uldp9","private_key_id":"your_private_key_id","private_key":"your_private_key","client_email":"your_client_email","client_id":"your_client_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"your_cert_url"}

# Client Configuration
VITE_API_URL=http://localhost:5000/api

# Security
SESSION_SECRET=your-super-secret-session-key-here
```

## Step 2: Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`claritystream-uldp9`)
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Copy the entire JSON content to the `FIREBASE_SERVICE_ACCOUNT_KEY` field in your `.env` file

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start Development Servers

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

## Step 5: Verify Setup

1. Open `http://localhost:3000` in your browser
2. You should see the KinConnect landing page
3. Click "Continue with Google" to test authentication
4. After signing in, you'll be redirected to the dashboard

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the PORT in `.env` file
   - Kill processes using the ports: `npx kill-port 3000 5000`

2. **Firebase authentication errors**
   - Verify your service account key is correct
   - Check that Google OAuth is enabled in Firebase
   - Ensure authorized domains include `localhost`

3. **TypeScript errors**
   - Run `npm run type-check` to see detailed errors
   - Make sure all dependencies are installed

4. **Build errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check TypeScript configuration

### Development Tips

- Use `npm run server:dev` to start only the backend
- Use `npm run client:dev` to start only the frontend
- Check the browser console and server logs for errors
- The frontend proxies API calls to the backend automatically

## Next Steps

Once the basic setup is working:

1. **Explore the codebase** - Check out the component structure
2. **Test authentication** - Try signing in with different Google accounts
3. **Add features** - Start implementing medication tracking, appointments, etc.
4. **Customize styling** - Modify the Tailwind configuration and components

## Need Help?

- Check the main README.md for detailed documentation
- Review the API endpoints in the server routes
- Examine the shared types for data structures
- Look at existing components for implementation patterns
