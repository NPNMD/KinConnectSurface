const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'claritystream-uldp9'
    });
}

const firestore = admin.firestore();

async function testFamilyMemberPatientLinks() {
    console.log('🧪 === FAMILY MEMBER PATIENT LINKS TEST SCRIPT ===');
    console.log('🧪 Testing family member patient link functionality...');
    
    const testResults = {
        familyMembersChecked: 0,
        familyMembersWithProperLinks: 0,
        familyMembersWithIssues: 0,
        patientLinksVerified: 0,
        issues: []
    };
    
    try {
        // Test 1: Check all family member users have proper patient links
        console.log('\n🔍 Test 1: Checking family member user documents...');
        const familyMembersQuery = await firestore.collection('users')
            .where('userType', '==', 'family_member')
            .get();
        
        testResults.familyMembersChecked = familyMembersQuery.docs.length;
        console.log(`📊 Found ${testResults.familyMembersChecked} family member users to check`);
        
        for (const familyMemberDoc of familyMembersQuery.docs) {
            const familyMemberData = familyMemberDoc.data();
            const familyMemberId = familyMemberDoc.id;
            
            console.log(`\n👤 Testing family member: ${familyMemberData.name} (${familyMemberData.email})`);
            console.log(`   ID: ${familyMemberId}`);
            
            // Check required fields
            const hasLinkedPatients = familyMemberData.linkedPatientIds && Array.isArray(familyMemberData.linkedPatientIds) && familyMemberData.linkedPatientIds.length > 0;
            const hasPrimaryPatient = !!familyMemberData.primaryPatientId;
            
            console.log(`   Patient links:`, {
                hasLinkedPatients,
                linkedPatientIds: familyMemberData.linkedPatientIds || 'MISSING',
                hasPrimaryPatient,
                primaryPatientId: familyMemberData.primaryPatientId || 'MISSING'
            });
            
            if (hasLinkedPatients && hasPrimaryPatient) {
                testResults.familyMembersWithProperLinks++;
                console.log(`✅ Family member has proper patient links`);
                
                // Test 2: Verify reciprocal links in patient documents
                for (const patientId of familyMemberData.linkedPatientIds) {
                    console.log(`🔍 Checking reciprocal link in patient: ${patientId}`);
                    
                    try {
                        const patientDoc = await firestore.collection('users').doc(patientId).get();
                        if (patientDoc.exists) {
                            const patientData = patientDoc.data();
                            const hasFamilyMemberLink = patientData.familyMemberIds && 
                                Array.isArray(patientData.familyMemberIds) && 
                                patientData.familyMemberIds.includes(familyMemberId);
                            
                            console.log(`   Patient ${patientData.name || patientId}:`, {
                                hasFamilyMemberLink,
                                familyMemberIds: patientData.familyMemberIds || 'MISSING'
                            });
                            
                            if (hasFamilyMemberLink) {
                                testResults.patientLinksVerified++;
                                console.log(`✅ Reciprocal link verified in patient document`);
                            } else {
                                testResults.issues.push(`Missing reciprocal link: Patient ${patientId} missing family member ${familyMemberId}`);
                                console.log(`❌ Missing reciprocal link in patient document`);
                            }
                        } else {
                            testResults.issues.push(`Patient document not found: ${patientId}`);
                            console.log(`❌ Patient document not found: ${patientId}`);
                        }
                    } catch (error) {
                        testResults.issues.push(`Error checking patient ${patientId}: ${error.message}`);
                        console.error(`❌ Error checking patient ${patientId}:`, error);
                    }
                }
                
                // Test 3: Verify family access collection consistency
                console.log(`🔍 Verifying family access collection consistency...`);
                const familyAccessQuery = await firestore.collection('family_calendar_access')
                    .where('familyMemberId', '==', familyMemberId)
                    .where('status', '==', 'active')
                    .get();
                
                console.log(`   Found ${familyAccessQuery.docs.length} active family access records`);
                
                for (const accessDoc of familyAccessQuery.docs) {
                    const accessData = accessDoc.data();
                    console.log(`   Access record ${accessDoc.id}:`, {
                        patientId: accessData.patientId,
                        familyMemberId: accessData.familyMemberId,
                        status: accessData.status,
                        familyMemberEmail: accessData.familyMemberEmail
                    });
                    
                    // Verify consistency
                    if (accessData.patientId && familyMemberData.linkedPatientIds.includes(accessData.patientId)) {
                        console.log(`✅ Family access record is consistent with user document`);
                    } else {
                        testResults.issues.push(`Inconsistent family access record: ${accessDoc.id}`);
                        console.log(`❌ Family access record inconsistent with user document`);
                    }
                }
                
            } else {
                testResults.familyMembersWithIssues++;
                console.log(`❌ Family member missing patient links`);
                testResults.issues.push(`Family member ${familyMemberData.email} missing patient links`);
            }
        }
        
        // Test 4: API endpoint simulation
        console.log('\n🔍 Test 4: Simulating API endpoint behavior...');
        
        // Find a family member to test with
        const testFamilyMember = familyMembersQuery.docs.find(doc => {
            const data = doc.data();
            return data.linkedPatientIds && data.linkedPatientIds.length > 0;
        });
        
        if (testFamilyMember) {
            const testData = testFamilyMember.data();
            console.log(`🧪 Testing API behavior with family member: ${testData.name}`);
            
            // Simulate /family-access endpoint logic
            const familyAccessQuery = await firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', testFamilyMember.id)
                .where('status', '==', 'active')
                .get();
            
            console.log(`   Family access query results: ${familyAccessQuery.docs.length} records`);
            
            if (familyAccessQuery.docs.length > 0) {
                console.log(`✅ API endpoint would work correctly for this family member`);
            } else {
                console.log(`❌ API endpoint would fail for this family member`);
                testResults.issues.push(`API would fail for ${testData.email}`);
            }
        }
        
        // Final summary
        console.log('\n📊 === TEST RESULTS SUMMARY ===');
        console.log(`Family members checked: ${testResults.familyMembersChecked}`);
        console.log(`Family members with proper links: ${testResults.familyMembersWithProperLinks}`);
        console.log(`Family members with issues: ${testResults.familyMembersWithIssues}`);
        console.log(`Patient reciprocal links verified: ${testResults.patientLinksVerified}`);
        console.log(`Issues found: ${testResults.issues.length}`);
        
        if (testResults.issues.length > 0) {
            console.log('\n❌ Issues found:');
            testResults.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        // Overall assessment
        const successRate = testResults.familyMembersChecked > 0 ? 
            (testResults.familyMembersWithProperLinks / testResults.familyMembersChecked) * 100 : 0;
        
        console.log(`\n🎯 Overall Success Rate: ${Math.round(successRate)}%`);
        
        if (successRate === 100) {
            console.log('🎉 ALL TESTS PASSED - Family member patient links are working correctly!');
        } else if (successRate >= 80) {
            console.log('⚠️ MOSTLY WORKING - Some issues found but most family members are working');
        } else {
            console.log('❌ SIGNIFICANT ISSUES - Many family members have broken patient links');
        }
        
        return testResults;
        
    } catch (error) {
        console.error('❌ Fatal error in test script:', error);
        console.error('❌ Error stack:', error.stack);
        throw error;
    }
}

// Run the test script
if (require.main === module) {
    testFamilyMemberPatientLinks()
        .then((results) => {
            console.log('\n🏁 Test script completed');
            process.exit(results.issues.length > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('\n💥 Test script failed:', error);
            process.exit(1);
        });
}

module.exports = { testFamilyMemberPatientLinks };