const admin = require('firebase-admin');
const serviceAccount = require('../claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkVisitError() {
  try {
    // Check the most recent visit with error
    const visitId = 'visit_1759245901230_njoeoe';
    
    const visitDoc = await db.collection('visits').doc(visitId).get();
    
    if (!visitDoc.exists) {
      console.log('❌ Visit not found:', visitId);
      return;
    }
    
    const visitData = visitDoc.data();
    
    console.log('\n📋 Visit Details:');
    console.log('Visit ID:', visitId);
    console.log('Status:', visitData.status);
    console.log('Created At:', visitData.createdAt?.toDate());
    console.log('Updated At:', visitData.updatedAt?.toDate());
    
    if (visitData.error) {
      console.log('\n❌ Error Details:');
      console.log('Step:', visitData.error.step);
      console.log('Message:', visitData.error.message);
      console.log('Last Retry:', visitData.error.lastRetry?.toDate());
    }
    
    if (visitData.summarizationStartedAt) {
      console.log('\n🤖 Summarization Started At:', visitData.summarizationStartedAt.toDate());
    }
    
    // Check if there are any other recent visits with errors
    console.log('\n\n📊 Checking for other recent error visits...');
    const errorVisits = await db.collection('visits')
      .where('status', '==', 'error')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    console.log(`Found ${errorVisits.size} visits with error status:`);
    errorVisits.forEach(doc => {
      const data = doc.data();
      console.log(`\n- ${doc.id}`);
      console.log(`  Created: ${data.createdAt?.toDate()}`);
      console.log(`  Error: ${data.error?.message}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking visit:', error);
  } finally {
    process.exit(0);
  }
}

checkVisitError();