const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with proper configuration
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'claritystream-uldp9'
    });
}

const firestore = admin.firestore();

async function repairFamilyMemberPatientLinks() {
    console.log('🔧 === FAMILY MEMBER PATIENT LINKS REPAIR SCRIPT ===');
    console.log('🔧 Starting repair process...');
    
    const repairResults = {
        familyMembersScanned: 0,
        familyMembersNeedingRepair: 0,
        familyMembersRepaired: 0,
        patientsUpdated: 0,
        errors: []
    };
    
    try {
        // Step 1: Find all family member users
        console.log('🔍 Step 1: Scanning for family member users...');
        const familyMembersQuery = await firestore.collection('users')
            .where('userType', '==', 'family_member')
            .get();
        
        repairResults.familyMembersScanned = familyMembersQuery.docs.length;
        console.log(`📊 Found ${repairResults.familyMembersScanned} family member users`);
        
        // Step 2: Check each family member for missing patient links
        for (const familyMemberDoc of familyMembersQuery.docs) {
            const familyMemberData = familyMemberDoc.data();
            const familyMemberId = familyMemberDoc.id;
            
            console.log(`\n👤 Checking family member: ${familyMemberData.name} (${familyMemberData.email})`);
            console.log(`   ID: ${familyMemberId}`);
            
            // Check if patient links are missing
            const hasLinkedPatients = familyMemberData.linkedPatientIds && Array.isArray(familyMemberData.linkedPatientIds);
            const hasPrimaryPatient = !!familyMemberData.primaryPatientId;
            
            console.log(`   Current state:`, {
                hasLinkedPatients,
                hasPrimaryPatient,
                linkedPatientIds: familyMemberData.linkedPatientIds || 'MISSING',
                primaryPatientId: familyMemberData.primaryPatientId || 'MISSING'
            });
            
            if (!hasLinkedPatients || !hasPrimaryPatient) {
                repairResults.familyMembersNeedingRepair++;
                console.log(`❌ Family member needs repair: missing patient links`);
                
                // Step 3: Find patient relationships for this family member
                console.log(`🔍 Finding patient relationships for family member: ${familyMemberId}`);
                const familyAccessQuery = await firestore.collection('family_calendar_access')
                    .where('familyMemberId', '==', familyMemberId)
                    .where('status', '==', 'active')
                    .get();
                
                if (familyAccessQuery.empty) {
                    console.log(`⚠️ No active family access found for family member: ${familyMemberId}`);
                    
                    // Try email fallback
                    if (familyMemberData.email) {
                        console.log(`🔍 Trying email fallback for: ${familyMemberData.email}`);
                        const emailFallbackQuery = await firestore.collection('family_calendar_access')
                            .where('familyMemberEmail', '==', familyMemberData.email.toLowerCase())
                            .where('status', '==', 'active')
                            .get();
                        
                        if (!emailFallbackQuery.empty) {
                            console.log(`✅ Found family access via email fallback`);
                            // Also repair the familyMemberId while we're here
                            for (const doc of emailFallbackQuery.docs) {
                                const accessData = doc.data();
                                if (!accessData.familyMemberId) {
                                    await doc.ref.update({
                                        familyMemberId: familyMemberId,
                                        updatedAt: admin.firestore.Timestamp.now(),
                                        repairedAt: admin.firestore.Timestamp.now(),
                                        repairReason: 'repair_script_family_member_id'
                                    });
                                    console.log(`🔧 Also repaired missing familyMemberId in access record: ${doc.id}`);
                                }
                            }
                            familyAccessQuery.docs.push(...emailFallbackQuery.docs);
                        }
                    }
                }
                
                if (familyAccessQuery.docs.length === 0) {
                    console.log(`❌ No family access relationships found for: ${familyMemberData.email}`);
                    repairResults.errors.push(`No relationships found for ${familyMemberData.email}`);
                    continue;
                }
                
                // Step 4: Extract patient IDs and repair user document
                const patientIds = [];
                const patientNames = [];
                
                for (const accessDoc of familyAccessQuery.docs) {
                    const accessData = accessDoc.data();
                    console.log(`📋 Found relationship:`, {
                        accessId: accessDoc.id,
                        patientId: accessData.patientId,
                        status: accessData.status
                    });
                    
                    if (accessData.patientId && !patientIds.includes(accessData.patientId)) {
                        patientIds.push(accessData.patientId);
                        
                        // Get patient name for logging
                        try {
                            const patientDoc = await firestore.collection('users').doc(accessData.patientId).get();
                            const patientData = patientDoc.data();
                            patientNames.push(patientData?.name || 'Unknown Patient');
                        } catch (error) {
                            console.warn(`⚠️ Could not get patient name for: ${accessData.patientId}`);
                            patientNames.push('Unknown Patient');
                        }
                    }
                }
                
                if (patientIds.length === 0) {
                    console.log(`❌ No valid patient IDs found in relationships`);
                    repairResults.errors.push(`No valid patient IDs for ${familyMemberData.email}`);
                    continue;
                }
                
                console.log(`✅ Found ${patientIds.length} patient relationships:`, patientIds);
                console.log(`👥 Patient names:`, patientNames);
                
                // Step 5: Update family member user document
                const familyMemberUpdates = {
                    linkedPatientIds: patientIds,
                    primaryPatientId: patientIds[0], // Use first patient as primary
                    updatedAt: admin.firestore.Timestamp.now(),
                    repairedAt: admin.firestore.Timestamp.now(),
                    repairReason: 'repair_script_missing_patient_links'
                };
                
                console.log(`🔧 Updating family member document with:`, familyMemberUpdates);
                await familyMemberDoc.ref.update(familyMemberUpdates);
                
                // Step 6: Update patient user documents with reciprocal links
                for (const patientId of patientIds) {
                    try {
                        console.log(`🔧 Updating patient document: ${patientId}`);
                        const patientRef = firestore.collection('users').doc(patientId);
                        await patientRef.update({
                            familyMemberIds: admin.firestore.FieldValue.arrayUnion(familyMemberId),
                            updatedAt: admin.firestore.Timestamp.now(),
                            repairedAt: admin.firestore.Timestamp.now(),
                            repairReason: 'repair_script_missing_family_member_links'
                        });
                        repairResults.patientsUpdated++;
                        console.log(`✅ Updated patient document: ${patientId}`);
                    } catch (patientError) {
                        console.error(`❌ Error updating patient ${patientId}:`, patientError);
                        repairResults.errors.push(`Failed to update patient ${patientId}: ${patientError.message}`);
                    }
                }
                
                repairResults.familyMembersRepaired++;
                console.log(`✅ Successfully repaired family member: ${familyMemberData.name}`);
                console.log(`   Added linkedPatientIds: [${patientIds.join(', ')}]`);
                console.log(`   Set primaryPatientId: ${patientIds[0]}`);
                console.log(`   Updated ${patientIds.length} patient documents`);
                
            } else {
                console.log(`✅ Family member already has proper patient links`);
            }
        }
        
        // Step 7: Summary report
        console.log('\n🎉 === REPAIR SCRIPT COMPLETED ===');
        console.log('📊 Repair Results:');
        console.log(`   Family members scanned: ${repairResults.familyMembersScanned}`);
        console.log(`   Family members needing repair: ${repairResults.familyMembersNeedingRepair}`);
        console.log(`   Family members repaired: ${repairResults.familyMembersRepaired}`);
        console.log(`   Patient documents updated: ${repairResults.patientsUpdated}`);
        console.log(`   Errors encountered: ${repairResults.errors.length}`);
        
        if (repairResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            repairResults.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        if (repairResults.familyMembersRepaired > 0) {
            console.log('\n✅ SUCCESS: Family member patient links have been repaired!');
            console.log('🎯 Next steps:');
            console.log('   1. Test family member login to verify access');
            console.log('   2. Check that patient dashboard loads correctly');
            console.log('   3. Verify patient switching functionality');
        } else if (repairResults.familyMembersNeedingRepair === 0) {
            console.log('\n✅ All family members already have proper patient links - no repairs needed');
        } else {
            console.log('\n⚠️ Some family members could not be repaired - check errors above');
        }
        
        return repairResults;
        
    } catch (error) {
        console.error('❌ Fatal error in repair script:', error);
        console.error('❌ Error stack:', error.stack);
        throw error;
    }
}

// Run the repair script
if (require.main === module) {
    repairFamilyMemberPatientLinks()
        .then((results) => {
            console.log('\n🏁 Repair script finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Repair script failed:', error);
            process.exit(1);
        });
}

module.exports = { repairFamilyMemberPatientLinks };