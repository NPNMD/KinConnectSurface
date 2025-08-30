// Test script to see exactly what dosage data we can extract from OpenFDA
const https = require('https');

async function testOpenFDADetailedData(query) {
    return new Promise((resolve) => {
        const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(query)}*&limit=1`;
        console.log(`\n🔍 Testing detailed OpenFDA data for: "${query}"`);
        
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.results && parsed.results.length > 0) {
                            const result = parsed.results[0];
                            
                            console.log(`✅ Detailed data available:`);
                            console.log(`📋 Brand Name:`, result.openfda?.brand_name?.[0] || 'N/A');
                            console.log(`📋 Generic Name:`, result.openfda?.generic_name?.[0] || 'N/A');
                            console.log(`📋 Substance Name:`, result.openfda?.substance_name || 'N/A');
                            console.log(`📋 Dosage Form:`, result.openfda?.dosage_form || 'N/A');
                            console.log(`📋 Route:`, result.openfda?.route || 'N/A');
                            console.log(`📋 Strength:`, result.openfda?.pharm_class_epc || 'N/A');
                            
                            // Look for strength in the product name
                            const productNdc = result.openfda?.product_ndc || [];
                            const packageNdc = result.openfda?.package_ndc || [];
                            
                            console.log(`📋 Product NDC:`, productNdc);
                            console.log(`📋 Package NDC:`, packageNdc);
                            
                            // Check if we can extract strength from the drug name
                            const brandName = result.openfda?.brand_name?.[0] || '';
                            const genericName = result.openfda?.generic_name?.[0] || '';
                            
                            const strengthMatch = brandName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i) ||
                                                genericName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
                            
                            if (strengthMatch) {
                                console.log(`💊 Extracted Strength: ${strengthMatch[1]} ${strengthMatch[2]}`);
                            }
                            
                            // Look at dosage instructions for more info
                            const dosageInstructions = result.dosage_and_administration?.[0] || '';
                            if (dosageInstructions) {
                                // Try to extract dosage patterns
                                const dosagePatterns = dosageInstructions.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|tablet|capsule)/gi);
                                if (dosagePatterns) {
                                    console.log(`💊 Dosage Patterns Found:`, dosagePatterns.slice(0, 5));
                                }
                            }
                            
                            resolve({
                                query,
                                success: true,
                                brandName: result.openfda?.brand_name?.[0],
                                genericName: result.openfda?.generic_name?.[0],
                                substanceName: result.openfda?.substance_name,
                                dosageForm: result.openfda?.dosage_form?.[0],
                                route: result.openfda?.route?.[0],
                                extractedStrength: strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2]}` : null,
                                dosageInstructions: dosageInstructions.substring(0, 300)
                            });
                        } else {
                            resolve({ query, success: false, error: 'No results' });
                        }
                    } catch (e) {
                        resolve({ query, success: false, error: 'Parse error' });
                    }
                } else {
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

async function runDetailedDataTest() {
    console.log('🧪 Testing OpenFDA Detailed Data Extraction');
    console.log('===========================================');
    console.log('Goal: Understand what dosage/strength data we can extract');
    console.log('to eliminate redundancy between "Dosage" and "Strength" fields\n');
    
    const testMedications = ['metformin', 'ibuprofen', 'aspirin', 'tylenol'];
    
    for (const med of testMedications) {
        const result = await testOpenFDADetailedData(med);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 FIELD STRUCTURE RECOMMENDATION:');
    console.log('==================================');
    console.log('Based on the API data, here\'s the optimal field structure:');
    console.log('');
    console.log('✅ DOSAGE: How many units to take (e.g., "1", "2", "0.5")');
    console.log('✅ STRENGTH: The medication strength (e.g., "500 mg", "200 mg") - from API');
    console.log('✅ DOSAGE FORM: The form (e.g., "tablet", "capsule") - from API');
    console.log('✅ ROUTE: How to take it (e.g., "oral", "topical") - from API');
    console.log('');
    console.log('💡 EXAMPLE:');
    console.log('   Medication: Metformin Hydrochloride');
    console.log('   Dosage: 1 (how many)');
    console.log('   Strength: 500 mg (from API)');
    console.log('   Dosage Form: tablet (from API)');
    console.log('   Frequency: twice daily');
    console.log('   → Result: "Take 1 tablet (500 mg) twice daily"');
}

runDetailedDataTest().catch(console.error);