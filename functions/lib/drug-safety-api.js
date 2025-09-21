"use strict";
// Drug Safety API endpoints for comprehensive medication safety monitoring
// Integrates with OpenFDA data and patient safety profiles
Object.defineProperty(exports, "__esModule", { value: true });
exports.drugSafetyApiEndpoints = void 0;
exports.drugSafetyApiEndpoints = `
// Get patient safety profile
app.get('/patients/:patientId/safety-profile', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.uid;

    // Verify access to patient
    const hasAccess = await verifyPatientAccess(userId, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to patient data'
      });
    }

    // Get patient safety profile from Firestore
    const safetyProfileRef = db.collection('patientSafetyProfiles').doc(patientId);
    const safetyProfileDoc = await safetyProfileRef.get();

    if (!safetyProfileDoc.exists) {
      // Create default safety profile if none exists
      const defaultProfile = {
        id: patientId,
        patientId: patientId,
        allergies: [],
        contraindications: [],
        medicalConditions: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await safetyProfileRef.set(defaultProfile);
      
      return res.json({
        success: true,
        data: defaultProfile
      });
    }

    const safetyProfile = {
      id: safetyProfileDoc.id,
      ...safetyProfileDoc.data()
    };

    res.json({
      success: true,
      data: safetyProfile
    });

  } catch (error) {
    console.error('Error fetching patient safety profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient safety profile'
    });
  }
});

// Update patient safety profile
app.put('/patients/:patientId/safety-profile', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.uid;
    const updates = req.body;

    // Verify access to patient
    const hasAccess = await verifyPatientAccess(userId, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to patient data'
      });
    }

    // Validate required fields
    if (!updates.allergies && !updates.contraindications && !updates.medicalConditions) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided for update'
      });
    }

    // Update safety profile
    const safetyProfileRef = db.collection('patientSafetyProfiles').doc(patientId);
    const updateData = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await safetyProfileRef.update(updateData);

    // Get updated profile
    const updatedDoc = await safetyProfileRef.get();
    const updatedProfile = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    res.json({
      success: true,
      data: updatedProfile
    });

  } catch (error) {
    console.error('Error updating patient safety profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update patient safety profile'
    });
  }
});

// Get drug interaction data from OpenFDA
app.get('/drugs/:rxcui/interactions', authenticate, async (req, res) => {
  try {
    const { rxcui } = req.params;

    if (!rxcui) {
      return res.status(400).json({
        success: false,
        error: 'RxCUI is required'
      });
    }

    console.log('🔍 Fetching drug interactions for RxCUI:', rxcui);

    // Try to get interaction data from RxNorm interaction API
    const interactionUrl = \`https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=\${rxcui}\`;
    const interactionResponse = await fetch(interactionUrl);

    if (!interactionResponse.ok) {
      throw new Error(\`RxNorm API error: \${interactionResponse.status}\`);
    }

    const interactionData = await interactionResponse.json();
    const interactions = [];

    if (interactionData?.interactionTypeGroup) {
      for (const typeGroup of interactionData.interactionTypeGroup) {
        if (typeGroup.interactionType) {
          for (const interactionType of typeGroup.interactionType) {
            if (interactionType.interactionPair) {
              for (const pair of interactionType.interactionPair) {
                interactions.push({
                  drugName: pair.interactionConcept?.[1]?.minConceptItem?.name || 'Unknown',
                  rxcui: pair.interactionConcept?.[1]?.minConceptItem?.rxcui || '',
                  severity: pair.severity || 'unknown',
                  description: pair.description || 'No description available',
                  source: 'RxNorm'
                });
              }
            }
          }
        }
      }
    }

    // Also try to get OpenFDA label data for additional safety information
    try {
      const fdaUrl = \`https://api.fda.gov/drug/label.json?search=openfda.rxcui:\${rxcui}&limit=1\`;
      const fdaResponse = await fetch(fdaUrl);
      
      if (fdaResponse.ok) {
        const fdaData = await fdaResponse.json();
        if (fdaData?.results?.[0]) {
          const labelData = fdaData.results[0];
          
          // Extract additional safety information
          const safetyInfo = {
            boxedWarnings: labelData.boxed_warning || [],
            contraindications: labelData.contraindications || [],
            warnings: labelData.warnings || [],
            precautions: labelData.precautions || [],
            adverseReactions: labelData.adverse_reactions || [],
            drugInteractions: labelData.drug_interactions || []
          };

          res.json({
            success: true,
            data: {
              interactions,
              safetyInfo,
              source: 'RxNorm + OpenFDA'
            }
          });
          return;
        }
      }
    } catch (fdaError) {
      console.warn('OpenFDA lookup failed, using RxNorm data only:', fdaError);
    }

    res.json({
      success: true,
      data: {
        interactions,
        source: 'RxNorm'
      }
    });

  } catch (error) {
    console.error('Error fetching drug interactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drug interaction data'
    });
  }
});

// Analyze medication list for safety issues
app.post('/patients/:patientId/medications/safety-analysis', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { medicationIds } = req.body;
    const userId = req.user?.uid;

    // Verify access to patient
    const hasAccess = await verifyPatientAccess(userId, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to patient data'
      });
    }

    if (!medicationIds || !Array.isArray(medicationIds)) {
      return res.status(400).json({
        success: false,
        error: 'medicationIds array is required'
      });
    }

    // Get medications
    const medicationsRef = db.collection('medications');
    const medicationPromises = medicationIds.map(id => medicationsRef.doc(id).get());
    const medicationDocs = await Promise.all(medicationPromises);
    
    const medications = medicationDocs
      .filter(doc => doc.exists)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    // Get patient safety profile
    const safetyProfileRef = db.collection('patientSafetyProfiles').doc(patientId);
    const safetyProfileDoc = await safetyProfileRef.get();
    const safetyProfile = safetyProfileDoc.exists ? safetyProfileDoc.data() : null;

    // Perform safety analysis
    const analysisResults = {
      interactions: [],
      allergyConflicts: [],
      contraindications: [],
      duplicateTherapy: [],
      timingSeparation: [],
      totalIssues: 0,
      riskLevel: 'low'
    };

    // Drug-drug interaction analysis
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        // Check for known interactions (simplified logic)
        const interaction = await checkDrugInteraction(med1, med2);
        if (interaction) {
          analysisResults.interactions.push(interaction);
        }
      }
    }

    // Allergy conflict analysis
    if (safetyProfile?.allergies) {
      for (const medication of medications) {
        for (const allergy of safetyProfile.allergies) {
          if (isAllergyConflict(medication, allergy)) {
            analysisResults.allergyConflicts.push({
              medicationId: medication.id,
              medicationName: medication.name,
              allergen: allergy.allergen,
              severity: allergy.severity,
              symptoms: allergy.symptoms
            });
          }
        }
      }
    }

    // Contraindication analysis
    if (safetyProfile?.contraindications) {
      for (const medication of medications) {
        for (const contraindication of safetyProfile.contraindications) {
          if (isContraindicated(medication, contraindication)) {
            analysisResults.contraindications.push({
              medicationId: medication.id,
              medicationName: medication.name,
              reason: contraindication.reason,
              source: contraindication.source
            });
          }
        }
      }
    }

    // Calculate total issues and risk level
    analysisResults.totalIssues = 
      analysisResults.interactions.length +
      analysisResults.allergyConflicts.length +
      analysisResults.contraindications.length +
      analysisResults.duplicateTherapy.length +
      analysisResults.timingSeparation.length;

    // Determine risk level
    if (analysisResults.allergyConflicts.length > 0 || analysisResults.contraindications.length > 0) {
      analysisResults.riskLevel = 'high';
    } else if (analysisResults.interactions.length > 2 || analysisResults.totalIssues > 3) {
      analysisResults.riskLevel = 'medium';
    } else if (analysisResults.totalIssues > 0) {
      analysisResults.riskLevel = 'low';
    }

    res.json({
      success: true,
      data: analysisResults
    });

  } catch (error) {
    console.error('Error performing safety analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform medication safety analysis'
    });
  }
});

// Helper functions
async function verifyPatientAccess(userId, patientId) {
  try {
    // Check if user is the patient
    const patientRef = db.collection('patients').doc(patientId);
    const patientDoc = await patientRef.get();
    
    if (patientDoc.exists && patientDoc.data().userId === userId) {
      return true;
    }

    // Check if user has family access
    const familyAccessQuery = db.collection('familyCalendarAccess')
      .where('patientId', '==', patientId)
      .where('familyMemberId', '==', userId)
      .where('status', '==', 'active');
    
    const familyAccessDocs = await familyAccessQuery.get();
    return !familyAccessDocs.empty;
  } catch (error) {
    console.error('Error verifying patient access:', error);
    return false;
  }
}

async function checkDrugInteraction(med1, med2) {
  // Simplified interaction checking logic
  // In a real implementation, this would use a comprehensive drug interaction database
  const knownInteractions = [
    {
      drug1: 'warfarin',
      drug2: 'aspirin',
      severity: 'major',
      description: 'Increased risk of bleeding',
      management: 'Monitor INR closely'
    },
    {
      drug1: 'levothyroxine',
      drug2: 'calcium',
      severity: 'moderate',
      description: 'Reduced thyroid hormone absorption',
      management: 'Separate by 4 hours'
    }
  ];

  for (const interaction of knownInteractions) {
    if ((med1.name.toLowerCase().includes(interaction.drug1) && med2.name.toLowerCase().includes(interaction.drug2)) ||
        (med1.name.toLowerCase().includes(interaction.drug2) && med2.name.toLowerCase().includes(interaction.drug1))) {
      return {
        medication1: med1.name,
        medication2: med2.name,
        severity: interaction.severity,
        description: interaction.description,
        management: interaction.management
      };
    }
  }

  return null;
}

function isAllergyConflict(medication, allergy) {
  const medName = medication.name.toLowerCase();
  const allergen = allergy.allergen.toLowerCase();
  
  return medName.includes(allergen) || 
         (medication.genericName && medication.genericName.toLowerCase().includes(allergen)) ||
         (medication.brandName && medication.brandName.toLowerCase().includes(allergen));
}

function isContraindicated(medication, contraindication) {
  const medName = medication.name.toLowerCase();
  const contraindicatedMed = contraindication.medication.toLowerCase();
  
  return medName.includes(contraindicatedMed) || contraindicatedMed.includes(medName);
}
`;
