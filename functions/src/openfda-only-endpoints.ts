// Complete OpenFDA-only drug search implementation
// This replaces all RxNorm dependencies with pure OpenFDA

// Search for drugs by name using OpenFDA API only
export const openFDAOnlySearchEndpoint = `
app.get('/drugs/search', authenticate, async (req, res) => {
	try {
		const { q: query, limit = '20' } = req.query;

		if (!query || typeof query !== 'string' || query.trim().length < 2) {
			return res.status(400).json({
				success: false,
				error: 'Query parameter is required and must be at least 2 characters long'
			});
		}

		const searchLimit = Math.min(parseInt(limit as string, 10), 50);
		const cleanQuery = query.trim().toLowerCase();

		console.log('🔍 Searching OpenFDA for:', cleanQuery);

		let allResults: any[] = [];

		// Strategy 1: OpenFDA Brand Name Search
		try {
			const fdaBrandUrl = \`https://api.fda.gov/drug/label.json?search=openfda.brand_name:\${encodeURIComponent(cleanQuery)}*&limit=\${Math.min(searchLimit, 20)}\`;
			const fdaBrandResponse = await fetch(fdaBrandUrl);
			
			if (fdaBrandResponse.ok) {
				const fdaBrandData: any = await fdaBrandResponse.json();
				if (fdaBrandData?.results) {
					for (const result of fdaBrandData.results) {
						const brandNames = result.openfda?.brand_name || [];
						const genericNames = result.openfda?.generic_name || [];
						const dosageForms = result.openfda?.dosage_form || [];
						const routes = result.openfda?.route || [];
						const strengths = result.openfda?.substance_name || [];
						
						const dosageInstructions = result.dosage_and_administration?.[0] || '';
						const indications = result.indications_and_usage?.[0] || '';
						
						brandNames.forEach((name: string, index: number) => {
							// Extract strength from name
							const strengthMatch = name.match(/(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|g|ml|units?|iu)/i);
							const extractedStrength = strengthMatch ? \`\${strengthMatch[1]} \${strengthMatch[2]}\` : '';
							
							allResults.push({
								id: \`fda_brand_\${Date.now()}_\${index}\`,
								name: name,
								genericName: genericNames[0] || name,
								brandName: name,
								type: 'Brand',
								source: 'FDA',
								dosageForm: dosageForms[0] || 'tablet',
								route: routes[0] || 'oral',
								strength: extractedStrength || strengths[0] || '',
								dosageInstructions: dosageInstructions,
								indications: indications
							});
						});
						
						genericNames.forEach((name: string, index: number) => {
							if (!brandNames.includes(name)) {
								const strengthMatch = name.match(/(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|g|ml|units?|iu)/i);
								const extractedStrength = strengthMatch ? \`\${strengthMatch[1]} \${strengthMatch[2]}\` : '';
								
								allResults.push({
									id: \`fda_generic_\${Date.now()}_\${index}\`,
									name: name,
									genericName: name,
									brandName: brandNames[0] || name,
									type: 'Generic',
									source: 'FDA',
									dosageForm: dosageForms[0] || 'tablet',
									route: routes[0] || 'oral',
									strength: extractedStrength || strengths[0] || '',
									dosageInstructions: dosageInstructions,
									indications: indications
								});
							}
						});
					}
				}
			}
		} catch (error) {
			console.warn('OpenFDA brand search failed:', error);
		}

		// Strategy 2: OpenFDA Generic Name Search
		if (allResults.length < 10) {
			try {
				const fdaGenericUrl = \`https://api.fda.gov/drug/label.json?search=openfda.generic_name:\${encodeURIComponent(cleanQuery)}*&limit=\${Math.min(searchLimit, 20)}\`;
				const fdaGenericResponse = await fetch(fdaGenericUrl);
				
				if (fdaGenericResponse.ok) {
					const fdaGenericData: any = await fdaGenericResponse.json();
					if (fdaGenericData?.results) {
						for (const result of fdaGenericData.results) {
							const genericNames = result.openfda?.generic_name || [];
							const brandNames = result.openfda?.brand_name || [];
							const dosageForms = result.openfda?.dosage_form || [];
							const routes = result.openfda?.route || [];
							const strengths = result.openfda?.substance_name || [];
							
							const dosageInstructions = result.dosage_and_administration?.[0] || '';
							const indications = result.indications_and_usage?.[0] || '';
							
							genericNames.forEach((name: string, index: number) => {
								if (!allResults.some(r => r.name.toLowerCase() === name.toLowerCase())) {
									const strengthMatch = name.match(/(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|g|ml|units?|iu)/i);
									const extractedStrength = strengthMatch ? \`\${strengthMatch[1]} \${strengthMatch[2]}\` : '';
									
									allResults.push({
										id: \`fda_generic2_\${Date.now()}_\${index}\`,
										name: name,
										genericName: name,
										brandName: brandNames[0] || name,
										type: 'Generic',
										source: 'FDA',
										dosageForm: dosageForms[0] || 'tablet',
										route: routes[0] || 'oral',
										strength: extractedStrength || strengths[0] || '',
										dosageInstructions: dosageInstructions,
										indications: indications
									});
								}
							});
						}
					}
				}
			} catch (error) {
				console.warn('OpenFDA generic search failed:', error);
			}
		}

		// Add standard dosing recommendations
		const standardDosing: Record<string, any> = {
			'metformin': {
				commonDoses: ['500mg', '850mg', '1000mg'],
				standardInstructions: ['500mg twice daily with meals', '850mg once daily with dinner'],
				maxDailyDose: '2550mg',
				notes: 'Take with food to reduce stomach upset'
			},
			'ibuprofen': {
				commonDoses: ['200mg', '400mg', '600mg', '800mg'],
				standardInstructions: ['200mg every 4-6 hours as needed', '400mg every 6-8 hours as needed'],
				maxDailyDose: '3200mg',
				notes: 'Take with food to reduce stomach irritation'
			},
			'acetaminophen': {
				commonDoses: ['325mg', '500mg', '650mg'],
				standardInstructions: ['325mg every 4-6 hours as needed', '500mg every 6 hours as needed'],
				maxDailyDose: '3000mg',
				notes: 'Do not exceed maximum daily dose'
			},
			'aspirin': {
				commonDoses: ['81mg', '325mg', '500mg'],
				standardInstructions: ['81mg once daily (low dose)', '325mg every 4 hours as needed'],
				maxDailyDose: '4000mg',
				notes: 'Take with food to reduce stomach irritation'
			}
		};

		// Remove duplicates and enhance with standard dosing
		const seenNames = new Set();
		const drugConcepts: any[] = [];

		for (const concept of allResults) {
			const normalizedName = concept.name.toLowerCase().trim();
			if (!seenNames.has(normalizedName) && drugConcepts.length < searchLimit) {
				seenNames.add(normalizedName);
				
				// Find standard dosing
				const genericName = concept.genericName.toLowerCase();
				let standardDosingInfo = null;
				
				for (const [medName, dosing] of Object.entries(standardDosing)) {
					if (genericName.includes(medName)) {
						standardDosingInfo = dosing;
						break;
					}
				}
				
				drugConcepts.push({
					...concept,
					standardDosing: standardDosingInfo
				});
			}
		}

		// Sort results by relevance
		drugConcepts.sort((a, b) => {
			const aStartsWithQuery = a.name.toLowerCase().startsWith(cleanQuery);
			const bStartsWithQuery = b.name.toLowerCase().startsWith(cleanQuery);
			
			if (aStartsWithQuery && !bStartsWithQuery) return -1;
			if (!aStartsWithQuery && bStartsWithQuery) return 1;
			
			return a.name.length - b.name.length;
		});

		console.log(\`✅ Found \${drugConcepts.length} drug results for query: \${query} (OpenFDA only)\`);

		res.json({
			success: true,
			data: drugConcepts,
			message: \`Found \${drugConcepts.length} results\`
		});
	} catch (error) {
		console.error('Error searching drugs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error while searching drugs'
		});
	}
});

// Get detailed drug information by name using OpenFDA only
app.get('/drugs/:drugName/details', authenticate, async (req, res) => {
	try {
		const { drugName } = req.params;

		if (!drugName) {
			return res.status(400).json({
				success: false,
				error: 'Drug name parameter is required'
			});
		}

		console.log('🔍 Getting detailed drug info for:', drugName);

		const fdaUrl = \`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"\${encodeURIComponent(drugName)}" OR openfda.brand_name:"\${encodeURIComponent(drugName)}"&limit=1\`;
		const fdaResponse = await fetch(fdaUrl);

		if (!fdaResponse.ok) {
			return res.status(404).json({
				success: false,
				error: 'Drug not found in FDA database'
			});
		}

		const fdaData: any = await fdaResponse.json();

		if (!fdaData?.results?.[0]) {
			return res.status(404).json({
				success: false,
				error: 'Drug details not found'
			});
		}

		const result = fdaData.results[0];
		const drugDetails = {
			name: result.openfda?.brand_name?.[0] || result.openfda?.generic_name?.[0] || drugName,
			brandNames: result.openfda?.brand_name || [],
			genericNames: result.openfda?.generic_name || [],
			dosageForm: result.openfda?.dosage_form?.[0] || 'tablet',
			route: result.openfda?.route?.[0] || 'oral',
			strength: result.openfda?.substance_name?.[0] || '',
			dosageInstructions: result.dosage_and_administration?.[0] || '',
			indications: result.indications_and_usage?.[0] || '',
			source: 'FDA'
		};

		res.json({
			success: true,
			data: drugDetails
		});
	} catch (error) {
		console.error('Error getting drug details:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});
`;