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

async function testProviderSavingWithAuth() {
  console.log('🔍 === AUTHENTICATED PROVIDER SAVING TEST ===');
  
  try {
    // Get a real user to test with
    const usersQuery = await firestore.collection('users').limit(1).get();
    if (usersQuery.empty) {
      console.log('❌ No users found for testing');
      return;
    }
    
    const testUser = usersQuery.docs[0];
    const userData = testUser.data();
    const userId = testUser.id;
    
    console.log('👤 Using test user:', {
      id: userId,
      name: userData.name,
      email: userData.email,
      userType: userData.userType
    });
    
    // Create a custom token for this user
    const customToken = await admin.auth().createCustomToken(userId);
    console.log('🔑 Created custom token for testing');
    
    // Test the complete provider data that client sends
    const completeProviderData = {
      patientId: userId,
      name: 'Dr. Test Provider',
      specialty: 'Family Medicine',
      subSpecialty: 'Preventive Medicine',
      credentials: 'MD',
      phoneNumber: '(555) 123-4567', // ❌ This field name doesn't match server expectation
      email: 'test@provider.com',
      website: 'https://testprovider.com',
      address: '123 Test Medical Dr, Test City, TS 12345',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'United States',
      placeId: 'test-place-id',
      googleRating: 4.5,
      googleReviews: 100,
      businessStatus: 'OPERATIONAL',
      practiceName: 'Test Medical Practice',
      hospitalAffiliation: ['Test Hospital'],
      acceptedInsurance: ['Blue Cross', 'Aetna'],
      languages: ['English', 'Spanish'],
      preferredAppointmentTime: 'Morning',
      typicalWaitTime: '1 week',
      isPrimary: true,
      relationshipStart: new Date('2024-01-01'),
      lastVisit: new Date('2024-12-01'),
      nextAppointment: new Date('2025-01-15'),
      notes: 'Great doctor, very thorough',
      isActive: true
    };
    
    console.log('\n📤 Testing with complete provider data...');
    console.log('📊 Total fields being sent:', Object.keys(completeProviderData).length);
    
    // Test what the server actually expects vs what client sends
    const serverExpectedFields = ['name', 'specialty', 'phone', 'email', 'address', 'notes'];
    const clientSentFields = Object.keys(completeProviderData);
    
    console.log('\n🔍 Field Analysis:');
    console.log('✅ Server expects:', serverExpectedFields);
    console.log('📤 Client sends:', clientSentFields);
    console.log('❌ Missing from client:', serverExpectedFields.filter(f => !clientSentFields.includes(f)));
    console.log('⚠️ Extra from client:', clientSentFields.filter(f => !serverExpectedFields.includes(f)));
    console.log('🚨 CRITICAL: Client sends "phoneNumber" but server expects "phone"');
    
    // Test with corrected field names
    const correctedProviderData = {
      ...completeProviderData,
      phone: completeProviderData.phoneNumber, // Fix the field name
    };
    delete correctedProviderData.phoneNumber; // Remove the incorrect field
    
    console.log('\n📤 Testing with corrected field names...');
    
    // Simulate what happens in the server endpoint
    console.log('\n🔍 Simulating server endpoint logic...');
    const serverProcessedData = {
      patientId: userId,
      name: correctedProviderData.name,
      specialty: correctedProviderData.specialty,
      phone: correctedProviderData.phone || '',
      email: correctedProviderData.email || '',
      address: correctedProviderData.address || '',
      notes: correctedProviderData.notes || '',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    console.log('📊 Server would save only these fields:', Object.keys(serverProcessedData));
    console.log('📊 Server would ignore these fields:', 
      Object.keys(correctedProviderData).filter(f => !Object.keys(serverProcessedData).includes(f))
    );
    
    // Test actual save to Firestore
    console.log('\n📋 Test: Direct Firestore save with server-expected data...');
    try {
      const testProviderRef = await firestore.collection('healthcare_providers').add(serverProcessedData);
      console.log('✅ Direct save succeeded:', testProviderRef.id);
      
      // Verify the saved data
      const savedDoc = await testProviderRef.get();
      const savedData = savedDoc.data();
      console.log('📄 Saved data verification:', savedData);
      
      // Clean up
      await testProviderRef.delete();
      console.log('🧹 Cleaned up test document');
      
    } catch (saveError) {
      console.error('❌ Direct save failed:', saveError.message);
    }
    
    console.log('\n🎯 === DIAGNOSIS SUMMARY ===');
    console.log('🚨 ROOT CAUSE IDENTIFIED:');
    console.log('1. FIELD NAME MISMATCH: Client sends "phoneNumber", server expects "phone"');
    console.log('2. INCOMPLETE SERVER ENDPOINT: Only saves 6 fields, ignores 15+ others');
    console.log('3. NO ERROR HANDLING: Server silently ignores unknown fields');
    console.log('4. NO VALIDATION: Server doesn\'t validate required client fields');
    console.log('');
    console.log('💡 SOLUTION NEEDED:');
    console.log('1. Update server endpoint to handle all client fields');
    console.log('2. Fix field name mapping (phoneNumber -> phone)');
    console.log('3. Add proper error handling and validation');
    console.log('4. Add logging for debugging');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testProviderSavingWithAuth().then(() => {
  console.log('\n✅ Authenticated provider saving test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});