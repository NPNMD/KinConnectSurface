import { PubSub } from '@google-cloud/pubsub';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const pubsub = new PubSub();

async function setupVisitRecording() {
  console.log('🚀 Setting up visit recording infrastructure...');

  try {
    // Create Pub/Sub topics
    const topics = [
      'transcribe-request',
      'summarize-request', 
      'tts-request',
      'transcribe-request-dlq',
      'summarize-request-dlq',
      'tts-request-dlq'
    ];

    for (const topicName of topics) {
      try {
        const [topic] = await pubsub.topic(topicName).get({ autoCreate: true });
        console.log(`✅ Topic created/verified: ${topicName}`);
        
        // Create subscription for worker topics (not DLQ)
        if (!topicName.endsWith('-dlq')) {
          const subscriptionName = `${topicName}-subscription`;
          try {
            const [subscription] = await topic.subscription(subscriptionName).get({ autoCreate: true });
            console.log(`✅ Subscription created/verified: ${subscriptionName}`);
          } catch (subError) {
            console.warn(`⚠️ Could not create subscription ${subscriptionName}:`, subError.message);
          }
        }
      } catch (topicError) {
        console.error(`❌ Error with topic ${topicName}:`, topicError.message);
      }
    }

    // Create Firestore indexes for visit queries
    console.log('📝 Firestore indexes will be created automatically when queries are run');
    console.log('💡 Make sure to run: firebase deploy --only firestore:indexes after first deployment');

    // Verify Firebase Storage bucket exists
    const bucket = admin.storage().bucket();
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log('✅ Firebase Storage bucket verified');
      } else {
        console.log('❌ Firebase Storage bucket not found');
      }
    } catch (bucketError) {
      console.warn('⚠️ Could not verify storage bucket:', bucketError.message);
    }

    console.log('🎉 Visit recording infrastructure setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Deploy functions: npm run deploy');
    console.log('2. Deploy Firestore rules: firebase deploy --only firestore:rules');
    console.log('3. Deploy Storage rules: firebase deploy --only storage');
    console.log('4. Test the recording flow in the frontend');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupVisitRecording()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Setup script failed:', error);
      process.exit(1);
    });
}

export { setupVisitRecording };