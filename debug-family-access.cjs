/**
 * Debug script to check family access relationships in the database
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function debugFamilyAccess() {
  console.log('🔍 Debugging Family Access for user: elGKDc1zuwaT98wFlQTnAqyLFZ93');
  console.log('=' .repeat(60));

  try {
    const userId = 'elGKDc1zuwaT98wFlQTnAqyLFZ93';

    // Check 1: Look for family access where user is a family member
    console.log('\n📝 Step 1: Checking family access where user is a family member...');
    const familyMemberQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberId', '==', userId)
      .get();

    console.log(`Found ${familyMemberQuery.docs.length} records where user is a family member`);
    familyMemberQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  Record ${index + 1}:`, {
        id: doc.id,
        patientId: data.patientId,
        familyMemberId: data.familyMemberId,
        familyMemberName: data.familyMemberName,
        familyMemberEmail: data.familyMemberEmail,
        status: data.status,
        permissions: data.permissions
      });
    });

    // Check 2: Look for family access where user is the patient
    console.log('\n📝 Step 2: Checking family access where user is the patient...');
    const patientQuery = await firestore.collection('family_calendar_access')
      .where('patientId', '==', userId)
      .get();

    console.log(`Found ${patientQuery.docs.length} records where user is the patient`);
    patientQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  Record ${index + 1}:`, {
        id: doc.id,
        patientId: data.patientId,
        familyMemberId: data.familyMemberId,
        familyMemberName: data.familyMemberName,
        familyMemberEmail: data.familyMemberEmail,
        status: data.status,
        permissions: data.permissions
      });
    });

    // Check 3: Look for any invitations for this email
    console.log('\n📝 Step 3: Checking for invitations by email...');
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('User data:', {
        email: userData.email,
        name: userData.name,
        userType: userData.userType
      });

      // Search for invitations by email
      const invitationQuery = await firestore.collection('family_calendar_access')
        .where('familyMemberEmail', '==', userData.email)
        .get();

      console.log(`Found ${invitationQuery.docs.length} invitations for email: ${userData.email}`);
      invitationQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  Invitation ${index + 1}:`, {
          id: doc.id,
          patientId: data.patientId,
          familyMemberId: data.familyMemberId,
          familyMemberName: data.familyMemberName,
          familyMemberEmail: data.familyMemberEmail,
          status: data.status,
          invitationToken: data.invitationToken,
          acceptedAt: data.acceptedAt,
          permissions: data.permissions
        });
      });
    } else {
      console.log('❌ User document not found');
    }

    // Check 4: Look for all family access records (to see the structure)
    console.log('\n📝 Step 4: Checking all family access records (first 10)...');
    const allAccessQuery = await firestore.collection('family_calendar_access')
      .limit(10)
      .get();

    console.log(`Found ${allAccessQuery.docs.length} total family access records`);
    allAccessQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  Record ${index + 1}:`, {
        id: doc.id,
        patientId: data.patientId,
        familyMemberId: data.familyMemberId,
        familyMemberEmail: data.familyMemberEmail,
        status: data.status
      });
    });

    console.log('\n🎉 Debug Complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugFamilyAccess()
  .then(() => {
    console.log('\n✅ Debug completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });