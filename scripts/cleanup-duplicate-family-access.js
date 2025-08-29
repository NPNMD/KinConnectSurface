// Database cleanup script to remove duplicate family access records
// Run with: node scripts/cleanup-duplicate-family-access.js

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}

const firestore = admin.firestore();

async function cleanupDuplicateFamilyAccess() {
    console.log('🧹 Starting cleanup of duplicate family access records...');
    
    try {
        // Get all family access records
        const familyAccessSnapshot = await firestore.collection('family_calendar_access').get();
        
        console.log(`📊 Found ${familyAccessSnapshot.size} total family access records`);
        
        // Group records by unique relationship key (patientId + familyMemberEmail)
        const relationshipGroups = new Map();
        
        familyAccessSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const key = `${data.patientId}_${(data.familyMemberEmail || '').toLowerCase()}`;
            
            if (!relationshipGroups.has(key)) {
                relationshipGroups.set(key, []);
            }
            
            relationshipGroups.get(key).push({
                id: doc.id,
                data: data,
                ref: doc.ref
            });
        });
        
        console.log(`🔍 Found ${relationshipGroups.size} unique relationships`);
        
        let duplicatesFound = 0;
        let recordsToDelete = [];
        let recordsToKeep = [];
        
        // Process each relationship group
        for (const [key, records] of relationshipGroups) {
            if (records.length > 1) {
                duplicatesFound++;
                console.log(`\n🔄 Processing duplicates for relationship: ${key}`);
                console.log(`   Found ${records.length} records`);
                
                // Sort records by priority:
                // 1. Active status first
                // 2. Most recent acceptedAt date
                // 3. Most recent createdAt date
                records.sort((a, b) => {
                    // Prioritize active status
                    if (a.data.status === 'active' && b.data.status !== 'active') return -1;
                    if (b.data.status === 'active' && a.data.status !== 'active') return 1;
                    
                    // Then by acceptedAt date (most recent first)
                    const aAccepted = a.data.acceptedAt?.toDate() || new Date(0);
                    const bAccepted = b.data.acceptedAt?.toDate() || new Date(0);
                    if (aAccepted > bAccepted) return -1;
                    if (bAccepted > aAccepted) return 1;
                    
                    // Finally by createdAt date (most recent first)
                    const aCreated = a.data.createdAt?.toDate() || new Date(0);
                    const bCreated = b.data.createdAt?.toDate() || new Date(0);
                    return bCreated - aCreated;
                });
                
                // Keep the first (highest priority) record
                const recordToKeep = records[0];
                const recordsToRemove = records.slice(1);
                
                console.log(`   ✅ Keeping record: ${recordToKeep.id} (status: ${recordToKeep.data.status})`);
                recordsToKeep.push(recordToKeep);
                
                recordsToRemove.forEach(record => {
                    console.log(`   🗑️  Marking for deletion: ${record.id} (status: ${record.data.status})`);
                    recordsToDelete.push(record);
                });
            } else {
                // Single record, keep it
                recordsToKeep.push(records[0]);
            }
        }
        
        console.log(`\n📈 Cleanup Summary:`);
        console.log(`   Total relationships: ${relationshipGroups.size}`);
        console.log(`   Relationships with duplicates: ${duplicatesFound}`);
        console.log(`   Records to keep: ${recordsToKeep.length}`);
        console.log(`   Records to delete: ${recordsToDelete.length}`);
        
        if (recordsToDelete.length === 0) {
            console.log('\n✅ No duplicates found! Database is clean.');
            return;
        }
        
        // Ask for confirmation before deleting
        console.log('\n⚠️  This will permanently delete duplicate records.');
        console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Delete duplicate records in batches
        const batchSize = 500; // Firestore batch limit
        let deletedCount = 0;
        
        for (let i = 0; i < recordsToDelete.length; i += batchSize) {
            const batch = firestore.batch();
            const batchRecords = recordsToDelete.slice(i, i + batchSize);
            
            batchRecords.forEach(record => {
                batch.delete(record.ref);
            });
            
            await batch.commit();
            deletedCount += batchRecords.length;
            
            console.log(`🗑️  Deleted batch: ${deletedCount}/${recordsToDelete.length} records`);
        }
        
        console.log(`\n✅ Cleanup completed successfully!`);
        console.log(`   Deleted ${deletedCount} duplicate records`);
        console.log(`   Kept ${recordsToKeep.length} unique records`);
        
        // Verify cleanup
        const finalSnapshot = await firestore.collection('family_calendar_access').get();
        console.log(`📊 Final count: ${finalSnapshot.size} family access records`);
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

// Run the cleanup
if (require.main === module) {
    cleanupDuplicateFamilyAccess()
        .then(() => {
            console.log('\n🎉 Cleanup script completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Cleanup script failed:', error);
            process.exit(1);
        });
}

module.exports = { cleanupDuplicateFamilyAccess };