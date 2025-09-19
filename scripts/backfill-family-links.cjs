#!/usr/bin/env node
/*
 Backfill reciprocal links between users based on family_calendar_access.
 - Ensures each active access writes:
   - users/{familyMemberId}.linkedPatientIds += patientId
   - users/{familyMemberId}.primaryPatientId set if missing
   - users/{patientId}.familyMemberIds += familyMemberId
 - Optionally repairs missing familyMemberId using email when unique.
*/

const admin = require('firebase-admin');
const path = require('path');

async function initAdmin() {
  if (admin.apps.length) return;
  try {
    const servicePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '..', 'claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
    const serviceAccount = require(servicePath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e.message);
    process.exit(1);
  }
}

async function backfill() {
  await initAdmin();
  const db = admin.firestore();

  const snapshot = await db.collection('family_calendar_access').where('status', '==', 'active').get();
  console.log(`🔍 Found ${snapshot.size} active family access records`);

  let repairedByEmail = 0;
  let linkedCount = 0;

  for (const doc of snapshot.docs) {
    const access = doc.data();
    const patientId = access.patientId;
    let familyMemberId = access.familyMemberId;

    if (!patientId) {
      console.warn(`⚠️ Skipping ${doc.id} - missing patientId`);
      continue;
    }

    // Optional: repair familyMemberId using email if unique
    if (!familyMemberId && access.familyMemberEmail) {
      const email = String(access.familyMemberEmail).toLowerCase();
      const userQuery = await db.collection('users').where('email', '==', email).limit(2).get();
      if (userQuery.size === 1) {
        familyMemberId = userQuery.docs[0].id;
        await doc.ref.update({ familyMemberId, updatedAt: admin.firestore.Timestamp.now(), repairedAt: admin.firestore.Timestamp.now(), repairReason: 'backfill_missing_family_member_id' });
        repairedByEmail += 1;
        console.log(`🔧 Repaired familyMemberId for ${doc.id} -> ${familyMemberId}`);
      } else {
        console.warn(`⚠️ Cannot repair familyMemberId for ${doc.id} (email not unique or not found)`);
      }
    }

    if (!familyMemberId) continue;

    const userRef = db.collection('users').doc(familyMemberId);
    const patientRef = db.collection('users').doc(patientId);

    await db.runTransaction(async (tx) => {
      const [userSnap, patientSnap] = await Promise.all([tx.get(userRef), tx.get(patientRef)]);

      const userUpdates = {
        linkedPatientIds: admin.firestore.FieldValue.arrayUnion(patientId),
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (!userSnap.exists || !userSnap.data().primaryPatientId) {
        userUpdates.primaryPatientId = patientId;
      }
      tx.set(userRef, userUpdates, { merge: true });

      tx.set(
        patientRef,
        { familyMemberIds: admin.firestore.FieldValue.arrayUnion(familyMemberId), updatedAt: admin.firestore.Timestamp.now() },
        { merge: true }
      );
    });

    linkedCount += 1;
  }

  console.log(`✅ Backfill complete. Linked: ${linkedCount}, Repaired by email: ${repairedByEmail}`);
}

backfill().catch((e) => {
  console.error('❌ Backfill failed:', e);
  process.exit(1);
});


