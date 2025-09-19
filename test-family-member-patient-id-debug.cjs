const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

async function debugFamilyMemberPatientConnection() {
  console.log('🔍 DEBUGGING FAMILY MEMBER PATIENT CONNECTION');
  console.log('=' .repeat(60));
  
  // The family member from the screenshot
  const familyMemberUserId = 'HAuaPeYBHadpEFSRiwILfud6bwD3';
  const familyMemberEmail = 'fookwin@gmail.com';
  
  try {
    // 1. Check the family member user document
    console.log('\n📋 1. CHECKING FAMILY MEMBER USER DOCUMENT');
    console.log('-'.repeat(50));
    
    const userDoc = await db.collection('users').doc(familyMemberUserId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ Family member user found:');
      console.log(`   ID: ${userData.id}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Name: ${userData.name}`);
      console.log(`   User Type: ${userData.userType}`);
      console.log(`   Created: ${userData.createdAt?.toDate?.() || userData.createdAt}`);
      console.log(`   Updated: ${userData.updatedAt?.toDate?.() || userData.updatedAt}`);
    } else {
      console.log('❌ Family member user document not found!');
      return;
    }

    // 2. Check family_calendar_access collection for this family member
    console.log('\n🔗 2. CHECKING FAMILY_CALENDAR_ACCESS RECORDS');
    console.log('-'.repeat(50));
    
    // Query by familyMemberId
    const accessByMemberQuery = await db.collection('family_calendar_access')
      .where('familyMemberId', '==', familyMemberUserId)
      .get();
    
    console.log(`📊 Records with familyMemberId = "${familyMemberUserId}": ${accessByMemberQuery.size}`);
    
    if (!accessByMemberQuery.empty) {
      accessByMemberQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Record ${index + 1}:`);
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ Patient ID: ${data.patientId}`);
        console.log(`   ├─ Family Member ID: ${data.familyMemberId}`);
        console.log(`   ├─ Family Member Email: ${data.familyMemberEmail}`);
        console.log(`   ├─ Status: ${data.status}`);
        console.log(`   ├─ Access Level: ${data.accessLevel}`);
        console.log(`   ├─ Invited At: ${data.invitedAt?.toDate?.() || data.invitedAt}`);
        console.log(`   ├─ Accepted At: ${data.acceptedAt?.toDate?.() || data.acceptedAt || 'Not accepted'}`);
        console.log(`   └─ Created By: ${data.createdBy}`);
      });
    }
    
    // Query by familyMemberEmail
    const accessByEmailQuery = await db.collection('family_calendar_access')
      .where('familyMemberEmail', '==', familyMemberEmail)
      .get();
    
    console.log(`\n📊 Records with familyMemberEmail = "${familyMemberEmail}": ${accessByEmailQuery.size}`);
    
    if (!accessByEmailQuery.empty) {
      accessByEmailQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Record ${index + 1}:`);
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ Patient ID: ${data.patientId}`);
        console.log(`   ├─ Family Member ID: ${data.familyMemberId || 'NOT SET'}`);
        console.log(`   ├─ Family Member Email: ${data.familyMemberEmail}`);
        console.log(`   ├─ Status: ${data.status}`);
        console.log(`   ├─ Access Level: ${data.accessLevel}`);
        console.log(`   ├─ Invited At: ${data.invitedAt?.toDate?.() || data.invitedAt}`);
        console.log(`   ├─ Accepted At: ${data.acceptedAt?.toDate?.() || data.acceptedAt || 'Not accepted'}`);
        console.log(`   ├─ Invitation Token: ${data.invitationToken || 'None'}`);
        console.log(`   └─ Created By: ${data.createdBy}`);
      });
    }

    // 3. Check for any pending invitations
    console.log('\n⏳ 3. CHECKING FOR PENDING INVITATIONS');
    console.log('-'.repeat(50));
    
    const pendingQuery = await db.collection('family_calendar_access')
      .where('familyMemberEmail', '==', familyMemberEmail)
      .where('status', '==', 'pending')
      .get();
    
    console.log(`📊 Pending invitations for ${familyMemberEmail}: ${pendingQuery.size}`);
    
    if (!pendingQuery.empty) {
      pendingQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Pending Invitation ${index + 1}:`);
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ Patient ID: ${data.patientId}`);
        console.log(`   ├─ Invitation Token: ${data.invitationToken}`);
        console.log(`   ├─ Expires At: ${data.invitationExpiresAt?.toDate?.() || data.invitationExpiresAt}`);
        console.log(`   └─ Created By: ${data.createdBy}`);
      });
    }

    // 4. Check all family_calendar_access records to understand the data structure
    console.log('\n📚 4. CHECKING ALL FAMILY_CALENDAR_ACCESS RECORDS (SAMPLE)');
    console.log('-'.repeat(50));
    
    const allAccessQuery = await db.collection('family_calendar_access')
      .limit(5)
      .get();
    
    console.log(`📊 Total sample records: ${allAccessQuery.size}`);
    
    if (!allAccessQuery.empty) {
      allAccessQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Sample Record ${index + 1}:`);
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ Patient ID: ${data.patientId}`);
        console.log(`   ├─ Family Member ID: ${data.familyMemberId || 'NOT SET'}`);
        console.log(`   ├─ Family Member Email: ${data.familyMemberEmail}`);
        console.log(`   ├─ Status: ${data.status}`);
        console.log(`   └─ Has Invitation Token: ${!!data.invitationToken}`);
      });
    }

    // 5. Check if there are any patient records that might have sent invitations
    console.log('\n👤 5. CHECKING PATIENT RECORDS');
    console.log('-'.repeat(50));
    
    const patientsQuery = await db.collection('patients').limit(3).get();
    console.log(`📊 Sample patient records: ${patientsQuery.size}`);
    
    if (!patientsQuery.empty) {
      patientsQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Patient ${index + 1}:`);
        console.log(`   ├─ ID: ${doc.id}`);
        console.log(`   ├─ User ID: ${data.userId}`);
        console.log(`   └─ Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
      });
    }

    // 6. Check users collection for potential patient users
    console.log('\n👥 6. CHECKING FOR PATIENT USERS');
    console.log('-'.repeat(50));
    
    const patientUsersQuery = await db.collection('users')
      .where('userType', '==', 'patient')
      .limit(3)
      .get();
    
    console.log(`📊 Patient users found: ${patientUsersQuery.size}`);
    
    if (!patientUsersQuery.empty) {
      patientUsersQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n   Patient User ${index + 1}:`);
        console.log(`   ├─ ID: ${data.id}`);
        console.log(`   ├─ Email: ${data.email}`);
        console.log(`   ├─ Name: ${data.name}`);
        console.log(`   └─ Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
      });
    }

    // 7. Summary and diagnosis
    console.log('\n🔍 7. DIAGNOSIS SUMMARY');
    console.log('='.repeat(60));
    
    const hasActiveAccess = !accessByMemberQuery.empty && 
      accessByMemberQuery.docs.some(doc => doc.data().status === 'active');
    
    const hasPendingInvitation = !pendingQuery.empty;
    
    const hasEmailRecord = !accessByEmailQuery.empty;
    
    console.log(`\n📊 FINDINGS:`);
    console.log(`   ├─ Family member user exists: ✅`);
    console.log(`   ├─ Has active family access: ${hasActiveAccess ? '✅' : '❌'}`);
    console.log(`   ├─ Has pending invitation: ${hasPendingInvitation ? '⚠️' : '❌'}`);
    console.log(`   └─ Has any email-based record: ${hasEmailRecord ? '✅' : '❌'}`);
    
    if (!hasActiveAccess && !hasPendingInvitation && !hasEmailRecord) {
      console.log(`\n🚨 ISSUE IDENTIFIED: No family_calendar_access record found!`);
      console.log(`   This suggests the invitation was never created or was deleted.`);
    } else if (hasPendingInvitation) {
      console.log(`\n⚠️  ISSUE IDENTIFIED: Invitation exists but was never accepted!`);
      console.log(`   The family member may need to complete the acceptance process.`);
    } else if (hasEmailRecord && !hasActiveAccess) {
      console.log(`\n🔧 ISSUE IDENTIFIED: Record exists but familyMemberId not set!`);
      console.log(`   The invitation acceptance process failed to update the record.`);
    } else if (hasActiveAccess) {
      console.log(`\n✅ UNEXPECTED: Active access found! The issue may be in the API query.`);
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

// Run the diagnosis
debugFamilyMemberPatientConnection()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });