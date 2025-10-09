/**
 * Inspect medication_commands collection to understand data structure
 */

const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

async function inspectMedicationCommands() {
  console.log('🔍 INSPECTING medication_commands COLLECTION');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('medication_commands').limit(5).get();
  
  console.log(`\nTotal documents found: ${snapshot.size}`);
  console.log('\nSample documents:\n');
  
  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`Document ${index + 1} (ID: ${doc.id}):`);
    console.log('  Fields:', Object.keys(data).join(', '));
    console.log('  Structure:');
    console.log('    - Has userId?', 'userId' in data);
    console.log('    - Has patientId?', 'patientId' in data);
    console.log('    - Has medicationId?', 'medicationId' in data);
    console.log('    - Has action?', 'action' in data);
    console.log('    - Has medication object?', 'medication' in data);
    console.log('    - Has schedule object?', 'schedule' in data);
    console.log('    - Has status object?', 'status' in data);
    console.log('    - Has metadata object?', 'metadata' in data);
    
    if ('action' in data) {
      console.log('    - Action type:', data.action);
    }
    
    if ('medicationId' in data) {
      console.log('    - References medication:', data.medicationId);
    }
    
    console.log('  Full data:', JSON.stringify(data, null, 2));
    console.log('\n' + '-'.repeat(80) + '\n');
  });
  
  // Check if these are commands or medications
  const commandsCount = await db.collection('medication_commands')
    .where('action', '!=', null)
    .limit(1000)
    .get();
  
  const medicationsCount = await db.collection('medication_commands')
    .where('medication', '!=', null)
    .limit(1000)
    .get();
  
  console.log('ANALYSIS:');
  console.log(`  Documents with 'action' field (commands): ${commandsCount.size}`);
  console.log(`  Documents with 'medication' object (medications): ${medicationsCount.size}`);
  
  if (commandsCount.size > 0 && medicationsCount.size === 0) {
    console.log('\n❌ PROBLEM: medication_commands contains ONLY command records');
    console.log('   This collection should contain medication definitions, not commands!');
    console.log('   Commands should be in a separate collection or events.');
  } else if (medicationsCount.size > 0) {
    console.log('\n✅ GOOD: medication_commands contains medication definitions');
  }
}

inspectMedicationCommands()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });