const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function testProviderSaving() {
  console.log('🔍 === PROVIDER SAVING DEBUG TEST ===');
  
  try {
    // Test 1: Check if healthcare_providers collection exists and has proper permissions
    console.log('\n📋 Test 1: Checking healthcare_providers collection...');
    
    const providersQuery = await firestore.collection('healthcare_providers').limit(1).get();
    console.log('✅ Collection accessible, documents found:', providersQuery.docs.length);
    
    if (!providersQuery.empty) {
      const sampleDoc = providersQuery.docs[0];
      console.log('📄 Sample document structure:', Object.keys(sampleDoc.data()));
      console.log('📄 Sample document data:', sampleDoc.data());
    }
    
    // Test 2: Test direct API endpoint with sample data
    console.log('\n📋 Test 2: Testing API endpoint directly...');
    
    const testProviderData = {
      patientId: 'test-patient-id',
      name: 'Dr. Test Provider',
      specialty: 'Family Medicine',
      address: '123 Test St, Test City, TS 12345',
      phoneNumber: '(555) 123-4567',
      email: 'test@provider.com',
      isActive: true
    };
    
    console.log('📤 Sending test data:', testProviderData);
    
    // Test the API endpoint
    const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/healthcare/providers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail auth, but we want to see what error we get
      },
      body: JSON.stringify(testProviderData)
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Response body:', responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('📥 Parsed response:', responseData);
    } catch (parseError) {
      console.log('❌ Failed to parse response as JSON');
    }
    
    // Test 3: Check Firestore security rules by attempting direct write
    console.log('\n📋 Test 3: Testing Firestore security rules...');
    
    try {
      // This should fail due to security rules, but let's see the error
      const testDoc = await firestore.collection('healthcare_providers').add({
        patientId: 'test-patient-id',
        name: 'Test Provider',
        specialty: 'Test Specialty',
        address: 'Test Address',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log('✅ Direct Firestore write succeeded (unexpected):', testDoc.id);
      
      // Clean up test document
      await testDoc.delete();
      console.log('🧹 Cleaned up test document');
      
    } catch (firestoreError) {
      console.log('❌ Direct Firestore write failed (expected):', firestoreError.message);
    }
    
    // Test 4: Check family_calendar_access collection structure
    console.log('\n📋 Test 4: Checking family_calendar_access collection...');
    
    const familyAccessQuery = await firestore.collection('family_calendar_access').limit(3).get();
    console.log('📊 Family access documents found:', familyAccessQuery.docs.length);
    
    if (!familyAccessQuery.empty) {
      familyAccessQuery.docs.forEach((doc, index) => {
        console.log(`📄 Family access doc ${index + 1} ID pattern:`, doc.id);
        console.log(`📄 Family access doc ${index + 1} data:`, doc.data());
      });
    }
    
    // Test 5: Check server endpoint logs
    console.log('\n📋 Test 5: Checking server endpoint implementation...');
    console.log('🔍 Server endpoint expects these fields:');
    console.log('  - name (required)');
    console.log('  - specialty (required)');
    console.log('  - phone (optional)');
    console.log('  - email (optional)');
    console.log('  - address (optional)');
    console.log('  - notes (optional)');
    
    console.log('\n🔍 Client sends these fields:');
    console.log('  - patientId');
    console.log('  - name');
    console.log('  - specialty');
    console.log('  - subSpecialty');
    console.log('  - credentials');
    console.log('  - phoneNumber');
    console.log('  - email');
    console.log('  - website');
    console.log('  - address');
    console.log('  - city, state, zipCode, country');
    console.log('  - placeId, googleRating, googleReviews');
    console.log('  - businessStatus, practiceName');
    console.log('  - hospitalAffiliation, acceptedInsurance, languages');
    console.log('  - preferredAppointmentTime, typicalWaitTime');
    console.log('  - isPrimary, relationshipStart, lastVisit, nextAppointment');
    console.log('  - notes, isActive');
    
    console.log('\n🚨 POTENTIAL ISSUES IDENTIFIED:');
    console.log('1. Field name mismatch: client sends "phoneNumber", server expects "phone"');
    console.log('2. Server endpoint is very basic - only handles 6 fields');
    console.log('3. Client sends 20+ fields but server ignores most of them');
    console.log('4. No error handling for field validation mismatches');
    console.log('5. Firestore security rules may block writes due to document ID patterns');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testProviderSaving().then(() => {
  console.log('\n✅ Provider saving debug test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});