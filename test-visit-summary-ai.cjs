const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Test the enhanced AI processing with a realistic visit summary
async function testVisitSummaryAI() {
  console.log('🧪 Testing Enhanced Visit Summary AI Processing');
  console.log('=' .repeat(60));

  // Test case 1: Visit with follow-up appointment and new medication
  const testSummary1 = `
    Patient came in for routine check-up. Blood pressure was elevated at 150/90. 
    Started on Lisinopril 10mg daily. Patient should monitor BP daily for one week 
    and schedule follow-up in 2 weeks to assess medication effectiveness. 
    Discussed lifestyle modifications including diet and exercise.
  `;

  const testTreatment1 = `
    1. Start Lisinopril 10mg daily
    2. Monitor BP daily for 1 week
    3. Follow-up in 2 weeks
    4. Lifestyle modifications - reduce sodium, increase exercise
  `;

  console.log('📋 Test Case 1: Routine visit with new medication and follow-up');
  console.log('Visit Summary:', testSummary1.trim());
  console.log('Treatment Plan:', testTreatment1.trim());
  console.log('\n🤖 AI Analysis Results:');

  // Simulate the enhanced AI processing
  const result1 = analyzeVisitSummary(testSummary1, testTreatment1);
  console.log(JSON.stringify(result1, null, 2));

  console.log('\n' + '=' .repeat(60));

  // Test case 2: Emergency visit with urgent follow-up
  const testSummary2 = `
    Patient presented to emergency department with severe chest pain. 
    EKG showed ST elevation. Immediate cardiac catheterization performed. 
    Stent placed in LAD. Patient stable post-procedure. 
    Discontinue aspirin, start clopidogrel 75mg daily. 
    Critical follow-up with cardiology in 3 days.
  `;

  const testTreatment2 = `
    1. Stop aspirin immediately
    2. Start clopidogrel 75mg daily
    3. URGENT cardiology follow-up in 3 days
    4. Cardiac rehabilitation referral
    5. Call 911 if chest pain returns
  `;

  console.log('📋 Test Case 2: Emergency visit with urgent follow-up');
  console.log('Visit Summary:', testSummary2.trim());
  console.log('Treatment Plan:', testTreatment2.trim());
  console.log('\n🤖 AI Analysis Results:');

  const result2 = analyzeVisitSummary(testSummary2, testTreatment2);
  console.log(JSON.stringify(result2, null, 2));

  console.log('\n' + '=' .repeat(60));

  // Test case 3: Routine visit with medication adjustments
  const testSummary3 = `
    Patient returns for diabetes management. A1C improved to 7.2%. 
    Increase metformin to 1000mg twice daily. 
    Schedule lab work in 3 months to recheck A1C. 
    Continue current diet and exercise plan.
  `;

  const testTreatment3 = `
    1. Increase metformin to 1000mg twice daily
    2. Schedule lab work in 3 months
    3. Continue diet and exercise
    4. Monitor blood glucose daily
  `;

  console.log('📋 Test Case 3: Diabetes follow-up with medication adjustment');
  console.log('Visit Summary:', testSummary3.trim());
  console.log('Treatment Plan:', testTreatment3.trim());
  console.log('\n🤖 AI Analysis Results:');

  const result3 = analyzeVisitSummary(testSummary3, testTreatment3);
  console.log(JSON.stringify(result3, null, 2));

  console.log('\n✅ AI Processing Test Complete!');
}

// Enhanced AI analysis function (copied from the backend)
function analyzeVisitSummary(doctorSummary, treatmentPlan) {
  const fullText = `${doctorSummary} ${treatmentPlan}`.toLowerCase();
  
  // Extract key points from the summary
  const keyPoints = extractKeyPoints(doctorSummary);
  
  // Extract actionable items with time-based detection
  const actionItems = extractActionItems(fullText);
  
  // Detect medication changes
  const medicationChanges = detectMedicationChanges(fullText);
  
  // Detect follow-up requirements
  const followUpInfo = detectFollowUpRequirements(fullText);
  
  // Assess urgency level
  const urgencyLevel = assessUrgencyLevel(fullText);
  
  // Extract recommendations and warnings
  const recommendations = extractRecommendations(fullText);
  const riskFactors = extractRiskFactors(fullText);
  const warningFlags = extractWarningFlags(fullText);
  
  return {
    keyPoints,
    actionItems,
    medicationChanges,
    followUpRequired: followUpInfo.required,
    followUpDate: followUpInfo.date,
    followUpInstructions: followUpInfo.instructions,
    urgencyLevel,
    riskFactors,
    recommendations,
    warningFlags
  };
}

function extractKeyPoints(summary) {
  const points = [];
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Take first few meaningful sentences as key points
  sentences.slice(0, 4).forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 15) {
      points.push(trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
    }
  });
  
  return points.length > 0 ? points : ["Visit completed successfully"];
}

function extractActionItems(text) {
  const actionItems = [];
  
  // Time-based patterns for follow-up appointments
  const timePatterns = [
    /(?:see|follow.?up|return|come back|schedule|appointment).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:schedule|book|make).{0,20}(?:appointment|visit).{0,20}(?:in|within|for)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:return|come back).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:follow.?up|check.?up).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi
  ];
  
  timePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[1];
      const unit = match[2];
      actionItems.push(`Schedule follow-up appointment in ${amount} ${unit}${amount !== '1' ? 's' : ''}`);
    }
  });
  
  // Medication-related actions
  const medicationPatterns = [
    /(?:start|begin|take|add).{0,30}(?:medication|medicine|drug|pill)/gi,
    /(?:stop|discontinue|cease).{0,30}(?:medication|medicine|drug|pill)/gi,
    /(?:increase|decrease|change|adjust).{0,30}(?:dose|dosage|medication)/gi,
    /(?:monitor|check|measure).{0,30}(?:blood pressure|bp|heart rate|weight|glucose|sugar)/gi
  ];
  
  medicationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 10) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Lab/test related actions
  const testPatterns = [
    /(?:order|get|schedule).{0,30}(?:lab|blood work|test|x.?ray|mri|ct scan|ultrasound)/gi,
    /(?:repeat|recheck).{0,30}(?:lab|blood work|test)/gi
  ];
  
  testPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 10) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Lifestyle/monitoring actions
  const lifestylePatterns = [
    /(?:monitor|track|record|log).{0,30}(?:daily|weekly|regularly)/gi,
    /(?:exercise|diet|lifestyle).{0,30}(?:change|modification|improvement)/gi,
    /(?:call|contact).{0,30}(?:office|doctor|provider).{0,30}(?:if|when)/gi
  ];
  
  lifestylePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 15) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Remove duplicates and return unique action items
  return [...new Set(actionItems)].slice(0, 8);
}

function detectMedicationChanges(text) {
  const changes = {
    newMedications: [],
    stoppedMedications: [],
    changedMedications: []
  };
  
  // Common medication names to look for
  const commonMeds = [
    'lisinopril', 'metformin', 'atorvastatin', 'amlodipine', 'metoprolol',
    'losartan', 'hydrochlorothiazide', 'simvastatin', 'omeprazole', 'levothyroxine',
    'gabapentin', 'sertraline', 'trazodone', 'prednisone', 'albuterol',
    'ibuprofen', 'acetaminophen', 'aspirin', 'insulin', 'warfarin', 'clopidogrel'
  ];
  
  // Detect new medications
  const newMedPatterns = [
    /(?:start|begin|prescrib|add).{0,30}(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|losartan|hydrochlorothiazide|simvastatin|omeprazole|levothyroxine|gabapentin|sertraline|trazodone|prednisone|albuterol|clopidogrel).{0,30}(\d+\s*mg)/gi,
    /(?:new|starting).{0,20}(?:medication|medicine).{0,30}([\w\s]+?)(?:\s+(\d+\s*mg))/gi
  ];
  
  newMedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1]?.trim();
      const dosage = match[2]?.trim();
      if (medName && dosage) {
        changes.newMedications.push({
          name: medName.charAt(0).toUpperCase() + medName.slice(1),
          dosage: dosage,
          instructions: "Take as directed",
          startDate: new Date().toISOString().split('T')[0]
        });
      }
    }
  });
  
  // Detect stopped medications
  const stopMedPatterns = [
    /(?:stop|discontinue|cease).{0,30}(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|losartan|hydrochlorothiazide|simvastatin|omeprazole|levothyroxine|gabapentin|sertraline|trazodone|prednisone|albuterol|aspirin|clopidogrel)/gi,
    /(?:no longer|not taking).{0,30}([\w\s]+?)(?:\s+medication)/gi
  ];
  
  stopMedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1]?.trim();
      if (medName && commonMeds.includes(medName.toLowerCase())) {
        changes.stoppedMedications.push({
          name: medName.charAt(0).toUpperCase() + medName.slice(1),
          reason: "As directed by provider",
          stopDate: new Date().toISOString().split('T')[0]
        });
      }
    }
  });
  
  // Detect medication dosage changes
  const changeMedPatterns = [
    /(?:increase|decrease|change|adjust).{0,30}(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|losartan|hydrochlorothiazide|simvastatin|omeprazole|levothyroxine|gabapentin|sertraline|trazodone|prednisone|albuterol).{0,30}(?:to|from).{0,10}(\d+\s*mg)/gi
  ];
  
  changeMedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1]?.trim();
      const newDosage = match[2]?.trim();
      if (medName && newDosage) {
        changes.changedMedications.push({
          name: medName.charAt(0).toUpperCase() + medName.slice(1),
          newDosage: newDosage,
          changeReason: "Dosage adjustment as directed"
        });
      }
    }
  });
  
  return changes;
}

function detectFollowUpRequirements(text) {
  const followUpPatterns = [
    /(?:follow.?up|return|come back|see me|appointment).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:schedule|book).{0,20}(?:appointment|visit).{0,20}(?:in|for)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:recheck|re.?evaluate).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:urgent|critical).{0,30}(?:follow.?up|appointment).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi
  ];
  
  for (const pattern of followUpPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      const followUpDate = new Date();
      if (unit === 'day') {
        followUpDate.setDate(followUpDate.getDate() + amount);
      } else if (unit === 'week') {
        followUpDate.setDate(followUpDate.getDate() + (amount * 7));
      } else if (unit === 'month') {
        followUpDate.setMonth(followUpDate.getMonth() + amount);
      }
      
      return {
        required: true,
        date: followUpDate.toISOString().split('T')[0],
        instructions: `Follow-up appointment needed in ${amount} ${unit}${amount !== 1 ? 's' : ''}`
      };
    }
  }
  
  // Check for general follow-up mentions
  if (/follow.?up|return|recheck|re.?evaluate/gi.test(text)) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14); // Default to 2 weeks
    
    return {
      required: true,
      date: defaultDate.toISOString().split('T')[0],
      instructions: "Follow-up appointment recommended"
    };
  }
  
  return {
    required: false,
    date: null,
    instructions: null
  };
}

function assessUrgencyLevel(text) {
  const urgentKeywords = ['urgent', 'emergency', 'immediate', 'asap', 'critical', 'severe', 'st elevation', 'cardiac'];
  const highKeywords = ['important', 'soon', 'promptly', 'quickly', 'elevated', 'high'];
  const mediumKeywords = ['monitor', 'watch', 'follow', 'check', 'routine'];
  
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    return 'urgent';
  }
  if (highKeywords.some(keyword => text.includes(keyword))) {
    return 'high';
  }
  if (mediumKeywords.some(keyword => text.includes(keyword))) {
    return 'medium';
  }
  
  return 'low';
}

function extractRecommendations(text) {
  const recommendations = [];
  
  // Common medical recommendations
  const recPatterns = [
    /(?:recommend|suggest|advise).{0,50}(?:exercise|diet|lifestyle|rest|activity)/gi,
    /(?:continue|maintain).{0,30}(?:current|treatment|medication|therapy)/gi,
    /(?:avoid|limit|reduce).{0,30}(?:sodium|alcohol|caffeine|stress|activity)/gi,
    /(?:increase|improve).{0,30}(?:fluid|water|fiber|activity|exercise)/gi
  ];
  
  recPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rec = match[0].trim();
      if (rec.length > 15) {
        recommendations.push(rec.charAt(0).toUpperCase() + rec.slice(1));
      }
    }
  });
  
  return [...new Set(recommendations)].slice(0, 5);
}

function extractRiskFactors(text) {
  const riskFactors = [];
  
  const riskPatterns = [
    /(?:risk|concern|worry).{0,30}(?:for|of|about).{0,30}([\w\s]{5,30})/gi,
    /(?:elevated|high|increased).{0,20}(blood pressure|cholesterol|glucose|heart rate)/gi,
    /(?:family history|genetic risk).{0,30}([\w\s]{5,30})/gi
  ];
  
  riskPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const risk = match[1]?.trim();
      if (risk && risk.length > 5) {
        riskFactors.push(risk.charAt(0).toUpperCase() + risk.slice(1));
      }
    }
  });
  
  return [...new Set(riskFactors)].slice(0, 3);
}

function extractWarningFlags(text) {
  const warningFlags = [];
  
  const warningPatterns = [
    /(?:warning|caution|alert|concern).{0,50}/gi,
    /(?:side effect|adverse|reaction).{0,30}/gi,
    /(?:emergency|urgent|immediate).{0,30}(?:care|attention|contact)/gi,
    /(?:call 911|emergency room|er|critical)/gi
  ];
  
  warningPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const warning = match[0].trim();
      if (warning.length > 10) {
        warningFlags.push(warning.charAt(0).toUpperCase() + warning.slice(1));
      }
    }
  });
  
  return [...new Set(warningFlags)].slice(0, 3);
}

// Run the test
testVisitSummaryAI().catch(console.error);