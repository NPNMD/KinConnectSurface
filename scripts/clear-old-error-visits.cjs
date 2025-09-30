const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function clearOldErrorVisits() {
  console.log('🧹 CLEARING OLD ERROR VISITS\n');
  console.log('=' .repeat(60));
  
  try {
    // Get all visits with error status
    const errorVisitsSnapshot = await db.collection('visits')
      .where('status', '==', 'error')
      .get();
    
    if (errorVisitsSnapshot.empty) {
      console.log('✅ No error visits found to clear');
      return;
    }
    
    console.log(`\n⚠️  Found ${errorVisitsSnapshot.size} error visit(s) to clear\n`);
    
    // Update each error visit to 'failed' status
    const batch = db.batch();
    let count = 0;
    
    errorVisitsSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      
      console.log(`${count + 1}. Clearing visit: ${doc.id}`);
      console.log(`   Created: ${createdAt ? createdAt.toISOString() : 'unknown'}`);
      console.log(`   Error: ${data.error?.message || 'No error message'}`);
      
      // Update status to 'failed' to distinguish from new errors
      batch.update(doc.ref, {
        status: 'failed',
        clearedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalError: data.error
      });
      
      count++;
      console.log('');
    });
    
    // Commit the batch update
    console.log('💾 Committing batch update...\n');
    await batch.commit();
    
    console.log('=' .repeat(60));
    console.log(`✅ Successfully cleared ${count} error visit(s)`);
    console.log('   → Status changed from "error" to "failed"');
    console.log('   → These will no longer appear in the UI');
    console.log('\n📝 NEXT STEPS:\n');
    console.log('1. Clear browser cache/localStorage');
    console.log('2. Refresh the page');
    console.log('3. Make a FRESH recording to test the fix');
    
  } catch (error) {
    console.error('❌ Error clearing visits:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

clearOldErrorVisits();