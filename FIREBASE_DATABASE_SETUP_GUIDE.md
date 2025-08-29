# Firebase Firestore Database Setup Guide

## 🎯 **Step-by-Step Database Creation**

### **Step 1: Access Firebase Console**
1. Open your web browser
2. Go to: https://console.firebase.google.com
3. Sign in with your Google account
4. Click on your project: **`claritystream-uldp9`**

### **Step 2: Navigate to Firestore Database**
1. In the left sidebar, look for **"Firestore Database"**
2. Click on **"Firestore Database"**
3. You should see one of these scenarios:

#### **Scenario A: Database Already Exists**
- If you see collections and data, your database is already set up ✅
- Skip to Step 4 to verify collections

#### **Scenario B: "Get Started" Button**
- If you see a "Get started" button, continue to Step 3

#### **Scenario C: "Create database" Button**
- If you see a "Create database" button, continue to Step 3

### **Step 3: Create Firestore Database**

#### **3.1: Click "Create database" or "Get started"**

#### **3.2: Choose Security Rules Mode**
You'll see two options:

**Option 1: Start in production mode (Recommended)**
- Select: **"Start in production mode"**
- Click **"Next"**
- This is more secure and we already have security rules configured

**Option 2: Start in test mode (Alternative)**
- Select: **"Start in test mode"**
- Click **"Next"**
- ⚠️ Note: Test mode allows all reads/writes for 30 days

#### **3.3: Choose Database Location**
1. Select a location close to your users:
   - **`us-central1 (Iowa)`** - Good for US users
   - **`us-east1 (South Carolina)`** - Good for US East Coast
   - **`europe-west1 (Belgium)`** - Good for European users
   - **`asia-southeast1 (Singapore)`** - Good for Asian users

2. ⚠️ **Important**: You cannot change this location later!

3. Click **"Done"**

#### **3.4: Wait for Database Creation**
- Firebase will create your database (takes 1-2 minutes)
- You'll see a loading screen
- Once complete, you'll see the Firestore console

### **Step 4: Verify Database Setup**

#### **4.1: Check Database Status**
You should now see:
- Database name: `(default)`
- Location: The region you selected
- Mode: `Native mode`

#### **4.2: Verify Collections**
Look for these collections (they may not exist yet, which is normal):
- `family_calendar_access`
- `users`
- `medical_events`
- `medications`
- `healthcare_providers`

### **Step 5: Set Up Security Rules (If Needed)**

#### **5.1: Navigate to Rules Tab**
1. In Firestore Database, click the **"Rules"** tab
2. You should see the current security rules

#### **5.2: Update Rules (If Starting in Test Mode)**
If you started in test mode, replace the rules with our production rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Family calendar access rules
    match /family_calendar_access/{accessId} {
      allow read: if request.auth != null && (
        resource.data.patientId == request.auth.uid ||
        resource.data.familyMemberId == request.auth.uid
      );
      allow create, update: if request.auth != null && (
        request.resource.data.patientId == request.auth.uid ||
        resource.data.patientId == request.auth.uid
      );
    }
    
    // Medical events access
    match /medical_events/{eventId} {
      allow read, write: if request.auth != null && (
        resource.data.patientId == request.auth.uid ||
        exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId))
      );
    }
    
    // Default: authenticated users can access their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

### **Step 6: Test Database Connection**

#### **6.1: Create a Test Document**
1. In the **"Data"** tab, click **"Start collection"**
2. Collection ID: `test`
3. Document ID: `connection-test`
4. Add a field:
   - Field: `message`
   - Type: `string`
   - Value: `Database working!`
5. Click **"Save"**

#### **6.2: Verify Test Document**
- You should see the `test` collection with your document
- This confirms your database is working

#### **6.3: Delete Test Document (Optional)**
- Click on the test document
- Click the trash icon to delete it
- Click "Delete" to confirm

### **Step 7: Update Firebase Configuration (If Needed)**

#### **7.1: Get Database URL**
1. In Firebase Console, go to **"Project Settings"** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click on your web app
4. Look for the config object
5. Copy the `databaseURL` value

#### **7.2: Verify Configuration**
Your `shared/firebase.ts` should now have:
```typescript
export const firebaseConfig = {
  apiKey: "AIzaSyCWSNgfOEVh_Q86YWHdiCA8QaYHVUDK4ZY",
  authDomain: "claritystream-uldp9.firebaseapp.com",
  databaseURL: "https://claritystream-uldp9-default-rtdb.firebaseio.com/",
  projectId: "claritystream-uldp9",
  storageBucket: "claritystream-uldp9.firebasestorage.app",
  messagingSenderId: "64645622155",
  appId: "1:64645622155:web:1f8ecfebe7c881a9c8a78e"
};
```

---

## 🔍 **Troubleshooting Common Issues**

### **Issue 1: "Create database" button is grayed out**
**Solution**: 
- Make sure you're signed in with the correct Google account
- Verify you have owner/editor permissions on the project

### **Issue 2: "Firestore Database" not visible in sidebar**
**Solution**:
- Refresh the page
- Make sure you're in the correct project
- Check if you have the necessary permissions

### **Issue 3: Database creation fails**
**Solution**:
- Try a different region
- Check your internet connection
- Wait a few minutes and try again

### **Issue 4: Security rules errors**
**Solution**:
- Use the default rules initially
- Update rules after database is created
- Check for syntax errors in rules

---

## ✅ **Verification Checklist**

After completing setup, verify:

- [ ] Firestore Database exists in Firebase Console
- [ ] Database location is set
- [ ] Security rules are configured
- [ ] Test document can be created and deleted
- [ ] No error messages in console
- [ ] Database URL is in your config file

---

## 🚀 **Next Steps After Database Setup**

1. **Deploy your code changes**:
   ```bash
   firebase deploy --only functions
   ```

2. **Test your application**:
   - Run your app locally
   - Check browser console for Firebase connection logs
   - Test family invitation functionality

3. **Run the test script**:
   ```bash
   node test-family-relationship-fixes.js
   ```

---

## 📞 **Need Help?**

If you encounter issues:
1. Check the Firebase Console for error messages
2. Look at browser developer tools console
3. Verify your Firebase project permissions
4. Try refreshing the Firebase Console

**Your database should now be ready for your KinConnect application!** 🎉