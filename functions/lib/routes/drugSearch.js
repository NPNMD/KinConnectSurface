"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDrugSearchRoutes = registerDrugSearchRoutes;
const middleware_1 = require("../middleware");
/**
 * Register drug search routes
 * Handles all drug search and information retrieval functionality using OpenFDA and RxNorm APIs
 */
function registerDrugSearchRoutes(app) {
    // ===== DRUG SEARCH ROUTES =====
    // Search for drugs by name using OpenFDA API with RxNorm fallback
    app.get('/drugs/search', middleware_1.authenticate, async (req, res) => {
        try {
            const { q: query, limit = '20' } = req.query;
            if (!query || typeof query !== 'string' || query.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter is required and must be at least 2 characters long'
                });
            }
            const searchLimit = Math.min(parseInt(limit, 10), 50); // Cap at 50 results
            const cleanQuery = query.trim().toLowerCase();
            console.log('🔍 Searching OpenFDA for:', cleanQuery);
            let allResults = [];
            // Strategy 1: OpenFDA Brand Name Search (Primary - works great for partial search)
            try {
                const fdaBrandUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 20)}`;
                console.log('🔍 Trying OpenFDA brand search:', fdaBrandUrl);
                const fdaBrandResponse = await fetch(fdaBrandUrl);
                if (fdaBrandResponse.ok) {
                    const fdaBrandData = await fdaBrandResponse.json();
                    if (fdaBrandData?.results) {
                        for (const result of fdaBrandData.results) {
                            const brandNames = result.openfda?.brand_name || [];
                            const genericNames = result.openfda?.generic_name || [];
                            const rxcuis = result.openfda?.rxcui || [];
                            const dosageForms = result.openfda?.dosage_form || [];
                            const routes = result.openfda?.route || [];
                            const strengths = result.openfda?.substance_name || [];
                            // Extract dosage instructions and indications
                            const dosageInstructions = result.dosage_and_administration?.[0] || '';
                            const indications = result.indications_and_usage?.[0] || '';
                            // Add brand names with enhanced data
                            brandNames.forEach((name, index) => {
                                allResults.push({
                                    rxcui: rxcuis[index] || `fda_brand_${Date.now()}_${index}`,
                                    name: name,
                                    synonym: genericNames[0] || name,
                                    tty: 'SBD', // Semantic Branded Drug
                                    language: 'ENG',
                                    source: 'FDA_Brand',
                                    dosageForm: dosageForms[0] || 'Unknown',
                                    route: routes[0] || 'Unknown',
                                    strength: strengths[0] || name,
                                    dosageInstructions: dosageInstructions,
                                    indications: indications
                                });
                            });
                            // Add generic names if different
                            genericNames.forEach((name, index) => {
                                if (!brandNames.includes(name)) {
                                    allResults.push({
                                        rxcui: rxcuis[index] || `fda_generic_${Date.now()}_${index}`,
                                        name: name,
                                        synonym: brandNames[0] || name,
                                        tty: 'SCD', // Semantic Clinical Drug
                                        language: 'ENG',
                                        source: 'FDA_Generic',
                                        dosageForm: dosageForms[0] || 'Unknown',
                                        route: routes[0] || 'Unknown',
                                        strength: strengths[0] || name,
                                        dosageInstructions: dosageInstructions,
                                        indications: indications
                                    });
                                }
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.warn('OpenFDA brand search failed:', error);
            }
            // Strategy 2: OpenFDA Generic Name Search
            if (allResults.length < 10) {
                try {
                    const fdaGenericUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 20)}`;
                    console.log('🔍 Trying OpenFDA generic search:', fdaGenericUrl);
                    const fdaGenericResponse = await fetch(fdaGenericUrl);
                    if (fdaGenericResponse.ok) {
                        const fdaGenericData = await fdaGenericResponse.json();
                        if (fdaGenericData?.results) {
                            for (const result of fdaGenericData.results) {
                                const genericNames = result.openfda?.generic_name || [];
                                const brandNames = result.openfda?.brand_name || [];
                                const rxcuis = result.openfda?.rxcui || [];
                                const dosageForms = result.openfda?.dosage_form || [];
                                const routes = result.openfda?.route || [];
                                const strengths = result.openfda?.substance_name || [];
                                // Extract dosage instructions and indications
                                const dosageInstructions = result.dosage_and_administration?.[0] || '';
                                const indications = result.indications_and_usage?.[0] || '';
                                genericNames.forEach((name, index) => {
                                    // Avoid duplicates
                                    if (!allResults.some(r => r.name.toLowerCase() === name.toLowerCase())) {
                                        allResults.push({
                                            rxcui: rxcuis[index] || `fda_generic2_${Date.now()}_${index}`,
                                            name: name,
                                            synonym: brandNames[0] || name,
                                            tty: 'SCD',
                                            language: 'ENG',
                                            source: 'FDA_Generic',
                                            dosageForm: dosageForms[0] || 'Unknown',
                                            route: routes[0] || 'Unknown',
                                            strength: strengths[0] || name,
                                            dosageInstructions: dosageInstructions,
                                            indications: indications
                                        });
                                    }
                                });
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn('OpenFDA generic search failed:', error);
                }
            }
            // Strategy 3: OpenFDA Substance Name Search (for comprehensive coverage)
            if (allResults.length < 5) {
                try {
                    console.log('🔍 Trying OpenFDA substance search');
                    const fdaSubstanceUrl = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 15)}`;
                    const fdaSubstanceResponse = await fetch(fdaSubstanceUrl);
                    if (fdaSubstanceResponse.ok) {
                        const fdaSubstanceData = await fdaSubstanceResponse.json();
                        if (fdaSubstanceData?.results) {
                            for (const result of fdaSubstanceData.results) {
                                const substanceNames = result.openfda?.substance_name || [];
                                const brandNames = result.openfda?.brand_name || [];
                                const genericNames = result.openfda?.generic_name || [];
                                const dosageForms = result.openfda?.dosage_form || [];
                                const routes = result.openfda?.route || [];
                                // Extract dosage instructions and indications
                                const dosageInstructions = result.dosage_and_administration?.[0] || '';
                                const indications = result.indications_and_usage?.[0] || '';
                                // Add substance-based results
                                substanceNames.forEach((substance, index) => {
                                    if (!allResults.some(r => r.name.toLowerCase() === substance.toLowerCase())) {
                                        allResults.push({
                                            rxcui: `fda_substance_${Date.now()}_${index}`,
                                            name: substance,
                                            synonym: genericNames[0] || brandNames[0] || substance,
                                            tty: 'IN', // Ingredient
                                            language: 'ENG',
                                            source: 'FDA_Substance',
                                            dosageForm: dosageForms[0] || 'Unknown',
                                            route: routes[0] || 'Unknown',
                                            strength: substance,
                                            dosageInstructions: dosageInstructions,
                                            indications: indications
                                        });
                                    }
                                });
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn('OpenFDA substance search failed:', error);
                }
            }
            // Add standard dosing recommendations for common medications
            const standardDosing = {
                'metformin': {
                    commonDoses: ['500mg', '850mg', '1000mg'],
                    standardInstructions: [
                        '500mg twice daily with meals',
                        '850mg once daily with dinner',
                        '1000mg twice daily with meals'
                    ],
                    maxDailyDose: '2550mg',
                    commonForm: 'tablet',
                    route: 'oral'
                },
                'ibuprofen': {
                    commonDoses: ['200mg', '400mg', '600mg', '800mg'],
                    standardInstructions: [
                        '200mg every 4-6 hours as needed',
                        '400mg every 6-8 hours as needed',
                        '600mg every 6-8 hours as needed',
                        '800mg every 8 hours as needed'
                    ],
                    maxDailyDose: '3200mg',
                    commonForm: 'tablet',
                    route: 'oral'
                },
                'acetaminophen': {
                    commonDoses: ['325mg', '500mg', '650mg'],
                    standardInstructions: [
                        '325mg every 4-6 hours as needed',
                        '500mg every 6 hours as needed',
                        '650mg every 6 hours as needed'
                    ],
                    maxDailyDose: '3000mg',
                    commonForm: 'tablet',
                    route: 'oral'
                },
                'aspirin': {
                    commonDoses: ['81mg', '325mg', '500mg'],
                    standardInstructions: [
                        '81mg once daily (low dose)',
                        '325mg every 4 hours as needed',
                        '500mg every 4 hours as needed'
                    ],
                    maxDailyDose: '4000mg',
                    commonForm: 'tablet',
                    route: 'oral'
                },
                'lisinopril': {
                    commonDoses: ['2.5mg', '5mg', '10mg', '20mg', '40mg'],
                    standardInstructions: [
                        '2.5mg once daily',
                        '5mg once daily',
                        '10mg once daily',
                        '20mg once daily',
                        '40mg once daily'
                    ],
                    maxDailyDose: '40mg',
                    commonForm: 'tablet',
                    route: 'oral'
                },
                'atorvastatin': {
                    commonDoses: ['10mg', '20mg', '40mg', '80mg'],
                    standardInstructions: [
                        '10mg once daily in the evening',
                        '20mg once daily in the evening',
                        '40mg once daily in the evening',
                        '80mg once daily in the evening'
                    ],
                    maxDailyDose: '80mg',
                    commonForm: 'tablet',
                    route: 'oral'
                }
            };
            // Remove duplicates and format results with enhanced dosage data
            const seenNames = new Set();
            const drugConcepts = [];
            for (const concept of allResults) {
                const normalizedName = concept.name.toLowerCase().trim();
                if (!seenNames.has(normalizedName) && drugConcepts.length < searchLimit) {
                    seenNames.add(normalizedName);
                    // Extract dosage from name if available
                    const dosageMatch = concept.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
                    const extractedDosage = dosageMatch ? `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}` : '';
                    // Find standard dosing for this medication
                    const genericName = (concept.synonym || concept.name).toLowerCase();
                    let standardDosingInfo = null;
                    // Check if this medication has standard dosing recommendations
                    for (const [medName, dosing] of Object.entries(standardDosing)) {
                        if (genericName.includes(medName) || concept.name.toLowerCase().includes(medName)) {
                            standardDosingInfo = dosing;
                            break;
                        }
                    }
                    drugConcepts.push({
                        rxcui: concept.rxcui,
                        name: concept.name,
                        synonym: concept.synonym || concept.name,
                        tty: concept.tty,
                        language: concept.language || 'ENG',
                        source: concept.source || 'Unknown',
                        // Enhanced dosage information
                        dosageForm: concept.dosageForm || 'Unknown',
                        route: concept.route || 'Unknown',
                        strength: concept.strength || concept.name,
                        extractedDosage: extractedDosage,
                        dosageInstructions: concept.dosageInstructions || '',
                        indications: concept.indications || '',
                        // Standard dosing recommendations
                        standardDosing: standardDosingInfo
                    });
                }
            }
            // Sort results: prioritize relevance and common drug types
            drugConcepts.sort((a, b) => {
                // Primary sort: prefer names that start with the query
                const aStartsWithQuery = a.name.toLowerCase().startsWith(cleanQuery);
                const bStartsWithQuery = b.name.toLowerCase().startsWith(cleanQuery);
                if (aStartsWithQuery && !bStartsWithQuery)
                    return -1;
                if (!aStartsWithQuery && bStartsWithQuery)
                    return 1;
                // Secondary sort: prioritize FDA results over RxNorm
                const aIsFDA = a.source?.startsWith('FDA');
                const bIsFDA = b.source?.startsWith('FDA');
                if (aIsFDA && !bIsFDA)
                    return -1;
                if (!aIsFDA && bIsFDA)
                    return 1;
                // Tertiary sort: prioritize common drug types
                const priorityOrder = ['SCD', 'SBD', 'IN', 'PIN', 'MIN', 'GPCK', 'BPCK'];
                const aPriority = priorityOrder.indexOf(a.tty) !== -1 ? priorityOrder.indexOf(a.tty) : 999;
                const bPriority = priorityOrder.indexOf(b.tty) !== -1 ? priorityOrder.indexOf(b.tty) : 999;
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                // Final sort by name length (shorter names first)
                return a.name.length - b.name.length;
            });
            console.log(`✅ Found ${drugConcepts.length} drug results for query: ${query} (OpenFDA + RxNorm)`);
            res.json({
                success: true,
                data: drugConcepts,
                message: `Found ${drugConcepts.length} results`
            });
        }
        catch (error) {
            console.error('Error searching drugs:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while searching drugs'
            });
        }
    });
    // Get detailed drug information by RXCUI
    app.get('/drugs/:rxcui', middleware_1.authenticate, async (req, res) => {
        try {
            const { rxcui } = req.params;
            if (!rxcui) {
                return res.status(400).json({
                    success: false,
                    error: 'RXCUI parameter is required'
                });
            }
            // Get drug properties from RxNorm
            const propertiesUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
            const propertiesResponse = await fetch(propertiesUrl);
            if (!propertiesResponse.ok) {
                return res.status(404).json({
                    success: false,
                    error: 'Drug not found'
                });
            }
            const propertiesData = await propertiesResponse.json();
            if (!propertiesData?.properties) {
                return res.status(404).json({
                    success: false,
                    error: 'Drug properties not found'
                });
            }
            const props = propertiesData.properties;
            const drugDetails = {
                rxcui: props.rxcui,
                name: props.name,
                synonym: props.synonym || props.name,
                tty: props.tty,
                language: props.language,
                suppress: props.suppress
            };
            res.json({
                success: true,
                data: drugDetails
            });
        }
        catch (error) {
            console.error('Error getting drug details:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });
    // Get drug interactions for a specific drug
    app.get('/drugs/:rxcui/interactions', middleware_1.authenticate, async (req, res) => {
        try {
            const { rxcui } = req.params;
            if (!rxcui) {
                return res.status(400).json({
                    success: false,
                    error: 'RXCUI parameter is required'
                });
            }
            // Get drug interactions from RxNorm
            const interactionsUrl = `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`;
            console.log('🔍 Getting interactions for RXCUI:', rxcui);
            const response = await fetch(interactionsUrl);
            if (!response.ok) {
                console.warn('RxNorm interactions API error:', response.status, response.statusText);
                return res.json({
                    success: true,
                    data: [],
                    message: 'No interactions found'
                });
            }
            const interactionsData = await response.json();
            if (!interactionsData?.interactionTypeGroup) {
                return res.json({
                    success: true,
                    data: [],
                    message: 'No interactions found'
                });
            }
            // Format interactions data
            const interactions = interactionsData.interactionTypeGroup.map((group) => ({
                minConceptItem: {
                    rxcui: group.minConceptItem?.rxcui,
                    name: group.minConceptItem?.name,
                    tty: group.minConceptItem?.tty
                },
                interactionTypeGroup: group.interactionType
            }));
            console.log(`✅ Found ${interactions.length} interaction groups for RXCUI: ${rxcui}`);
            res.json({
                success: true,
                data: interactions
            });
        }
        catch (error) {
            console.error('Error getting drug interactions:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });
    // Get spelling suggestions for drug names
    app.get('/drugs/suggestions/:query', middleware_1.authenticate, async (req, res) => {
        try {
            const { query } = req.params;
            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter is required and must be at least 2 characters long'
                });
            }
            // Get spelling suggestions from RxNorm
            const suggestionsUrl = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(query)}`;
            console.log('🔍 Getting spelling suggestions for:', query);
            const response = await fetch(suggestionsUrl);
            if (!response.ok) {
                console.warn('RxNorm spelling suggestions API error:', response.status, response.statusText);
                return res.json({
                    success: true,
                    data: []
                });
            }
            const suggestionsData = await response.json();
            const suggestions = suggestionsData?.suggestionGroup?.suggestionList?.suggestion || [];
            console.log(`✅ Found ${suggestions.length} spelling suggestions for: ${query}`);
            res.json({
                success: true,
                data: suggestions
            });
        }
        catch (error) {
            console.error('Error getting spelling suggestions:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });
    // Get related drugs (brand names, generics, etc.)
    app.get('/drugs/:rxcui/related', middleware_1.authenticate, async (req, res) => {
        try {
            const { rxcui } = req.params;
            if (!rxcui) {
                return res.status(400).json({
                    success: false,
                    error: 'RXCUI parameter is required'
                });
            }
            // Get related concepts from RxNorm
            const relatedUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SCD+SBD+GPCK+BPCK`;
            console.log('🔍 Getting related drugs for RXCUI:', rxcui);
            const response = await fetch(relatedUrl);
            if (!response.ok) {
                console.warn('RxNorm related drugs API error:', response.status, response.statusText);
                return res.json({
                    success: true,
                    data: []
                });
            }
            const relatedData = await response.json();
            const relatedDrugs = [];
            if (relatedData?.relatedGroup?.conceptGroup) {
                for (const group of relatedData.relatedGroup.conceptGroup) {
                    if (group.conceptProperties && Array.isArray(group.conceptProperties)) {
                        for (const concept of group.conceptProperties) {
                            relatedDrugs.push({
                                rxcui: concept.rxcui,
                                name: concept.name,
                                synonym: concept.synonym || concept.name,
                                tty: concept.tty,
                                language: concept.language
                            });
                        }
                    }
                }
            }
            console.log(`✅ Found ${relatedDrugs.length} related drugs for RXCUI: ${rxcui}`);
            res.json({
                success: true,
                data: relatedDrugs
            });
        }
        catch (error) {
            console.error('Error getting related drugs:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });
    // Get detailed medication information with dosing recommendations
    app.get('/drugs/:rxcui/dosing', middleware_1.authenticate, async (req, res) => {
        try {
            const { rxcui } = req.params;
            if (!rxcui) {
                return res.status(400).json({
                    success: false,
                    error: 'RXCUI parameter is required'
                });
            }
            console.log('🔍 Getting detailed dosing info for RXCUI:', rxcui);
            // Get basic drug properties from RxNorm
            const propertiesUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
            const propertiesResponse = await fetch(propertiesUrl);
            let drugInfo = {};
            if (propertiesResponse.ok) {
                const propertiesData = await propertiesResponse.json();
                if (propertiesData?.properties) {
                    drugInfo = propertiesData.properties;
                }
            }
            // Try to get additional info from OpenFDA if we have a drug name
            let fdaInfo = {};
            if (drugInfo.name) {
                try {
                    const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugInfo.name)}"&limit=1`;
                    const fdaResponse = await fetch(fdaUrl);
                    if (fdaResponse.ok) {
                        const fdaData = await fdaResponse.json();
                        if (fdaData?.results?.[0]) {
                            const result = fdaData.results[0];
                            fdaInfo = {
                                dosageForm: result.openfda?.dosage_form?.[0] || 'Unknown',
                                route: result.openfda?.route?.[0] || 'Unknown',
                                dosageInstructions: result.dosage_and_administration?.[0] || '',
                                indications: result.indications_and_usage?.[0] || '',
                                brandNames: result.openfda?.brand_name || [],
                                genericNames: result.openfda?.generic_name || []
                            };
                        }
                    }
                }
                catch (error) {
                    console.warn('Failed to get FDA info:', error);
                }
            }
            // Standard dosing recommendations
            const standardDosing = {
                'metformin': {
                    commonDoses: ['500mg', '850mg', '1000mg'],
                    standardInstructions: [
                        '500mg twice daily with meals',
                        '850mg once daily with dinner',
                        '1000mg twice daily with meals'
                    ],
                    maxDailyDose: '2550mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['with meals'],
                    frequency: ['once daily', 'twice daily'],
                    notes: 'Take with food to reduce stomach upset'
                },
                'ibuprofen': {
                    commonDoses: ['200mg', '400mg', '600mg', '800mg'],
                    standardInstructions: [
                        '200mg every 4-6 hours as needed',
                        '400mg every 6-8 hours as needed',
                        '600mg every 6-8 hours as needed',
                        '800mg every 8 hours as needed'
                    ],
                    maxDailyDose: '3200mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['with food'],
                    frequency: ['as needed', 'every 4-6 hours', 'every 6-8 hours'],
                    notes: 'Take with food to reduce stomach irritation'
                },
                'acetaminophen': {
                    commonDoses: ['325mg', '500mg', '650mg'],
                    standardInstructions: [
                        '325mg every 4-6 hours as needed',
                        '500mg every 6 hours as needed',
                        '650mg every 6 hours as needed'
                    ],
                    maxDailyDose: '3000mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['any time'],
                    frequency: ['as needed', 'every 4-6 hours'],
                    notes: 'Do not exceed maximum daily dose'
                },
                'aspirin': {
                    commonDoses: ['81mg', '325mg', '500mg'],
                    standardInstructions: [
                        '81mg once daily (low dose)',
                        '325mg every 4 hours as needed',
                        '500mg every 4 hours as needed'
                    ],
                    maxDailyDose: '4000mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['with food'],
                    frequency: ['once daily', 'every 4 hours'],
                    notes: 'Take with food to reduce stomach irritation'
                },
                'lisinopril': {
                    commonDoses: ['2.5mg', '5mg', '10mg', '20mg', '40mg'],
                    standardInstructions: [
                        '2.5mg once daily',
                        '5mg once daily',
                        '10mg once daily',
                        '20mg once daily',
                        '40mg once daily'
                    ],
                    maxDailyDose: '40mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['same time each day'],
                    frequency: ['once daily'],
                    notes: 'Take at the same time each day'
                },
                'atorvastatin': {
                    commonDoses: ['10mg', '20mg', '40mg', '80mg'],
                    standardInstructions: [
                        '10mg once daily in the evening',
                        '20mg once daily in the evening',
                        '40mg once daily in the evening',
                        '80mg once daily in the evening'
                    ],
                    maxDailyDose: '80mg',
                    commonForm: 'tablet',
                    route: 'oral',
                    timing: ['evening'],
                    frequency: ['once daily'],
                    notes: 'Take in the evening for best effectiveness'
                }
            };
            // Find standard dosing for this medication
            const genericName = (drugInfo.synonym || drugInfo.name || '').toLowerCase();
            let standardDosingInfo = null;
            for (const [medName, dosing] of Object.entries(standardDosing)) {
                if (genericName.includes(medName)) {
                    standardDosingInfo = dosing;
                    break;
                }
            }
            // Combine all information
            const detailedDrugInfo = {
                rxcui: drugInfo.rxcui || rxcui,
                name: drugInfo.name || 'Unknown',
                synonym: drugInfo.synonym || drugInfo.name,
                tty: drugInfo.tty || 'Unknown',
                language: drugInfo.language || 'ENG',
                // FDA information
                dosageForm: fdaInfo.dosageForm || 'Unknown',
                route: fdaInfo.route || 'Unknown',
                dosageInstructions: fdaInfo.dosageInstructions || '',
                indications: fdaInfo.indications || '',
                brandNames: fdaInfo.brandNames || [],
                genericNames: fdaInfo.genericNames || [],
                // Standard dosing recommendations
                standardDosing: standardDosingInfo
            };
            res.json({
                success: true,
                data: detailedDrugInfo
            });
        }
        catch (error) {
            console.error('Error getting detailed drug dosing info:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });
}
