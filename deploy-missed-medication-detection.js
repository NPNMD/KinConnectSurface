const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 === MISSED MEDICATION DETECTION DEPLOYMENT ===');

// Deployment steps
const deploymentSteps = [
  {
    name: 'Validate TypeScript compilation',
    command: 'cd functions && npm run build',
    description: 'Compile TypeScript to ensure no syntax errors'
  },
  {
    name: 'Deploy Firestore indexes',
    command: 'firebase deploy --only firestore:indexes',
    description: 'Deploy new composite indexes for missed medication queries'
  },
  {
    name: 'Deploy Firestore security rules',
    command: 'firebase deploy --only firestore:rules',
    description: 'Deploy updated security rules for grace period collections'
  },
  {
    name: 'Deploy Cloud Functions',
    command: 'firebase deploy --only functions',
    description: 'Deploy the new missed medication detection function and API endpoints'
  }
];

async function deployMissedMedicationDetection() {
  console.log('📋 Deployment Plan:');
  deploymentSteps.forEach((step, index) => {
    console.log(`   ${index + 1}. ${step.name}`);
    console.log(`      ${step.description}`);
  });
  
  console.log('\n🔧 Starting deployment...\n');
  
  for (const [index, step] of deploymentSteps.entries()) {
    console.log(`📋 Step ${index + 1}: ${step.name}`);
    console.log(`   Command: ${step.command}`);
    
    try {
      const startTime = Date.now();
      const output = execSync(step.command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: process.cwd()
      });
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Completed in ${Math.round(duration / 1000)}s`);
      
      // Show relevant output for each step
      if (step.name.includes('TypeScript')) {
        console.log('   📊 TypeScript compilation successful');
      } else if (step.name.includes('indexes')) {
        console.log('   📊 Firestore indexes deployed');
      } else if (step.name.includes('rules')) {
        console.log('   📊 Security rules deployed');
      } else if (step.name.includes('Functions')) {
        console.log('   📊 Cloud Functions deployed');
        // Extract function names from output
        const functionMatches = output.match(/✔\s+functions\[([^\]]+)\]/g);
        if (functionMatches) {
          console.log('   📋 Deployed functions:');
          functionMatches.forEach(match => {
            const functionName = match.match(/functions\[([^\]]+)\]/)[1];
            console.log(`      - ${functionName}`);
          });
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Step ${index + 1} failed:`, error.message);
      
      // Show specific error guidance
      if (step.name.includes('TypeScript')) {
        console.log('   💡 Fix TypeScript errors before proceeding');
      } else if (step.name.includes('indexes')) {
        console.log('   💡 Check firestore.indexes.json for syntax errors');
      } else if (step.name.includes('rules')) {
        console.log('   💡 Check firestore.rules for syntax errors');
      } else if (step.name.includes('Functions')) {
        console.log('   💡 Check functions/src/ for compilation errors');
      }
      
      console.log('\n❌ Deployment failed. Please fix the errors and try again.');
      process.exit(1);
    }
  }
  
  console.log('\n✅ === DEPLOYMENT COMPLETED SUCCESSFULLY ===');
  console.log('\n📋 What was deployed:');
  console.log('   ✅ Grace Period Engine service');
  console.log('   ✅ Missed Medication Detector service');
  console.log('   ✅ Scheduled function: detectMissedMedications (runs every 15 minutes)');
  console.log('   ✅ API endpoints for grace period management');
  console.log('   ✅ API endpoints for missed medication tracking');
  console.log('   ✅ Enhanced Firestore indexes for efficient queries');
  console.log('   ✅ Updated security rules for new collections');
  
  console.log('\n📋 Next steps:');
  console.log('   1. Monitor the detectMissedMedications function in Firebase Console');
  console.log('   2. Test the new API endpoints with real data');
  console.log('   3. Verify grace period calculations are working correctly');
  console.log('   4. Check that missed medications are being detected automatically');
  
  console.log('\n🔗 Useful Firebase Console links:');
  console.log('   Functions: https://console.firebase.google.com/project/claritystream-uldp9/functions');
  console.log('   Firestore: https://console.firebase.google.com/project/claritystream-uldp9/firestore');
  console.log('   Logs: https://console.firebase.google.com/project/claritystream-uldp9/functions/logs');
}

// Validate deployment prerequisites
function validatePrerequisites() {
  console.log('🔍 Validating deployment prerequisites...');
  
  const requiredFiles = [
    'functions/src/services/gracePeriodEngine.ts',
    'functions/src/services/missedMedicationDetector.ts',
    'firestore.indexes.json',
    'firestore.rules',
    'shared/types.ts'
  ];
  
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
  }
  
  console.log('✅ All required files present');
  
  // Check if Firebase CLI is available
  try {
    execSync('firebase --version', { stdio: 'pipe' });
    console.log('✅ Firebase CLI available');
  } catch (error) {
    console.error('❌ Firebase CLI not found. Please install it first:');
    console.error('   npm install -g firebase-tools');
    process.exit(1);
  }
  
  // Check if logged in to Firebase
  try {
    execSync('firebase projects:list', { stdio: 'pipe' });
    console.log('✅ Firebase authentication verified');
  } catch (error) {
    console.error('❌ Not logged in to Firebase. Please run:');
    console.error('   firebase login');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  validatePrerequisites();
  deployMissedMedicationDetection().catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = {
  deployMissedMedicationDetection,
  validatePrerequisites
};