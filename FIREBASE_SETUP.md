# Firebase/Firestore Production Setup Guide

This guide will help you set up Firebase Admin SDK credentials for production Firestore access.

## Current Issue

The server is currently using a mock Firestore service for development because it can't connect to the real Firestore database. This happens because Firebase Admin SDK needs proper authentication credentials.

## Production Setup Options

### Option 1: Service Account Key (Recommended)

#### Step 1: Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `claritystream-uldp9`
3. Click the gear icon ⚙️ > **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (e.g., `claritystream-uldp9-firebase-adminsdk-xxxxx.json`)

#### Step 2: Add Credentials to Environment

**Option A: Environment Variable (Recommended for Production)**
1. Open the downloaded JSON file
2. Copy the entire JSON content
3. Add to your `.env` file:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"claritystream-uldp9",...}
```

**Option B: File Path (Alternative)**
1. Place the JSON file in your project root (e.g., `firebase-service-account.json`)
2. Add to `.gitignore`:
```
firebase-service-account.json
```
3. Update `server/firebase-admin.ts` to use file path:
```typescript
const serviceAccount = require('../firebase-service-account.json');
```

#### Step 3: Update Environment Variables

Add to your `.env` file:
```env
# Firebase Service Account (for Firestore access)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"claritystream-uldp9","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@claritystream-uldp9.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-...%40claritystream-uldp9.iam.gserviceaccount.com"}
```

### Option 2: Application Default Credentials (Development)

For local development, you can use Firebase CLI:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Set project: `firebase use claritystream-uldp9`

## Deployment Considerations

### For Firebase Hosting
When deploying to Firebase Hosting, the service account credentials are automatically available.

### For Other Hosting Platforms
Set the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable in your hosting platform:

- **Vercel**: Add in Environment Variables section
- **Netlify**: Add in Site Settings > Environment Variables
- **Heroku**: Use `heroku config:set FIREBASE_SERVICE_ACCOUNT_KEY="..."`

## Security Best Practices

1. **Never commit service account keys to version control**
2. **Use environment variables for all credentials**
3. **Restrict service account permissions** (only Firestore access needed)
4. **Rotate keys regularly**
5. **Monitor usage in Firebase Console**

## Testing the Setup

After adding credentials, restart your server:
```bash
npm run dev
```

You should see:
```
✅ Firebase Admin initialized with service account credentials
🚀 KinConnect server running on port 5000
```

Instead of:
```
⚠️ Using mock database service for development
```

## Troubleshooting

### "Could not load the default credentials" Error
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is properly set in `.env`
- Check that the JSON is valid (no extra quotes or escaping issues)
- Verify the service account has Firestore permissions

### "Permission denied" Errors
- Check that the service account has the correct IAM roles:
  - Firebase Admin SDK Administrator Service Agent
  - Cloud Datastore User

### Environment Variable Issues
- Ensure `.env` file is in the project root
- Check that `dotenv` is loading the file correctly
- Verify no extra spaces or quotes around the JSON

## Quick Setup Script

Here's what you need to do right now:

1. **Download service account key** from Firebase Console
2. **Copy the JSON content** 
3. **Add to `.env` file**:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...your_full_json_here...}
```
4. **Restart the server**: `npm run dev`

The server will automatically detect the credentials and switch from mock to real Firestore!