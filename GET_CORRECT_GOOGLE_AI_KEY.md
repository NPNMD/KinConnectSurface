# How to Get the Correct Google AI API Key

## ⚠️ Current Problem

Your current API key `AIzaSyAq-MHWtFhs7pJvBrMhVmA3WssW_98zhpg` is **valid but does NOT have Gemini access**.

**Test Result:** All Gemini models returned 404 errors, meaning the key cannot access the Generative Language API.

## 🔍 Why This Happens

There are two types of Google API keys:

1. **Google Cloud Console API Keys** - General purpose, requires manual API enabling
2. **Google AI Studio API Keys** - Automatically configured for Gemini access ✅

Your current key is likely from Google Cloud Console and doesn't have the Generative Language API enabled.

## ✅ Solution: Get a Google AI Studio API Key

### Step 1: Go to Google AI Studio
Visit: **https://aistudio.google.com/app/apikey**

### Step 2: Create API Key
1. Click **"Create API key"** button
2. You'll see two options:
   - **"Create API key in new project"** - Creates a new project
   - **"Create API key in existing project"** - Use this! ✅

### Step 3: Select Your Project
1. Choose **"Create API key in existing project"**
2. Select: **`claritystream-uldp9`** (your Firebase project)
3. Click **"Create"**

### Step 4: Copy the Key
1. The new key will be displayed (starts with `AIza...`)
2. **Copy it immediately** - you won't see it again!
3. The key format should be: `AIzaSy...` (39 characters total)

### Step 5: Update Your .env File
1. Open `.env` in your project
2. Find the line: `GOOGLE_AI_API_KEY=AIzaSyAq-MHWtFhs7pJvBrMhVmA3WssW_98zhpg`
3. Replace with your new key: `GOOGLE_AI_API_KEY=<your_new_key_here>`
4. Save the file

### Step 6: Verify and Deploy
Run the verification script:
```bash
node scripts/verify-api-key-and-deploy.cjs
```

This script will:
- ✅ Verify the key format
- ✅ Test Gemini API access
- ✅ Update Firebase secret
- ✅ Deploy the function
- ✅ Confirm everything works

## 🎯 Expected Success Output

When you run the verification script with a correct key, you should see:

```
✅ API key format is correct (starts with "AIza")
✅ SUCCESS! API key has Gemini access
✅ Firebase secret updated
✅ Function deployed
🎉 Your visit summarization feature should now work!
```

## ❌ What NOT to Do

**Don't use:**
- ❌ Google Cloud Console API keys (unless you manually enable Generative Language API)
- ❌ Service account keys (these are JSON files, not API keys)
- ❌ OAuth client IDs (these are for user authentication)
- ❌ Keys from other Google services (Maps, Calendar, etc.)

## 🔐 Key Security

**Important:** API keys should be kept secret!

- ✅ Store in `.env` file (already in `.gitignore`)
- ✅ Use Firebase secrets for production
- ❌ Never commit to Git
- ❌ Never share publicly

## 📊 Monitor Usage

After setup, monitor your API usage at:
**https://aistudio.google.com/app/apikey**

You can see:
- Request count
- Token usage
- Rate limits
- Quota remaining

## 🆘 Troubleshooting

### If verification still fails:

1. **Check the key format:**
   - Must start with `AIza`
   - Should be exactly 39 characters
   - No spaces or quotes

2. **Verify project selection:**
   - Key must be created in `claritystream-uldp9` project
   - Check in Google AI Studio which project the key belongs to

3. **Test manually:**
   ```bash
   node scripts/test-gemini-access.cjs
   ```

4. **Check API enablement:**
   - Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Ensure "Generative Language API" is enabled for `claritystream-uldp9`

## 📞 Need Help?

If you continue to have issues:

1. Run the diagnostic script:
   ```bash
   node scripts/test-gemini-access.cjs
   ```

2. Check the output for specific error codes:
   - **404** = API not enabled or wrong key type
   - **403** = Permission denied
   - **401** = Invalid key

3. Verify your project ID matches: `claritystream-uldp9`

## ✨ Quick Reference

| What | Where |
|------|-------|
| Get API Key | https://aistudio.google.com/app/apikey |
| Project ID | `claritystream-uldp9` |
| Key Format | `AIza...` (39 chars) |
| Update .env | `GOOGLE_AI_API_KEY=<new_key>` |
| Verify & Deploy | `node scripts/verify-api-key-and-deploy.cjs` |
| Test Only | `node scripts/test-gemini-access.cjs` |

---

**Remember:** The key from Google AI Studio automatically has Gemini access. No additional configuration needed! 🎉