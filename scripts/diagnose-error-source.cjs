const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnoseErrorSource() {
  console.log('🔍 DIAGNOSING ERROR SOURCE\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check for visits with error status (without orderBy to avoid index requirement)
    console.log('\n📊 CHECKING FIRESTORE FOR ERROR VISITS...\n');
    
    const errorVisitsSnapshot = await db.collection('visits')
      .where('status', '==', 'error')
      .limit(10)
      .get();
    
    if (errorVisitsSnapshot.empty) {
      console.log('✅ No visits with status="error" found in Firestore');
    } else {
      console.log(`⚠️  Found ${errorVisitsSnapshot.size} visit(s) with status="error":\n`);
      
      errorVisitsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        const now = new Date();
        const ageMinutes = createdAt ? Math.floor((now - createdAt) / 1000 / 60) : 'unknown';
        
        console.log(`${index + 1}. Visit ID: ${doc.id}`);
        console.log(`   Created: ${createdAt ? createdAt.toISOString() : 'unknown'}`);
        console.log(`   Age: ${ageMinutes} minutes ago`);
        console.log(`   Patient ID: ${data.patientId || 'unknown'}`);
        console.log(`   Error: ${data.error || 'No error message'}`);
        console.log('');
      });
    }
    
    // 2. Check for recent visits (any status)
    console.log('\n📊 CHECKING RECENT VISITS (ALL STATUSES)...\n');
    
    const recentVisitsSnapshot = await db.collection('visits')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    if (recentVisitsSnapshot.empty) {
      console.log('⚠️  No recent visits found');
    } else {
      console.log(`Found ${recentVisitsSnapshot.size} recent visit(s):\n`);
      
      recentVisitsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        const now = new Date();
        const ageMinutes = createdAt ? Math.floor((now - createdAt) / 1000 / 60) : 'unknown';
        
        console.log(`${index + 1}. Visit ID: ${doc.id}`);
        console.log(`   Status: ${data.status || 'unknown'}`);
        console.log(`   Created: ${createdAt ? createdAt.toISOString() : 'unknown'}`);
        console.log(`   Age: ${ageMinutes} minutes ago`);
        console.log(`   Has Summary: ${data.summary ? 'Yes' : 'No'}`);
        console.log(`   Has Transcript: ${data.transcript ? 'Yes' : 'No'}`);
        if (data.error) {
          console.log(`   Error: ${data.error}`);
        }
        console.log('');
      });
    }
    
    // 3. Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSIS SUMMARY\n');
    
    if (errorVisitsSnapshot.empty) {
      console.log('✅ No error visits found in database');
      console.log('   → The error in browser console is likely from:');
      console.log('     1. Cached/stale data in browser');
      console.log('     2. A recording attempt that failed before saving to DB');
      console.log('     3. Client-side error display logic');
    } else {
      const oldestError = errorVisitsSnapshot.docs[errorVisitsSnapshot.size - 1];
      const oldestErrorData = oldestError.data();
      const oldestErrorDate = oldestErrorData.createdAt?.toDate();
      const ageMinutes = oldestErrorDate ? Math.floor((new Date() - oldestErrorDate) / 1000 / 60) : 'unknown';
      
      console.log(`⚠️  Found ${errorVisitsSnapshot.size} error visit(s)`);
      console.log(`   → Oldest error is ${ageMinutes} minutes old`);
      console.log(`   → These are OLD errors from before the fix`);
      console.log(`   → Need to clear these to prevent confusion`);
    }
    
    console.log('\n📝 NEXT STEPS:\n');
    console.log('1. Run the cleanup script to clear old errors');
    console.log('2. Clear browser cache/localStorage');
    console.log('3. Make a FRESH recording to test the fix');
    console.log('4. Check Firebase Functions logs for the new recording');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

diagnoseErrorSource();