"use strict";
// Complete OpenFDA drug search implementation
// This replaces the entire /drugs/search endpoint
Object.defineProperty(exports, "__esModule", { value: true });
exports.openFDADrugSearchEndpoint = void 0;
exports.openFDADrugSearchEndpoint = `
// Search for drugs by name using OpenFDA API with RxNorm fallback
app.get('/drugs/search', authenticate, async (req, res) => {
	try {
		const { q: query, limit = '20' } = req.query;

		if (!query || typeof query !== 'string' || query.trim().length < 2) {
			return res.status(400).json({
				success: false,
				error: 'Query parameter is required and must be at least 2 characters long'
			});
		}

		const searchLimit = Math.min(parseInt(limit as string, 10), 50); // Cap at 50 results
		const cleanQuery = query.trim().toLowerCase();

		console.log('🔍 Searching OpenFDA for:', cleanQuery);

		let allResults: any[] = [];

		// Strategy 1: OpenFDA Brand Name Search (Primary - works great for partial search)
		try {
			const fdaBrandUrl = \`https://api.fda.gov/drug/label.json?search=openfda.brand_name:\${encodeURIComponent(cleanQuery)}*&limit=\${Math.min(searchLimit, 20)}\`;
			console.log('🔍 Trying OpenFDA brand search:', fdaBrandUrl);
			const fdaBrandResponse = await fetch(fdaBrandUrl);
			
			if (fdaBrandResponse.ok) {
				const fdaBrandData: any = await fdaBrandResponse.json();
				if (fdaBrandData?.results) {
					for (const result of fdaBrandData.results) {
						const brandNames = result.openfda?.brand_name || [];
						const genericNames = result.openfda?.generic_name || [];
						const rxcuis = result.openfda?.rxcui || [];
						
						// Add brand names
						brandNames.forEach((name: string, index: number) => {
							allResults.push({
								rxcui: rxcuis[index] || \`fda_brand_\${Date.now()}_\${index}\`,
								name: name,
								synonym: genericNames[0] || name,
								tty: 'SBD', // Semantic Branded Drug
								language: 'ENG',
								source: 'FDA_Brand'
							});
						});
						
						// Add generic names if different
						genericNames.forEach((name: string, index: number) => {
							if (!brandNames.includes(name)) {
								allResults.push({
									rxcui: rxcuis[index] || \`fda_generic_\${Date.now()}_\${index}\`,
									name: name,
									synonym: brandNames[0] || name,
									tty: 'SCD', // Semantic Clinical Drug
									language: 'ENG',
									source: 'FDA_Generic'
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
				console.log('🔍 Trying OpenFDA generic search:', fdaGenericUrl);
				const fdaGenericResponse = await fetch(fdaGenericUrl);
				
				if (fdaGenericResponse.ok) {
					const fdaGenericData: any = await fdaGenericResponse.json();
					if (fdaGenericData?.results) {
						for (const result of fdaGenericData.results) {
							const genericNames = result.openfda?.generic_name || [];
							const brandNames = result.openfda?.brand_name || [];
							const rxcuis = result.openfda?.rxcui || [];
							
							genericNames.forEach((name: string, index: number) => {
								// Avoid duplicates
								if (!allResults.some(r => r.name.toLowerCase() === name.toLowerCase())) {
									allResults.push({
										rxcui: rxcuis[index] || \`fda_generic2_\${Date.now()}_\${index}\`,
										name: name,
										synonym: brandNames[0] || name,
										tty: 'SCD',
										language: 'ENG',
										source: 'FDA_Generic'
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

		// Strategy 3: RxNorm Fallback (for comprehensive coverage)
		if (allResults.length < 5) {
			try {
				console.log('🔍 Falling back to RxNorm search');
				const rxnormUrl = \`https://rxnav.nlm.nih.gov/REST/drugs.json?name=\${encodeURIComponent(cleanQuery)}\`;
				const rxnormResponse = await fetch(rxnormUrl);
				
				if (rxnormResponse.ok) {
					const rxnormData: any = await rxnormResponse.json();
					if (rxnormData?.drugGroup?.conceptGroup) {
						for (const group of rxnormData.drugGroup.conceptGroup) {
							if (group.conceptProperties && Array.isArray(group.conceptProperties)) {
								for (const concept of group.conceptProperties.slice(0, 10)) {
									allResults.push({
										rxcui: concept.rxcui,
										name: concept.name,
										synonym: concept.synonym || concept.name,
										tty: concept.tty,
										language: concept.language || 'ENG',
										source: 'RxNorm'
									});
								}
							}
						}
					}
				}
			} catch (error) {
				console.warn('RxNorm fallback search failed:', error);
			}
		}

		// Remove duplicates and format results
		const seenNames = new Set();
		const drugConcepts: any[] = [];

		for (const concept of allResults) {
			const normalizedName = concept.name.toLowerCase().trim();
			if (!seenNames.has(normalizedName) && drugConcepts.length < searchLimit) {
				seenNames.add(normalizedName);
				
				drugConcepts.push({
					rxcui: concept.rxcui,
					name: concept.name,
					synonym: concept.synonym || concept.name,
					tty: concept.tty,
					language: concept.language || 'ENG',
					source: concept.source || 'Unknown'
				});
			}
		}

		// Sort results: prioritize relevance and common drug types
		drugConcepts.sort((a, b) => {
			// Primary sort: prefer names that start with the query
			const aStartsWithQuery = a.name.toLowerCase().startsWith(cleanQuery);
			const bStartsWithQuery = b.name.toLowerCase().startsWith(cleanQuery);
			
			if (aStartsWithQuery && !bStartsWithQuery) return -1;
			if (!aStartsWithQuery && bStartsWithQuery) return 1;
			
			// Secondary sort: prioritize FDA results over RxNorm
			const aIsFDA = a.source?.startsWith('FDA');
			const bIsFDA = b.source?.startsWith('FDA');
			
			if (aIsFDA && !bIsFDA) return -1;
			if (!aIsFDA && bIsFDA) return 1;
			
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

		console.log(\`✅ Found \${drugConcepts.length} drug results for query: \${query} (OpenFDA + RxNorm)\`);

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
`;
