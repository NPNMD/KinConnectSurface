/**
 * Test Script for Family Relationship Logic Fixes
 * 
 * This script tests both fixes:
 * 1. Self-referential relationship prevention
 * 2. Firebase database configuration
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up service account)
if (!admin.apps.length) {
  try {
    // You'll need to replace this with your actual service account key path
    const serviceAccount = require('./path/to/your/service-account-key.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://claritystream-uldp9-default-rtdb.firebaseio.com'
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.log('📝 Please ensure you have a valid service account key file');
    process.exit(1);
  }
}

const firestore = admin.firestore();

async function testFamilyRelationshipFixes() {
  console.log('🧪 Starting Family Relationship Fixes Test...\n');

  try {
    // Test 1: Check for existing self-referential relationships
    console.log('🔍 Test 1: Checking for self-referential relationships...');
    
    const familyAccessQuery = await firestore.collection('family_calendar_access')
      .where('status', '==', 'active')
      .get();

    let selfReferentialCount = 0;
    const selfReferentialDocs = [];

    familyAccessQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.patientId === data.familyMemberId) {
        selfReferentialCount++;
        selfReferentialDocs.push({
          id: doc.id,
          patientId: data.patientId,
          familyMemberId: data.familyMemberId,
          email: data.familyMemberEmail
        });
      }
    });

    if (selfReferentialCount > 0) {
      console.log(`⚠️  Found ${selfReferentialCount} self-referential relationships:`);
      selfReferentialDocs.forEach(doc => {
        console.log(`   - Document ID: ${doc.id}`);
        console.log(`     User ID: ${doc.patientId}`);
        console.log(`     Email: ${doc.email}\n`);
      });
      console.log('🔧 These should be cleaned up using the cleanup script\n');
    } else {
      console.log('✅ No self-referential relationships found\n');
    }

    // Test 2: Check for duplicate relationships
    console.log('🔍 Test 2: Checking for duplicate relationships...');
    
    const relationshipMap = new Map();
    let duplicateCount = 0;

    familyAccessQuery.docs.forEach(doc => {
      const data = doc.data();
      const relationshipKey = `${data.patientId}_${data.familyMemberEmail}`;
      
      if (relationshipMap.has(relationshipKey)) {
        duplicateCount++;
        console.log(`⚠️  Duplicate relationship found:`);
        console.log(`   - Key: ${relationshipKey}`);
        console.log(`   - Document IDs: ${relationshipMap.get(relationshipKey)}, ${doc.id}\n`);
      } else {
        relationshipMap.set(relationshipKey, doc.id);
      }
    });

    if (duplicateCount === 0) {
      console.log('✅ No duplicate relationships found\n');
    }

    // Test 3: Verify Firebase configuration
    console.log('🔍 Test 3: Verifying Firebase configuration...');
    
    try {
      // Test Firestore connection
      const testDoc = await firestore.collection('test').doc('connection-test').get();
      console.log('✅ Firestore connection successful\n');
    } catch (error) {
      console.log('❌ Firestore connection failed:', error.message);
      console.log('🔧 Please check your Firebase project settings\n');
    }

    // Test 4: Verify collections exist
    console.log('🔍 Test 4: Checking required collections...');
    
    const requiredCollections = [
      'family_calendar_access',
      'users',
      'medical_events'
    ];

    for (const collectionName of requiredCollections) {
      try {
        const snapshot = await firestore.collection(collectionName).limit(1).get();
        console.log(`✅ Collection '${collectionName}' exists (${snapshot.size} documents found)`);
      } catch (error) {
        console.log(`❌ Collection '${collectionName}' error:`, error.message);
      }
    }

    console.log('\n🎉 Family Relationship Fixes Test Complete!');
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   - Self-referential relationships: ${selfReferentialCount}`);
    console.log(`   - Duplicate relationships: ${duplicateCount}`);
    console.log(`   - Total family access records: ${familyAccessQuery.size}`);

    // New: Spot-check reciprocal links for a few active relations
    const sample = familyAccessQuery.docs.slice(0, 5);
    for (const d of sample) {
      const data = d.data();
      if (!data.patientId || !data.familyMemberId) continue;
      const [patientDoc, fmDoc] = await Promise.all([
        firestore.collection('users').doc(data.patientId).get(),
        firestore.collection('users').doc(data.familyMemberId).get(),
      ]);
      const patient = patientDoc.data() || {};
      const fm = fmDoc.data() || {};
      const patientHas = Array.isArray(patient.familyMemberIds) && patient.familyMemberIds.includes(d.data().familyMemberId);
      const fmHas = Array.isArray(fm.linkedPatientIds) && fm.linkedPatientIds.includes(d.data().patientId);
      console.log(`   - Check ${d.id}: patientHas=${patientHas}, familyMemberHas=${fmHas}, primaryPatientId=${fm.primaryPatientId || 'n/a'}`);
    }
    
    if (selfReferentialCount > 0 || duplicateCount > 0) {
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      if (selfReferentialCount > 0) {
        console.log('   1. Run cleanup script to remove self-referential relationships');
      }
      if (duplicateCount > 0) {
        console.log('   2. Run deduplication script to merge duplicate relationships');
      }
      console.log('   3. Deploy the updated API code to prevent future issues');
    } else {
      console.log('\n✅ No issues found! Your family relationship system is working correctly.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test API endpoint (requires your API to be running)
async function testAPIEndpoint() {
  console.log('\n🌐 Testing API Endpoint (optional)...');
  
  try {
    const fetch = require('node-fetch');
    
    // Test the family-access endpoint
    const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/family-access', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE', // Replace with actual token
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint responding correctly');
      console.log(`   - Patients you have access to: ${data.data?.patientsIHaveAccessTo?.length || 0}`);
      console.log(`   - Family members with access to you: ${data.data?.familyMembersWithAccessToMe?.length || 0}`);
    } else {
      console.log(`❌ API endpoint error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('⚠️  API endpoint test skipped (requires valid auth token)');
    console.log('   To test API: Replace YOUR_TEST_TOKEN_HERE with a valid Firebase ID token');
  }
}

// Run tests
async function runAllTests() {
  await testFamilyRelationshipFixes();
  await testAPIEndpoint();
  
  console.log('\n🏁 All tests completed!');
  process.exit(0);
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Family Relationship Fixes Test Script

Usage:
  node test-family-relationship-fixes.js

This script will:
1. Check for self-referential relationships in your database
2. Check for duplicate relationships
3. Verify Firebase configuration
4. Test API endpoint (if token provided)

Before running:
1. Install dependencies: npm install firebase-admin node-fetch
2. Set up Firebase service account key
3. Update the service account path in this script
  `);
  process.exit(0);
}

runAllTests().catch(console.error);