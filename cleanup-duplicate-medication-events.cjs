const admin = require('firebase-admin');
const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');

// Initialize Firebase Admin SDK with service account
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function cleanupDuplicateMedicationEvents() {
  try {
    console.log('🧹 Starting cleanup of duplicate medication calendar events...');
    
    const userId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1'; // From the logs
    
    // Get all medication calendar events for this user
    const eventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', userId)
      .get();
    
    console.log(`📊 Found ${eventsQuery.docs.length} total medication calendar events`);
    
    // Group events by medication and scheduled time to find duplicates
    const eventGroups = new Map();
    
    eventsQuery.docs.forEach(doc => {
      const data = doc.data();
      const scheduledTime = data.scheduledDateTime?.toDate();
      const medicationName = data.medicationName;
      
      if (scheduledTime && medicationName) {
        // Create a key based on medication name and scheduled time (rounded to nearest minute)
        const timeKey = new Date(scheduledTime);
        timeKey.setSeconds(0, 0); // Round to nearest minute
        const groupKey = `${medicationName}_${timeKey.toISOString()}`;
        
        if (!eventGroups.has(groupKey)) {
          eventGroups.set(groupKey, []);
        }
        
        eventGroups.get(groupKey).push({
          id: doc.id,
          data: data,
          scheduledTime: scheduledTime
        });
      }
    });
    
    console.log(`📊 Found ${eventGroups.size} unique medication/time combinations`);
    
    // Find and report duplicates
    let duplicateGroups = 0;
    let totalDuplicates = 0;
    const duplicatesToDelete = [];
    
    for (const [groupKey, events] of eventGroups) {
      if (events.length > 1) {
        duplicateGroups++;
        totalDuplicates += events.length - 1; // Keep one, delete the rest
        
        console.log(`🔍 Found ${events.length} duplicates for: ${groupKey}`);
        events.forEach((event, index) => {
          console.log(`  ${index + 1}. ID: ${event.id}, Status: ${event.data.status}, Created: ${event.data.createdAt?.toDate()?.toISOString()}`);
        });
        
        // Sort by creation date and keep the oldest one (most likely to be the original)
        events.sort((a, b) => {
          const aCreated = a.data.createdAt?.toDate() || new Date(0);
          const bCreated = b.data.createdAt?.toDate() || new Date(0);
          return aCreated.getTime() - bCreated.getTime();
        });
        
        // Mark all but the first (oldest) for deletion
        for (let i = 1; i < events.length; i++) {
          duplicatesToDelete.push(events[i].id);
        }
        
        console.log(`  ✅ Keeping: ${events[0].id} (oldest)`);
        console.log(`  🗑️ Will delete: ${events.slice(1).map(e => e.id).join(', ')}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Total events: ${eventsQuery.docs.length}`);
    console.log(`  - Duplicate groups: ${duplicateGroups}`);
    console.log(`  - Total duplicates to delete: ${totalDuplicates}`);
    console.log(`  - Events to keep: ${eventsQuery.docs.length - totalDuplicates}`);
    
    if (duplicatesToDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${duplicatesToDelete.length} duplicate events...`);
      
      // Delete duplicates in batches
      const batchSize = 500; // Firestore batch limit
      for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
        const batch = firestore.batch();
        const batchIds = duplicatesToDelete.slice(i, i + batchSize);
        
        batchIds.forEach(eventId => {
          const eventRef = firestore.collection('medication_calendar_events').doc(eventId);
          batch.delete(eventRef);
        });
        
        await batch.commit();
        console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchIds.length} events`);
      }
      
      console.log('✅ All duplicate events deleted successfully!');
    } else {
      console.log('✅ No duplicates found - database is clean!');
    }
    
    // Verify cleanup
    const finalEventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', userId)
      .get();
    
    console.log(`\n📊 Final count: ${finalEventsQuery.docs.length} medication calendar events remaining`);
    
    // Group final events to show what's left
    const finalGroups = new Map();
    finalEventsQuery.docs.forEach(doc => {
      const data = doc.data();
      const medicationName = data.medicationName;
      const scheduledTime = data.scheduledDateTime?.toDate();
      
      if (medicationName && scheduledTime) {
        if (!finalGroups.has(medicationName)) {
          finalGroups.set(medicationName, []);
        }
        finalGroups.get(medicationName).push({
          time: scheduledTime.toLocaleString(),
          status: data.status,
          id: doc.id
        });
      }
    });
    
    console.log('\n📋 Remaining events by medication:');
    for (const [medication, events] of finalGroups) {
      console.log(`  ${medication}: ${events.length} events`);
      events.forEach(event => {
        console.log(`    - ${event.time} (${event.status}) [${event.id}]`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup
console.log('🚀 Starting duplicate medication events cleanup...');
cleanupDuplicateMedicationEvents()
  .then(() => {
    console.log('🏁 Cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });