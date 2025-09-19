/**
 * Repair script to fix family member patient connections
 * This script finds orphaned FamilyCalendarAccess records and repairs them
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (using same approach as server)
if (!admin.apps.length) {
  try {
    // Try to use service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'claritystream-uldp9'
      });
      console.log('✅ Firebase initialized with service account');
    } else {
      // Fallback to application default
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'claritystream-uldp9'
      });
      console.log('✅ Firebase initialized with application default');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.log('💡 Please ensure Firebase credentials are properly configured');
    process.exit(1);
  }
}

const db = admin.firestore();

async function repairFamilyMemberPatientConnection() {
  console.log('🔧 REPAIRING FAMILY MEMBER PATIENT CONNECTION');
  console.log('=' .repeat(60));
  
  const familyMemberUserId = 'HAuaPeYBHadpEFSRiwILfud6bwD3';
  const familyMemberEmail = 'fookwin@gmail.com';
  
  try {
    // Step 1: Verify the family member user exists
    console.log('\n📋 1. VERIFYING FAMILY MEMBER USER');
    console.log('-'.repeat(50));
    
    const userDoc = await db.collection('users').doc(familyMemberUserId).get();
    if (!userDoc.exists) {
      console.log('❌ Family member user not found!');
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Family member user found:');
    console.log(`   Name: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Type: ${userData.userType}`);
    
    // Step 2: Look for orphaned FamilyCalendarAccess records
    console.log('\n🔍 2. SEARCHING FOR ORPHANED RECORDS');
    console.log('-'.repeat(50));
    
    // Search by email for records that might not have familyMemberId set
    const emailQuery = await db.collection('family_calendar_access')
      .where('familyMemberEmail', '==', familyMemberEmail)
      .get();
    
    console.log(`📊 Found ${emailQuery.size} records with email ${familyMemberEmail}`);
    
    const orphanedRecords = [];
    const activeRecords = [];
    
    emailQuery.docs.forEach(doc => {
      const data = doc.data();
      if (!data.familyMemberId || data.familyMemberId === '') {
        orphanedRecords.push({ id: doc.id, data });
      } else if (data.familyMemberId === familyMemberUserId) {
        activeRecords.push({ id: doc.id, data });
      }
    });
    
    console.log(`📊 Orphaned records (missing familyMemberId): ${orphanedRecords.length}`);
    console.log(`📊 Active records (has familyMemberId): ${activeRecords.length}`);
    
    // Step 3: Display orphaned records
    if (orphanedRecords.length > 0) {
      console.log('\n🚨 3. ORPHANED RECORDS FOUND');
      console.log('-'.repeat(50));
      
      orphanedRecords.forEach((record, index) => {
        console.log(`\n   Orphaned Record ${index + 1}:`);
        console.log(`   ├─ ID: ${record.id}`);
        console.log(`   ├─ Patient ID: ${record.data.patientId}`);
        console.log(`   ├─ Family Member Email: ${record.data.familyMemberEmail}`);
        console.log(`   ├─ Family Member ID: ${record.data.familyMemberId || 'NOT SET'}`);
        console.log(`   ├─ Status: ${record.data.status}`);
        console.log(`   ├─ Access Level: ${record.data.accessLevel}`);
        console.log(`   ├─ Invited At: ${record.data.invitedAt?.toDate?.() || record.data.invitedAt}`);
        console.log(`   ├─ Accepted At: ${record.data.acceptedAt?.toDate?.() || record.data.acceptedAt || 'Not set'}`);
        console.log(`   └─ Has Token: ${!!record.data.invitationToken}`);
      });
      
      // Step 4: Repair the orphaned records
      console.log('\n🔧 4. REPAIRING ORPHANED RECORDS');
      console.log('-'.repeat(50));
      
      for (let i = 0; i < orphanedRecords.length; i++) {
        const record = orphanedRecords[i];
        console.log(`\n   Repairing record ${i + 1}/${orphanedRecords.length}...`);
        
        try {
          const updateData = {
            familyMemberId: familyMemberUserId,
            status: 'active',
            acceptedAt: new Date(),
            updatedAt: new Date()
          };
          
          // Remove invitation token if it exists
          if (record.data.invitationToken) {
            updateData.invitationToken = admin.firestore.FieldValue.delete();
            updateData.invitationExpiresAt = admin.firestore.FieldValue.delete();
          }
          
          await db.collection('family_calendar_access').doc(record.id).update(updateData);
          
          console.log(`   ✅ Successfully repaired record ${record.id}`);
          console.log(`      ├─ Set familyMemberId: ${familyMemberUserId}`);
          console.log(`      ├─ Set status: active`);
          console.log(`      ├─ Set acceptedAt: ${new Date().toISOString()}`);
          console.log(`      └─ Removed invitation token`);
          
        } catch (error) {
          console.log(`   ❌ Failed to repair record ${record.id}:`, error.message);
        }
      }
      
    } else {
      console.log('\n✅ 3. NO ORPHANED RECORDS FOUND');
      console.log('-'.repeat(50));
      console.log('   All records appear to have proper familyMemberId set');
    }
    
    // Step 5: Verify active records
    if (activeRecords.length > 0) {
      console.log('\n✅ 5. ACTIVE RECORDS FOUND');
      console.log('-'.repeat(50));
      
      activeRecords.forEach((record, index) => {
        console.log(`\n   Active Record ${index + 1}:`);
        console.log(`   ├─ ID: ${record.id}`);
        console.log(`   ├─ Patient ID: ${record.data.patientId}`);
        console.log(`   ├─ Status: ${record.data.status}`);
        console.log(`   ├─ Access Level: ${record.data.accessLevel}`);
        console.log(`   └─ Accepted At: ${record.data.acceptedAt?.toDate?.() || record.data.acceptedAt}`);
      });
    }
    
    // Step 6: Test the family access query
    console.log('\n🧪 6. TESTING FAMILY ACCESS QUERY');
    console.log('-'.repeat(50));
    
    const familyAccessQuery = await db.collection('family_calendar_access')
      .where('familyMemberId', '==', familyMemberUserId)
      .where('status', '==', 'active')
      .get();
    
    console.log(`📊 Query result: Found ${familyAccessQuery.size} active family access records`);
    
    if (familyAccessQuery.size > 0) {
      console.log('✅ Family member should now have access to patient data!');
      
      familyAccessQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Access Record ${index + 1}:`);
        console.log(`   ├─ Patient ID: ${data.patientId}`);
        console.log(`   ├─ Access Level: ${data.accessLevel}`);
        console.log(`   └─ Permissions: ${JSON.stringify(data.permissions, null, 2).replace(/\n/g, '\n      ')}`);
      });
    } else {
      console.log('❌ No active family access found - repair may have failed');
    }
    
    // Step 7: Summary
    console.log('\n📋 7. REPAIR SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 RESULTS:`);
    console.log(`   ├─ Orphaned records found: ${orphanedRecords.length}`);
    console.log(`   ├─ Records repaired: ${orphanedRecords.length}`);
    console.log(`   ├─ Active records after repair: ${familyAccessQuery.size}`);
    console.log(`   └─ Family member can access patient data: ${familyAccessQuery.size > 0 ? '✅' : '❌'}`);
    
    if (familyAccessQuery.size > 0) {
      console.log('\n🎉 SUCCESS! The family member patient connection has been repaired.');
      console.log('   The family member should now be able to see patient data in the app.');
    } else {
      console.log('\n⚠️  ISSUE PERSISTS: No active family access found after repair.');
      console.log('   This suggests the problem may be elsewhere in the system.');
    }
    
  } catch (error) {
    console.error('❌ Repair failed:', error);
  }
}

// Run the repair
repairFamilyMemberPatientConnection()
  .then(() => {
    console.log('\n✅ Repair process complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Repair process failed:', error);
    process.exit(1);
  });