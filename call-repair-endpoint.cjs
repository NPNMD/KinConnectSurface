const https = require('https');

// Function to make authenticated API call to repair endpoint
async function callRepairEndpoint() {
    console.log('🔧 === CALLING REPAIR ENDPOINT ===');
    console.log('🔧 Calling family member patient links repair endpoint...');
    
    // You'll need to get an auth token from the browser
    console.log('\n📋 INSTRUCTIONS:');
    console.log('1. Open the browser and go to: https://claritystream-uldp9.web.app');
    console.log('2. Sign in as any user (patient or family member)');
    console.log('3. Open browser developer tools (F12)');
    console.log('4. Go to Application/Storage > Local Storage > https://claritystream-uldp9.web.app');
    console.log('5. Find the Firebase auth token (usually under a key like "firebase:authUser:...")');
    console.log('6. Copy the "accessToken" value');
    console.log('7. Run this script with the token: node call-repair-endpoint.cjs YOUR_TOKEN_HERE');
    console.log('\nAlternatively, you can call the endpoint directly:');
    console.log('POST https://us-central1-claritystream-uldp9.cloudfunctions.net/api/repair-family-member-patient-links');
    console.log('Authorization: Bearer YOUR_TOKEN_HERE');
    
    const token = process.argv[2];
    
    if (!token) {
        console.log('\n❌ No auth token provided. Please follow the instructions above.');
        process.exit(1);
    }
    
    console.log('\n🚀 Making API call to repair endpoint...');
    
    const postData = JSON.stringify({});
    
    const options = {
        hostname: 'us-central1-claritystream-uldp9.cloudfunctions.net',
        port: 443,
        path: '/api/repair-family-member-patient-links',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`📡 Response status: ${res.statusCode}`);
            console.log(`📡 Response headers:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('\n📊 Repair Results:');
                    console.log(JSON.stringify(response, null, 2));
                    
                    if (response.success) {
                        console.log('\n✅ REPAIR COMPLETED SUCCESSFULLY!');
                        console.log(`📊 Summary:`);
                        console.log(`   Family members scanned: ${response.data.familyMembersScanned}`);
                        console.log(`   Family members needing repair: ${response.data.familyMembersNeedingRepair}`);
                        console.log(`   Family members repaired: ${response.data.familyMembersRepaired}`);
                        console.log(`   Patient documents updated: ${response.data.patientsUpdated}`);
                        console.log(`   Errors: ${response.data.errors.length}`);
                        
                        if (response.data.errors.length > 0) {
                            console.log('\n❌ Errors encountered:');
                            response.data.errors.forEach((error, index) => {
                                console.log(`   ${index + 1}. ${error}`);
                            });
                        }
                        
                        resolve(response);
                    } else {
                        console.log('\n❌ REPAIR FAILED:');
                        console.log(`Error: ${response.error}`);
                        reject(new Error(response.error));
                    }
                } catch (parseError) {
                    console.error('❌ Failed to parse response:', parseError);
                    console.log('Raw response:', data);
                    reject(parseError);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request failed:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Run the repair call
if (require.main === module) {
    callRepairEndpoint()
        .then(() => {
            console.log('\n🏁 Repair endpoint call completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Repair endpoint call failed:', error);
            process.exit(1);
        });
}

module.exports = { callRepairEndpoint };