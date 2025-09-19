const https = require('https');

async function testRepairAPI() {
    console.log('🧪 === TESTING REPAIR API ENDPOINT ===');
    
    // Test the health endpoint first (no auth required)
    console.log('🔍 Step 1: Testing health endpoint...');
    
    const healthOptions = {
        hostname: 'us-central1-claritystream-uldp9.cloudfunctions.net',
        port: 443,
        path: '/api/health',
        method: 'GET'
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(healthOptions, (res) => {
            let data = '';
            
            console.log(`📡 Health endpoint status: ${res.statusCode}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Health endpoint response:', response);
                    
                    if (response.success) {
                        console.log('✅ Backend is healthy and deployed correctly!');
                        console.log('\n📋 NEXT STEPS TO RUN REPAIR:');
                        console.log('1. Go to: https://claritystream-uldp9.web.app');
                        console.log('2. Sign in as the family member (fookwin@gmail.com) or any patient');
                        console.log('3. Open browser developer tools (F12)');
                        console.log('4. Go to Console tab');
                        console.log('5. Run this command:');
                        console.log(`
fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/repair-family-member-patient-links', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('firebase:authUser:AIzaSyBqg7_Zt8Zt8Zt8Zt8Zt8Zt8Zt8Zt8Zt8:claritystream-uldp9')?.split('"accessToken":"')[1]?.split('"')[0]
    },
    body: JSON.stringify({})
})
.then(response => response.json())
.then(data => {
    console.log('🔧 Repair Results:', data);
    if (data.success) {
        console.log('✅ REPAIR COMPLETED!');
        console.log('📊 Summary:', data.data);
    } else {
        console.error('❌ Repair failed:', data.error);
    }
})
.catch(error => console.error('❌ Error:', error));
                        `);
                        console.log('\n6. The repair will run and show results in the console');
                        console.log('7. After repair, test family member login to verify access');
                        
                        resolve(response);
                    } else {
                        reject(new Error('Backend health check failed'));
                    }
                } catch (parseError) {
                    console.error('❌ Failed to parse health response:', parseError);
                    console.log('Raw response:', data);
                    reject(parseError);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Health check request failed:', error);
            reject(error);
        });
        
        req.end();
    });
}

// Alternative: Create a simple browser-based repair tool
function createBrowserRepairInstructions() {
    console.log('\n🌐 === BROWSER-BASED REPAIR TOOL ===');
    console.log('Copy and paste this into the browser console after signing in:');
    console.log(`
// Family Member Patient Links Repair Tool
(async function repairFamilyMemberLinks() {
    console.log('🔧 Starting family member patient links repair...');
    
    try {
        // Get auth token from localStorage
        const authData = JSON.parse(localStorage.getItem('firebase:authUser:AIzaSyBqg7_Zt8Zt8Zt8Zt8Zt8Zt8Zt8Zt8Zt8:claritystream-uldp9') || '{}');
        const token = authData.accessToken;
        
        if (!token) {
            console.error('❌ No auth token found. Please sign in first.');
            return;
        }
        
        console.log('🚀 Calling repair endpoint...');
        
        const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/repair-family-member-patient-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ REPAIR COMPLETED SUCCESSFULLY!');
            console.log('📊 Repair Results:', result.data);
            console.log('📊 Summary:');
            console.log('   Family members scanned:', result.data.familyMembersScanned);
            console.log('   Family members needing repair:', result.data.familyMembersNeedingRepair);
            console.log('   Family members repaired:', result.data.familyMembersRepaired);
            console.log('   Patient documents updated:', result.data.patientsUpdated);
            console.log('   Errors:', result.data.errors.length);
            
            if (result.data.errors.length > 0) {
                console.log('❌ Errors encountered:');
                result.data.errors.forEach((error, index) => {
                    console.log('   ' + (index + 1) + '. ' + error);
                });
            }
            
            if (result.data.familyMembersRepaired > 0) {
                console.log('\\n🎉 SUCCESS! Family member patient links have been repaired!');
                console.log('🔄 Please refresh the page to see the changes.');
            }
        } else {
            console.error('❌ REPAIR FAILED:', result.error);
        }
    } catch (error) {
        console.error('❌ Error calling repair endpoint:', error);
    }
})();
    `);
}

// Run the test
if (require.main === module) {
    testRepairAPI()
        .then(() => {
            console.log('\n🏁 Health check completed successfully');
            createBrowserRepairInstructions();
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Health check failed:', error);
            console.log('\n🌐 You can still try the browser-based repair:');
            createBrowserRepairInstructions();
            process.exit(1);
        });
}

module.exports = { testRepairAPI };