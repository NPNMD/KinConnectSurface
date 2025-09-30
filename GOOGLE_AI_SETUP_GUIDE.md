# Google AI (Gemini) API Setup Guide

This guide will walk you through setting up Google AI (Gemini) API for the visit summary feature in KinConnect.

## ⚠️ Prerequisites

Before starting, ensure you have:
- A Google account
- Firebase CLI installed (`npm install -g firebase-tools`)
- Access to your Firebase project
- Node.js installed (for running verification scripts)

## 🔑 Getting Your Google AI API Key

### Step 1: Access Google AI Studio
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account (use the same account as your Firebase project if possible)

### Step 2: Create API Key
1. Click on **"Get API key"** in the left sidebar
2. Click **"Create API key"**
3. Select **"Create API key in new project"** or choose an existing Google Cloud project
4. Copy the generated API key (it starts with `AIza...`)
5. **Important**: Store this key securely - you won't be able to see it again

### Step 3: Enable the Generative Language API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Generative Language API" or "Gemini API"
5. Click on it and press **"Enable"**
6. **Wait 5-10 minutes** for the API to be fully enabled

## 🔧 Configuring the API Key in Firebase

### Option 1: Using Firebase CLI (Recommended)
```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Set the secret in your Firebase project
firebase functions:secrets:set GOOGLE_AI_API_KEY
# When prompted, paste your API key (AIza...)

# Deploy functions to make the secret available
firebase deploy --only functions
```

### Option 2: Using Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **Security > Secret Manager**
4. Click **"Create Secret"**
5. Name: `GOOGLE_AI_API_KEY`
6. Value: Your API key (starts with `AIza...`)
7. Click **"Create"**

## 📦 Installing Dependencies

### 1. Install Google AI Package in Functions
```bash
cd functions
npm install @google/generative-ai
```

### 2. Update Functions Configuration
The functions are already configured to use the Google AI API key. The secret is defined in [`functions/src/index.ts`](functions/src/index.ts:22):

```typescript
const googleAIApiKey = defineSecret('GOOGLE_AI_API_KEY');
```

## 🚀 Deployment Steps

### 1. Deploy Functions
```bash
# From the root directory
firebase deploy --only functions
```

### 2. Verify Deployment
Check the Firebase Console > Functions to ensure the new visit summary endpoints are deployed:
- `POST /visit-summaries`
- `GET /visit-summaries/:patientId`
- `GET /visit-summaries/:patientId/:summaryId`
- `PUT /visit-summaries/:patientId/:summaryId`
- `DELETE /visit-summaries/:patientId/:summaryId`
- `POST /visit-summaries/:patientId/:summaryId/retry-ai`

## ✅ Verification Steps

### 1. Run the Verification Script
We've created a comprehensive verification script to test your setup:

```bash
# Set your API key temporarily for testing
export GOOGLE_AI_API_KEY=your_api_key_here

# Run the verification script
node scripts/verify-google-ai-setup.cjs
```

The script will check:
- ✅ If the API key is set
- ✅ If the API key format is valid
- ✅ If the API is accessible
- ✅ Which Gemini models are available
- ✅ If the Generative Language API is enabled

### 2. Expected Output
If everything is configured correctly, you should see:

```
🔍 Google AI API Setup Verification
============================================================
Step 1: Checking API Key
✅ GOOGLE_AI_API_KEY is set
ℹ️  Key format: AIzaSyBxxx...xxxx

Step 2: Validating API Key Format
✅ API key format looks correct

Step 3: Testing API Connectivity
ℹ️  Testing connection to Google AI API...
✅ Successfully connected to Google AI API
ℹ️  Found 5 available models

Step 4: Testing Model Availability
ℹ️  Testing which Gemini models are available...

  Testing gemini-1.5-flash-latest... ✅ Available
  Testing gemini-1.5-flash-001... ✅ Available
  Testing gemini-1.5-pro-latest... ✅ Available
  Testing gemini-1.5-pro-001... ✅ Available
  Testing gemini-pro... ✅ Available

📊 Verification Summary
✅ 5 model(s) available

💡 Recommendations
✅ Your Google AI API is properly configured!
```

### 3. Troubleshooting Verification Failures

#### If API key is not set:
```bash
# Set it temporarily
export GOOGLE_AI_API_KEY=your_api_key_here

# Or set it permanently in your shell profile
echo 'export GOOGLE_AI_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

#### If API returns 403 (Forbidden):
- The Generative Language API is not enabled
- Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
- Click "Enable"
- Wait 5-10 minutes and run verification again

#### If no models are available:
- The API was just enabled - wait 5-10 minutes
- Check your Google Cloud project has billing enabled (free tier is sufficient)
- Verify you're using the correct API key

### 4. Check Function Logs (After Deployment)
```bash
firebase functions:log --only api
```

## 💰 Pricing Information

### Google AI (Gemini) Pricing
- **Gemini Pro**: Free tier includes 60 requests per minute
- **Pay-as-you-go**: $0.00025 per 1K characters for input, $0.0005 per 1K characters for output
- **Rate Limits**: 60 requests per minute (free tier)

### Cost Estimation for Visit Summaries
- Average visit summary: ~500 characters input + ~300 characters output
- Cost per summary: ~$0.0004 (less than half a cent)
- 1000 summaries per month: ~$0.40

## 🔒 Security Best Practices

### 1. API Key Security
- ✅ Store API key in Firebase Secrets (not in code)
- ✅ Use server-side processing only (never expose key to client)
- ✅ Implement rate limiting in your functions
- ✅ Monitor usage in Google Cloud Console

### 2. Content Filtering
The implementation includes safety settings for medical content:

```typescript
const GOOGLE_AI_CONFIG = {
  model: 'gemini-pro',
  temperature: 0.3, // Lower for medical accuracy
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_MEDICAL',
      threshold: 'BLOCK_NONE' // Allow medical content
    }
  ]
};
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "API key not found" Error in Firebase Functions
**Symptoms**: Functions fail with "GOOGLE_AI_API_KEY is not defined"

**Solution**:
```bash
# Verify the secret is set
firebase functions:secrets:access GOOGLE_AI_API_KEY

# If not set, set it now
firebase functions:secrets:set GOOGLE_AI_API_KEY

# Redeploy functions
firebase deploy --only functions
```

#### 2. "Generative AI API not enabled" Error
**Symptoms**: API returns 403 Forbidden or "API not enabled"

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Generative Language API"
5. Click **"Enable"**
6. **Wait 5-10 minutes** for propagation
7. Run verification script again: `node scripts/verify-google-ai-setup.cjs`

#### 3. "Quota exceeded" Error
**Symptoms**: API returns 429 Too Many Requests

**Solution**:
- Check usage in [Google Cloud Console](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
- Free tier: 60 requests per minute
- If needed, upgrade to paid tier
- Implement request queuing for high volume

#### 4. "Invalid API key" Error
**Symptoms**: API returns 400 or 403 with "invalid API key"

**Solution**:
1. Verify API key format (should start with `AIza`)
2. Regenerate API key in [Google AI Studio](https://aistudio.google.com/)
3. Update the secret in Firebase:
   ```bash
   firebase functions:secrets:set GOOGLE_AI_API_KEY
   ```
4. Redeploy functions:
   ```bash
   firebase deploy --only functions
   ```

#### 5. "No available models" Error
**Symptoms**: Verification script shows no models available

**Solution**:
1. Ensure Generative Language API is enabled
2. Check your Google Cloud project has billing enabled (free tier works)
3. Wait 5-10 minutes after enabling the API
4. Verify you're using the correct Google Cloud project

#### 6. Functions Deployment Fails
**Symptoms**: `firebase deploy --only functions` fails

**Solution**:
```bash
# Check if secret exists
firebase functions:secrets:access GOOGLE_AI_API_KEY

# If it doesn't exist, create it
firebase functions:secrets:set GOOGLE_AI_API_KEY

# Make sure you're in the right project
firebase use --add

# Try deploying again
firebase deploy --only functions
```

### Debug Commands
```bash
# Check function logs
firebase functions:log --only api

# Test function locally (requires emulator setup)
firebase emulators:start --only functions

# Check if secret is accessible
firebase functions:secrets:access GOOGLE_AI_API_KEY

# List all secrets
firebase functions:secrets:list

# Run verification script
node scripts/verify-google-ai-setup.cjs

# Check Firebase project
firebase projects:list
firebase use
```

### Getting Help

If you're still experiencing issues:

1. **Check the diagnostic logs**:
   ```bash
   firebase functions:log --only api
   ```

2. **Run the verification script with your API key**:
   ```bash
   GOOGLE_AI_API_KEY=your_key node scripts/verify-google-ai-setup.cjs
   ```

3. **Verify your Firebase project settings**:
   - Ensure you're using the correct project: `firebase use`
   - Check that Functions are enabled in Firebase Console

4. **Check Google Cloud Console**:
   - Verify billing is enabled (free tier is sufficient)
   - Check API quotas and usage
   - Ensure Generative Language API is enabled

## 📚 Additional Resources

- [Google AI Studio Documentation](https://ai.google.dev/docs)
- [Gemini API Reference](https://ai.google.dev/api/rest)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)

## 🎯 Quick Start Checklist

Use this checklist to ensure everything is set up correctly:

- [ ] **Get API Key** from [Google AI Studio](https://aistudio.google.com/)
- [ ] **Enable Generative Language API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com)
- [ ] **Wait 5-10 minutes** for API to be fully enabled
- [ ] **Run verification script**: `GOOGLE_AI_API_KEY=your_key node scripts/verify-google-ai-setup.cjs`
- [ ] **Verify models are available** (script should show ✅ for at least one model)
- [ ] **Set Firebase Function secret**: `firebase functions:secrets:set GOOGLE_AI_API_KEY`
- [ ] **Deploy functions**: `firebase deploy --only functions`
- [ ] **Test in your app** by creating a visit summary
- [ ] **Monitor logs**: `firebase functions:log --only api`

## 📊 Cost Monitoring

### Free Tier Limits
- **60 requests per minute** (sufficient for most use cases)
- **1,500 requests per day** (free tier)

### Monitoring Usage
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Dashboard**
3. Click on **Generative Language API**
4. View usage metrics and quotas

### Cost Optimization Tips
- Use `gemini-1.5-flash-latest` for faster, cheaper responses
- Implement caching for repeated summaries
- Set up usage alerts in Google Cloud Console
- Monitor function execution times

## 🎯 Next Steps

1. ✅ **Get API Key**: Follow steps above to get your Google AI API key
2. ✅ **Enable API**: Enable Generative Language API in Google Cloud Console
3. ✅ **Verify Setup**: Run `node scripts/verify-google-ai-setup.cjs`
4. ✅ **Set Secret**: Configure the key in Firebase Secrets
5. ✅ **Deploy**: Deploy the updated functions
6. ✅ **Test**: Create a test visit summary to verify integration
7. ✅ **Monitor**: Watch logs and usage in Google Cloud Console

The visit summary feature is now ready to use Google AI for intelligent processing of medical visit notes!

## 📚 Additional Resources

- [Google AI Studio](https://aistudio.google.com/) - Get API keys and test models
- [Gemini API Documentation](https://ai.google.dev/docs) - Official API documentation
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager) - Managing secrets
- [Google Cloud Console](https://console.cloud.google.com/) - Manage APIs and billing
- [Generative Language API](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com) - Enable the API