// Test script to compare different medication APIs for partial search
const https = require('https');

// Test cases that are problematic with current RxNorm implementation
const testQueries = ['metf', 'ibu', 'aspir', 'tylen'];

async function testAPI(name, url, parseResponse) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing ${name}: ${url}`);
        
        const req = https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode}`);
                
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        const results = parseResponse(parsed);
                        console.log(`✅ Found ${results.length} results`);
                        if (results.length > 0) {
                            console.log(`📋 Sample results:`, results.slice(0, 3));
                        }
                        resolve({ api: name, success: true, count: results.length, results: results.slice(0, 3) });
                    } catch (e) {
                        console.log(`❌ Parse error:`, e.message);
                        resolve({ api: name, success: false, error: 'Parse error' });
                    }
                } else {
                    console.log(`⚠️ ${res.statusCode} - Error response`);
                    resolve({ api: name, success: false, error: `HTTP ${res.statusCode}` });
                }
            });
        });
        
        req.on('error', (err) => {
            console.error(`❌ Request failed:`, err.message);
            resolve({ api: name, success: false, error: err.message });
        });
        
        req.setTimeout(10000, () => {
            console.log(`⏰ Request timed out`);
            req.destroy();
            resolve({ api: name, success: false, error: 'timeout' });
        });
    });
}

async function testAllAPIs(query) {
    console.log(`\n🧪 Testing APIs for query: "${query}"`);
    console.log('='.repeat(50));
    
    const tests = [
        // 1. OpenFDA API
        {
            name: 'OpenFDA',
            url: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${query}*&limit=5`,
            parser: (data) => {
                if (data.results) {
                    return data.results.map(item => ({
                        name: item.openfda?.brand_name?.[0] || item.openfda?.generic_name?.[0] || 'Unknown',
                        type: 'FDA Drug'
                    }));
                }
                return [];
            }
        },
        
        // 2. RxNorm findRxcuiByString (different endpoint)
        {
            name: 'RxNorm findRxcuiByString',
            url: `https://rxnav.nlm.nih.gov/REST/findRxcuiByString.json?name=${encodeURIComponent(query)}`,
            parser: (data) => {
                if (data.idGroup?.rxnormId) {
                    const ids = Array.isArray(data.idGroup.rxnormId) ? data.idGroup.rxnormId : [data.idGroup.rxnormId];
                    return ids.map(id => ({ rxcui: id, name: query, type: 'RxNorm ID' }));
                }
                return [];
            }
        },
        
        // 3. RxNorm allconcepts search
        {
            name: 'RxNorm allconcepts',
            url: `https://rxnav.nlm.nih.gov/REST/allconcepts.json?tty=SCD+SBD+IN&search=${encodeURIComponent(query)}`,
            parser: (data) => {
                if (data.minConceptGroup?.minConcept) {
                    const concepts = Array.isArray(data.minConceptGroup.minConcept) 
                        ? data.minConceptGroup.minConcept 
                        : [data.minConceptGroup.minConcept];
                    return concepts.map(concept => ({
                        rxcui: concept.rxcui,
                        name: concept.name,
                        type: concept.tty
                    }));
                }
                return [];
            }
        },
        
        // 4. Alternative OpenFDA search
        {
            name: 'OpenFDA Generic',
            url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${query}*&limit=5`,
            parser: (data) => {
                if (data.results) {
                    return data.results.map(item => ({
                        name: item.openfda?.generic_name?.[0] || item.openfda?.brand_name?.[0] || 'Unknown',
                        type: 'FDA Generic'
                    }));
                }
                return [];
            }
        }
    ];
    
    const results = [];
    for (const test of tests) {
        const result = await testAPI(test.name, test.url, test.parser);
        results.push(result);
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
}

async function runComparison() {
    console.log('🧪 Comparing Medication APIs for Partial Search');
    console.log('===============================================');
    
    const allResults = {};
    
    for (const query of testQueries) {
        const results = await testAllAPIs(query);
        allResults[query] = results;
    }
    
    console.log('\n📊 FINAL COMPARISON RESULTS:');
    console.log('============================');
    
    for (const [query, results] of Object.entries(allResults)) {
        console.log(`\n🔍 Query: "${query}"`);
        results.forEach(result => {
            const status = result.success ? `✅ ${result.count} results` : `❌ ${result.error}`;
            console.log(`  ${result.api}: ${status}`);
        });
    }
    
    // Find the best performing API
    const apiScores = {};
    for (const results of Object.values(allResults)) {
        results.forEach(result => {
            if (!apiScores[result.api]) apiScores[result.api] = { success: 0, total: 0 };
            apiScores[result.api].total++;
            if (result.success && result.count > 0) apiScores[result.api].success++;
        });
    }
    
    console.log('\n🏆 API Performance Ranking:');
    Object.entries(apiScores)
        .sort(([,a], [,b]) => (b.success/b.total) - (a.success/a.total))
        .forEach(([api, score]) => {
            const percentage = Math.round((score.success / score.total) * 100);
            console.log(`  ${api}: ${score.success}/${score.total} (${percentage}%)`);
        });
}

runComparison().catch(console.error);