// Production migration script for family access duplicate fixes
// Run with: node scripts/migrate-family-access-production.js

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}

const firestore = admin.firestore();

async function migrateFamilyAccessProduction() {
    console.log('🚀 Starting production migration for family access duplicate fixes...\n');
    
    const migrationStartTime = new Date();
    let totalProcessed = 0;
    let duplicatesRemoved = 0;
    let recordsMigrated = 0;
    let errors = [];
    
    try {
        // Step 1: Backup existing data
        console.log('1️⃣ Creating backup of existing family access data...');
        const backupCollection = `family_calendar_access_backup_${Date.now()}`;
        const allRecords = await firestore.collection('family_calendar_access').get();
        
        console.log(`   Found ${allRecords.size} total records to backup`);
        
        const backupBatch = firestore.batch();
        allRecords.docs.forEach(doc => {
            const backupRef = firestore.collection(backupCollection).doc(doc.id);
            backupBatch.set(backupRef, {
                ...doc.data(),
                originalId: doc.id,
                backupCreatedAt: admin.firestore.Timestamp.now()
            });
        });
        
        await backupBatch.commit();
        console.log(`   ✅ Backup created in collection: ${backupCollection}`);
        
        // Step 2: Analyze and group duplicates
        console.log('\n2️⃣ Analyzing duplicate relationships...');
        const relationshipGroups = new Map();
        
        allRecords.docs.forEach(doc => {
            const data = doc.data();
            totalProcessed++;
            
            // Normalize email for consistent grouping
            const normalizedEmail = (data.familyMemberEmail || '').toLowerCase().trim();
            const key = `${data.patientId}_${normalizedEmail}`;
            
            if (!relationshipGroups.has(key)) {
                relationshipGroups.set(key, []);
            }
            
            relationshipGroups.get(key).push({
                id: doc.id,
                data: data,
                ref: doc.ref
            });
        });
        
        console.log(`   Total relationships: ${relationshipGroups.size}`);
        console.log(`   Total records: ${totalProcessed}`);
        
        // Step 3: Process duplicates and migrate to new structure
        console.log('\n3️⃣ Processing duplicates and migrating to new structure...');
        
        const migrationBatch = firestore.batch();
        const deletionBatch = firestore.batch();
        let batchCount = 0;
        
        for (const [relationshipKey, records] of relationshipGroups) {
            if (records.length > 1) {
                console.log(`\n   🔄 Processing ${records.length} duplicates for: ${relationshipKey}`);
                
                // Sort records by priority (same logic as cleanup script)
                records.sort((a, b) => {
                    if (a.data.status === 'active' && b.data.status !== 'active') return -1;
                    if (b.data.status === 'active' && a.data.status !== 'active') return 1;
                    
                    const aAccepted = a.data.acceptedAt?.toDate() || new Date(0);
                    const bAccepted = b.data.acceptedAt?.toDate() || new Date(0);
                    if (aAccepted > bAccepted) return -1;
                    if (bAccepted > aAccepted) return 1;
                    
                    const aCreated = a.data.createdAt?.toDate() || new Date(0);
                    const bCreated = b.data.createdAt?.toDate() || new Date(0);
                    return bCreated - aCreated;
                });
                
                const recordToKeep = records[0];
                const recordsToRemove = records.slice(1);
                
                // Generate new deterministic document ID
                const normalizedEmail = recordToKeep.data.familyMemberEmail.toLowerCase().trim();
                const emailHash = Buffer.from(normalizedEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                const newDocId = `${recordToKeep.data.patientId}_${emailHash}`;
                
                console.log(`     ✅ Keeping: ${recordToKeep.id} -> ${newDocId}`);
                
                // Migrate the record to new document ID (if different)
                if (recordToKeep.id !== newDocId) {
                    const newRef = firestore.collection('family_calendar_access').doc(newDocId);
                    migrationBatch.set(newRef, {
                        ...recordToKeep.data,
                        familyMemberEmail: normalizedEmail, // Ensure normalized email
                        migratedAt: admin.firestore.Timestamp.now(),
                        originalId: recordToKeep.id
                    });
                    
                    // Mark old record for deletion
                    deletionBatch.delete(recordToKeep.ref);
                    recordsMigrated++;
                }
                
                // Mark duplicate records for deletion
                recordsToRemove.forEach(record => {
                    console.log(`     🗑️  Removing: ${record.id}`);
                    deletionBatch.delete(record.ref);
                    duplicatesRemoved++;
                });
                
            } else {
                // Single record - migrate to new ID format if needed
                const record = records[0];
                const normalizedEmail = record.data.familyMemberEmail.toLowerCase().trim();
                const emailHash = Buffer.from(normalizedEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                const newDocId = `${record.data.patientId}_${emailHash}`;
                
                if (record.id !== newDocId) {
                    console.log(`   📝 Migrating single record: ${record.id} -> ${newDocId}`);
                    
                    const newRef = firestore.collection('family_calendar_access').doc(newDocId);
                    migrationBatch.set(newRef, {
                        ...record.data,
                        familyMemberEmail: normalizedEmail,
                        migratedAt: admin.firestore.Timestamp.now(),
                        originalId: record.id
                    });
                    
                    deletionBatch.delete(record.ref);
                    recordsMigrated++;
                }
            }
            
            // Commit batches when they get large (Firestore limit is 500)
            batchCount++;
            if (batchCount >= 400) {
                console.log(`   💾 Committing batch (${batchCount} operations)...`);
                await migrationBatch.commit();
                await deletionBatch.commit();
                batchCount = 0;
            }
        }
        
        // Commit remaining operations
        if (batchCount > 0) {
            console.log(`   💾 Committing final batch (${batchCount} operations)...`);
            await migrationBatch.commit();
            await deletionBatch.commit();
        }
        
        // Step 4: Verify migration
        console.log('\n4️⃣ Verifying migration results...');
        const finalRecords = await firestore.collection('family_calendar_access').get();
        console.log(`   Records after migration: ${finalRecords.size}`);
        
        // Check for remaining duplicates
        const finalGroups = new Map();
        finalRecords.docs.forEach(doc => {
            const data = doc.data();
            const normalizedEmail = (data.familyMemberEmail || '').toLowerCase().trim();
            const key = `${data.patientId}_${normalizedEmail}`;
            
            if (!finalGroups.has(key)) {
                finalGroups.set(key, 0);
            }
            finalGroups.set(key, finalGroups.get(key) + 1);
        });
        
        const remainingDuplicates = Array.from(finalGroups.values()).filter(count => count > 1).length;
        console.log(`   Remaining duplicate relationships: ${remainingDuplicates}`);
        
        // Step 5: Migration summary
        const migrationEndTime = new Date();
        const duration = Math.round((migrationEndTime - migrationStartTime) / 1000);
        
        console.log('\n📊 Migration Summary:');
        console.log(`   Duration: ${duration} seconds`);
        console.log(`   Total records processed: ${totalProcessed}`);
        console.log(`   Records migrated to new IDs: ${recordsMigrated}`);
        console.log(`   Duplicate records removed: ${duplicatesRemoved}`);
        console.log(`   Final record count: ${finalRecords.size}`);
        console.log(`   Backup collection: ${backupCollection}`);
        console.log(`   Remaining duplicates: ${remainingDuplicates}`);
        
        if (remainingDuplicates === 0) {
            console.log('\n✅ Migration completed successfully! No duplicates remain.');
        } else {
            console.log('\n⚠️ Migration completed but some duplicates may remain. Manual review recommended.');
        }
        
        // Step 6: Create migration log
        const migrationLog = {
            migrationId: `migration_${migrationStartTime.getTime()}`,
            startTime: admin.firestore.Timestamp.fromDate(migrationStartTime),
            endTime: admin.firestore.Timestamp.fromDate(migrationEndTime),
            duration: duration,
            totalProcessed: totalProcessed,
            recordsMigrated: recordsMigrated,
            duplicatesRemoved: duplicatesRemoved,
            finalRecordCount: finalRecords.size,
            backupCollection: backupCollection,
            remainingDuplicates: remainingDuplicates,
            errors: errors,
            status: remainingDuplicates === 0 ? 'success' : 'completed_with_warnings'
        };
        
        await firestore.collection('migration_logs').add(migrationLog);
        console.log('\n📝 Migration log saved to migration_logs collection');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        errors.push({
            error: error.message,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

// Rollback function (if needed)
async function rollbackMigration(backupCollectionName) {
    console.log(`🔄 Rolling back migration from backup: ${backupCollectionName}`);
    
    try {
        // Get backup data
        const backupRecords = await firestore.collection(backupCollectionName).get();
        console.log(`Found ${backupRecords.size} records in backup`);
        
        // Clear current collection
        const currentRecords = await firestore.collection('family_calendar_access').get();
        const deleteBatch = firestore.batch();
        currentRecords.docs.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        
        // Restore from backup
        const restoreBatch = firestore.batch();
        backupRecords.docs.forEach(doc => {
            const data = doc.data();
            const originalId = data.originalId;
            delete data.originalId;
            delete data.backupCreatedAt;
            
            const restoreRef = firestore.collection('family_calendar_access').doc(originalId);
            restoreBatch.set(restoreRef, data);
        });
        
        await restoreBatch.commit();
        console.log('✅ Rollback completed successfully');
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === 'rollback' && args[1]) {
        rollbackMigration(args[1])
            .then(() => {
                console.log('\n🎉 Rollback completed successfully!');
                process.exit(0);
            })
            .catch(error => {
                console.error('\n💥 Rollback failed:', error);
                process.exit(1);
            });
    } else {
        migrateFamilyAccessProduction()
            .then(() => {
                console.log('\n🎉 Production migration completed successfully!');
                process.exit(0);
            })
            .catch(error => {
                console.error('\n💥 Production migration failed:', error);
                process.exit(1);
            });
    }
}

module.exports = { migrateFamilyAccessProduction, rollbackMigration };