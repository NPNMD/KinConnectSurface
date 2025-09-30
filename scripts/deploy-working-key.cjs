const { execSync } = require('child_process');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';

console.log('🚀 DEPLOYING WORKING API KEY\n');
console.log('=' .repeat(60));

// Step 1: Update Firebase secret
console.log('\n📝 Step 1: Updating Firebase secret...');
try {
  execSync(
    `firebase functions:secrets:set GOOGLE_AI_API_KEY --data-file=- <<< "${API_KEY}"`,
    { 
      stdio: 'inherit',
      shell: true
    }
  );
  console.log('✅ Firebase secret updated successfully!');
} catch (error) {
  console.error('❌ Failed to update Firebase secret:', error.message);
  console.log('\n⚠️  Trying alternative method...');
  try {
    // Alternative: Use echo and pipe
    execSync(
      `echo ${API_KEY} | firebase functions:secrets:set GOOGLE_AI_API_KEY`,
      { 
        stdio: 'inherit',
        shell: true
      }
    );
    console.log('✅ Firebase secret updated successfully (alternative method)!');
  } catch (altError) {
    console.error('❌ Alternative method also failed:', altError.message);
    console.log('\n📋 Manual step required:');
    console.log('   Run this command manually:');
    console.log(`   firebase functions:secrets:set GOOGLE_AI_API_KEY`);
    console.log(`   Then paste: ${API_KEY}`);
    process.exit(1);
  }
}

// Step 2: Deploy functions
console.log('\n📝 Step 2: Deploying Firebase functions...');
try {
  execSync('firebase deploy --only functions', { 
    stdio: 'inherit',
    shell: true
  });
  console.log('✅ Functions deployed successfully!');
} catch (error) {
  console.error('❌ Failed to deploy functions:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('\n🎉 DEPLOYMENT COMPLETE!\n');
console.log('✅ API Key: AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY');
console.log('✅ Firebase secret updated');
console.log('✅ Functions deployed');
console.log('\n📋 Next: Verify the deployment by checking Firebase logs');