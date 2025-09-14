import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({
  projectId: 'claritystream-uldp9'
});

async function verifyPubSubTopics() {
  console.log('🔍 Verifying Pub/Sub topics...');
  
  const requiredTopics = ['transcribe-request', 'summarize-request'];
  
  try {
    // List all topics
    const [topics] = await pubsub.getTopics();
    const topicNames = topics.map(topic => topic.name.split('/').pop());
    
    console.log('📋 Existing topics:', topicNames);
    
    // Check each required topic
    for (const topicName of requiredTopics) {
      const exists = topicNames.includes(topicName);
      console.log(`${exists ? '✅' : '❌'} Topic "${topicName}": ${exists ? 'EXISTS' : 'MISSING'}`);
      
      if (!exists) {
        console.log(`🔧 Creating topic: ${topicName}`);
        try {
          await pubsub.createTopic(topicName);
          console.log(`✅ Created topic: ${topicName}`);
        } catch (createError) {
          console.error(`❌ Failed to create topic ${topicName}:`, createError.message);
        }
      }
    }
    
    console.log('✅ Pub/Sub topics verification completed');
    
  } catch (error) {
    console.error('❌ Error verifying Pub/Sub topics:', error.message);
    throw error;
  }
}

// Run verification
verifyPubSubTopics()
  .then(() => {
    console.log('🎉 Pub/Sub verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Pub/Sub verification failed:', error);
    process.exit(1);
  });