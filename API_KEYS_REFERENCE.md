# 🔑 API Keys Currently Used in KinConnect

## 📋 **API Keys Your Developer Needs**

Based on the codebase analysis, here are all the API keys currently being used:

### **1. Firebase Configuration Keys**
**Location**: Client-side environment variables
```
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=claritystream-uldp9.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=claritystream-uldp9
VITE_FIREBASE_STORAGE_BUCKET=claritystream-uldp9.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### **2. SendGrid Email API Key**
**Location**: Firebase Functions Secrets
**Used for**: Family invitation emails
```bash
# Set in Firebase Functions
firebase functions:secrets:set SENDGRID_API_KEY
# Value: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Current email**: `mike.nguyen@twfg.com`

### **3. Google AI (Gemini) API Key**
**Location**: Firebase Functions Secrets
**Used for**: Visit summary AI processing
```bash
# Set in Firebase Functions
firebase functions:secrets:set GOOGLE_AI_API_KEY
# Value: AIza...xxxxxxxxxxxxxxxxxxxxxxxxx
```

### **4. Google Cloud Speech-to-Text API**
**Location**: Uses Firebase service account automatically
**Used for**: Audio transcription (currently having issues)
**Status**: Enabled but returning 0 results

### **5. Google Maps API Key (Optional)**
**Location**: Client-side environment variable
**Used for**: Healthcare provider address autocomplete
```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### **6. Google Calendar API (Optional)**
**Location**: Client-side environment variable
**Used for**: Calendar integration
```
VITE_GOOGLE_CALENDAR_API_KEY=your_google_calendar_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
```

## 🔧 **Current API Status**

### **✅ Working APIs**
- **Firebase**: Authentication, Firestore, Functions
- **SendGrid**: Email invitations
- **Google AI (Gemini)**: Visit summary processing
- **OpenFDA**: Drug search and information
- **RxNorm**: Medication data and interactions

### **❌ Problematic APIs**
- **Google Cloud Speech-to-Text**: Enabled but returning 0 results
  - **Issue**: Complex configuration causing failures
  - **Solution**: Switch to browser Speech Recognition API

### **🔍 Missing/Optional APIs**
- **Google Maps**: For address autocomplete
- **Google Calendar**: For calendar sync
- **Google Natural Language**: For medical entity extraction (planned)

## 🚀 **Recommended Action for Developer**

### **Immediate Fix**
**Stop using Google Cloud Speech-to-Text** and implement **browser Speech Recognition** instead:

```typescript
// Use this instead of complex cloud API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';
```

### **Benefits**
- ✅ **Works immediately** - no API key setup
- ✅ **Real-time transcription** - see text as you speak
- ✅ **No costs** - uses browser capabilities
- ✅ **Better reliability** - no cloud dependencies

## 📊 **API Key Priority**

### **Essential (Must Have)**
1. **Firebase keys** - Core app functionality
2. **SendGrid API key** - Family invitations
3. **Google AI API key** - Visit summary processing

### **Optional (Nice to Have)**
4. **Google Maps API key** - Address autocomplete
5. **Google Calendar API key** - Calendar sync

### **Not Needed (Remove)**
6. ~~Google Cloud Speech-to-Text~~ - Replace with browser API

## 🔑 **How to Check Current Keys**

### **Firebase Secrets**
```bash
# Check what secrets are set
firebase functions:secrets:access SENDGRID_API_KEY
firebase functions:secrets:access GOOGLE_AI_API_KEY
```

### **Environment Variables**
Check your `.env` file or hosting environment for:
- `VITE_FIREBASE_*` keys
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_CALENDAR_API_KEY`

## 🎯 **Summary for Developer**

**Current working APIs**: Firebase, SendGrid, Google AI, OpenFDA, RxNorm
**Problematic API**: Google Cloud Speech-to-Text (replace with browser Speech Recognition)
**Missing APIs**: None required for core functionality

The main issue is not missing API keys, but rather the complex Google Cloud Speech-to-Text configuration. Switch to browser Speech Recognition for immediate results.