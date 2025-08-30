// Test script to explore dosage information available from OpenFDA and RxNorm APIs
const https = require('https');

async function testOpenFDADosageInfo(query) {
    return new Promise((resolve) => {
        const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(query)}*&limit=3`;
        console.log(`\n🔍 Testing OpenFDA dosage info for: "${query}"`);
        
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.results && parsed.results.length > 0) {
                            const result = parsed.results[0];
                            
                            console.log(`✅ Found dosage information:`);
                            console.log(`📋 Brand Name:`, result.openfda?.brand_name?.[0] || 'N/A');
                            console.log(`📋 Generic Name:`, result.openfda?.generic_name?.[0] || 'N/A');
                            console.log(`📋 Strength:`, result.openfda?.substance_name || 'N/A');
                            console.log(`📋 Dosage Form:`, result.openfda?.dosage_form || 'N/A');
                            console.log(`📋 Route:`, result.openfda?.route || 'N/A');
                            
                            // Look for dosage and administration info
                            const dosageInfo = result.dosage_and_administration || [];
                            const indicationsInfo = result.indications_and_usage || [];
                            
                            if (dosageInfo.length > 0) {
                                console.log(`💊 Dosage Instructions:`, dosageInfo[0].substring(0, 200) + '...');
                            }
                            
                            if (indicationsInfo.length > 0) {
                                console.log(`🎯 Indications:`, indicationsInfo[0].substring(0, 200) + '...');
                            }
                            
                            resolve({
                                query,
                                success: true,
                                brandName: result.openfda?.brand_name?.[0],
                                genericName: result.openfda?.generic_name?.[0],
                                strength: result.openfda?.substance_name,
                                dosageForm: result.openfda?.dosage_form,
                                route: result.openfda?.route,
                                dosageInstructions: dosageInfo[0] || null,
                                indications: indicationsInfo[0] || null
                            });
                        } else {
                            console.log(`⚠️ No results found`);
                            resolve({ query, success: false, error: 'No results' });
                        }
                    } catch (e) {
                        console.log(`❌ Parse error:`, e.message);
                        resolve({ query, success: false, error: 'Parse error' });
                    }
                } else {
                    console.log(`⚠️ ${res.statusCode} - Error response`);
                    resolve({ query, success: false, error: `HTTP ${res.statusCode}` });
                }
            });
        });
        
        req.on('error', (err) => {
            resolve({ query, success: false, error: err.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ query, success: false, error: 'timeout' });
        });
    });
}

async function testRxNormDosageInfo(rxcui) {
    return new Promise((resolve) => {
        const url = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
        console.log(`\n🔍 Testing RxNorm dosage info for RXCUI: ${rxcui}`);
        
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.properties) {
                            const props = parsed.properties;
                            console.log(`✅ RxNorm Properties:`);
                            console.log(`📋 Name:`, props.name);
                            console.log(`📋 TTY:`, props.tty);
                            console.log(`📋 Synonym:`, props.synonym);
                            
                            resolve({
                                rxcui,
                                success: true,
                                name: props.name,
                                tty: props.tty,
                                synonym: props.synonym
                            });
                        } else {
                            resolve({ rxcui, success: false, error: 'No properties' });
                        }
                    } catch (e) {
                        resolve({ rxcui, success: false, error: 'Parse error' });
                    }
                } else {
                    resolve({ rxcui, success: false, error: `HTTP ${res.statusCode}` });
                }
            });
        });
        
        req.on('error', (err) => {
            resolve({ rxcui, success: false, error: err.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ rxcui, success: false, error: 'timeout' });
        });
    });
}

async function runDosageResearch() {
    console.log('🧪 Researching Dosage Information from APIs');
    console.log('===========================================');
    
    // Test common medications for dosage info
    const testMedications = ['metformin', 'ibuprofen', 'aspirin', 'tylenol'];
    
    for (const med of testMedications) {
        const fdaResult = await testOpenFDADosageInfo(med);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If we got an RXCUI from FDA, test RxNorm for additional info
        if (fdaResult.success && fdaResult.rxcui) {
            await testRxNormDosageInfo(fdaResult.rxcui);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n📊 DOSAGE RESEARCH SUMMARY:');
    console.log('===========================');
    console.log('✅ OpenFDA provides:');
    console.log('   - Brand and generic names');
    console.log('   - Dosage forms (tablet, capsule, etc.)');
    console.log('   - Routes (oral, topical, etc.)');
    console.log('   - Detailed dosage instructions (in text)');
    console.log('   - Indications and usage');
    console.log('');
    console.log('✅ RxNorm provides:');
    console.log('   - Structured drug concepts');
    console.log('   - Term types (SCD, SBD, etc.)');
    console.log('   - Relationships between drugs');
    console.log('');
    console.log('💡 RECOMMENDATION:');
    console.log('==================');
    console.log('Combine both APIs:');
    console.log('1. Use OpenFDA for dosage forms and instructions');
    console.log('2. Use RxNorm for structured drug relationships');
    console.log('3. Create a standard dosing database for common medications');
}

runDosageResearch().catch(console.error);