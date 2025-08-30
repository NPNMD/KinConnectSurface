# Google AI (Gemini) API Setup Guide

This guide will walk you through setting up Google AI (Gemini) API for the visit summary feature in KinConnect.

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

### Step 3: Enable the Generative AI API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Generative Language API" or "Gemini API"
5. Click on it and press **"Enable"**

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

## 🧪 Testing the Integration

### 1. Test API Key Configuration
Create a test file to verify the Google AI integration:

```javascript
// test-google-ai.js
const fetch = require('node-fetch');

const testGoogleAI = async () => {
  try {
    const response = await fetch('YOUR_FIREBASE_FUNCTIONS_URL/api/visit-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN'
      },
      body: JSON.stringify({
        patientId: 'test-patient-id',
        visitDate: new Date().toISOString(),
        doctorSummary: 'Patient presented with mild headache. Physical exam normal.',
        treatmentPlan: 'Rest and hydration. Follow up if symptoms persist.',
        providerName: 'Dr. Test',
        visitType: 'scheduled'
      })
    });
    
    const result = await response.json();
    console.log('Visit summary created:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testGoogleAI();
```

### 2. Check Function Logs
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

#### 1. "API key not found" Error
- Verify the secret is set: `firebase functions:secrets:access GOOGLE_AI_API_KEY`
- Redeploy functions: `firebase deploy --only functions`

#### 2. "Generative AI API not enabled" Error
- Enable the API in Google Cloud Console
- Wait 5-10 minutes for propagation

#### 3. "Quota exceeded" Error
- Check usage in Google Cloud Console
- Upgrade to paid tier if needed
- Implement request queuing for high volume

#### 4. "Invalid API key" Error
- Regenerate API key in Google AI Studio
- Update the secret in Firebase

### Debug Commands
```bash
# Check function logs
firebase functions:log --only api

# Test function locally
firebase emulators:start --only functions

# Check secrets
firebase functions:secrets:access GOOGLE_AI_API_KEY
```

## 📚 Additional Resources

- [Google AI Studio Documentation](https://ai.google.dev/docs)
- [Gemini API Reference](https://ai.google.dev/api/rest)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)

## 🎯 Next Steps

1. **Get API Key**: Follow steps above to get your Google AI API key
2. **Set Secret**: Configure the key in Firebase Secrets
3. **Deploy**: Deploy the updated functions
4. **Test**: Create a test visit summary to verify integration
5. **Monitor**: Watch logs and usage in Google Cloud Console

The visit summary feature is now ready to use Google AI for intelligent processing of medical visit notes!