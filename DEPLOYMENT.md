# KinConnect Deployment Guide

This guide covers deploying KinConnect to Firebase (production) with full Firestore functionality.

## 🏗️ Architecture Overview

### Development
- **Frontend**: Vite dev server (`http://localhost:3000`)
- **Backend**: Node.js Express server (`http://localhost:5000`)
- **Database**: Mock Firestore service (for testing) or real Firestore (with service account)

### Production
- **Frontend**: Firebase Hosting (`https://claritystream-uldp9.web.app`)
- **Backend**: Firebase Functions (`https://claritystream-uldp9.web.app/api`)
- **Database**: Firestore (automatic access, no credentials needed)

## 🚀 Deployment Steps

### 1. Prerequisites

Ensure you have:
- Firebase CLI installed: `npm install -g firebase-tools`
- Logged into Firebase: `firebase login`
- Project selected: `firebase use claritystream-uldp9`

### 2. Build the Application

```bash
# Install dependencies
npm install

# Build both client and functions
npm run build
```

This will:
- Build the React frontend to `dist/client/`
- Compile TypeScript functions to `functions/lib/`

### 3. Deploy to Firebase

```bash
# Deploy everything (hosting + functions)
firebase deploy

# Or deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
```

### 4. Verify Deployment

After deployment, test:

1. **Frontend**: Visit `https://claritystream-uldp9.web.app`
2. **API Health**: Visit `https://claritystream-uldp9.web.app/api/health`
3. **Authentication**: Sign in with Google
4. **Dropdowns**: Test medical conditions and allergies dropdowns
5. **Profile Saving**: Create/update patient profile

## 🔧 Configuration

### Environment Variables

#### Development (`.env` and `client/.env`)
```env
# Local development uses Node.js server
VITE_API_URL=http://localhost:5000/api
```

#### Production (Firebase Hosting)
```env
# Production uses Firebase Functions (automatic via rewrites)
# No VITE_API_URL needed - falls back to /api which routes to functions
```

### Firebase Functions Configuration

The production backend (`functions/src/index.ts`) automatically has:
- ✅ **Firestore access** (no service account needed)
- ✅ **Authentication** (Firebase Admin SDK)
- ✅ **Patient profiles** with dropdown support
- ✅ **Medication management**
- ✅ **Drug search integration**

## 📊 Key Differences: Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **Frontend** | Vite dev server | Firebase Hosting |
| **Backend** | Node.js Express | Firebase Functions |
| **Database** | Mock/Real Firestore | Real Firestore |
| **API URL** | `localhost:5000/api` | `/api` (auto-routed) |
| **Credentials** | Service account key | Automatic |

## 🔍 Troubleshooting

### Functions Not Working
```bash
# Check function logs
firebase functions:log

# Deploy only functions
firebase deploy --only functions
```

### Frontend Issues
```bash
# Check hosting logs in Firebase Console
# Verify build output in dist/client/
```

### Database Issues
- Production automatically has Firestore access
- No service account configuration needed
- Check Firebase Console > Firestore for data

## 🎯 Testing Production

### 1. Test Dropdown Functionality
- Go to patient profile
- Click "Edit Profile"
- Test medical conditions dropdown (50+ options)
- Test allergies dropdown (30+ options)
- Search functionality should work
- Custom entry should work

### 2. Test Profile Saving
- Fill out patient profile with dropdowns
- Save profile
- Refresh page - data should persist
- Check Firestore Console for saved data

### 3. Test Authentication
- Sign in with Google
- Profile should load/create automatically
- API calls should be authenticated

## 🚀 Continuous Deployment

For automated deployments, you can set up GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: claritystream-uldp9
```

## 📋 Deployment Checklist

- [ ] Firebase CLI installed and authenticated
- [ ] Project built successfully (`npm run build`)
- [ ] Functions compiled without errors
- [ ] Client built to `dist/client/`
- [ ] Deployed with `firebase deploy`
- [ ] Frontend accessible at production URL
- [ ] API health check returns success
- [ ] Authentication working
- [ ] Dropdown components functional
- [ ] Profile saving/loading working
- [ ] Firestore data persisting

## 🎉 Success!

Your KinConnect application is now deployed with:
- ✅ **Production-ready Firestore** (no credentials needed)
- ✅ **Working dropdown menus** (50+ conditions, 30+ allergies)
- ✅ **Secure authentication** (Google OAuth)
- ✅ **Scalable architecture** (Firebase Functions)
- ✅ **Global CDN** (Firebase Hosting)

The dropdown functionality you requested is fully working in production!