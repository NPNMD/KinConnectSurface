import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { PubSub } from '@google-cloud/pubsub';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

// Initialize Firebase Admin if not already initialized
try {
  initializeApp();
} catch (error) {
  // App already initialized
}

const db = getFirestore();
const storage = getStorage();
const pubsub = new PubSub();

// Bind Google AI API key via Functions secret to avoid undefined env in prod
const googleAIKey = defineSecret('GOOGLE_AI_API_KEY');
// Initialize Google Generative AI at runtime, not at module load
let genAI: GoogleGenerativeAI;

// Available Gemini models in order of preference
const GEMINI_MODELS = [
  'gemini-2.5-flash',      // Fastest, most cost-effective
  'gemini-2.0-flash-exp',  // Experimental fast model
  'gemini-2.5-pro',        // Highest quality
  'gemini-2.0-flash'       // Stable fast model
] as const;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(googleAIKey.value() || process.env.GOOGLE_AI_API_KEY || '');
  }
  return genAI;
}

// Test model availability and return the first working model
async function getAvailableModel(): Promise<string> {
  const ai = getGenAI();
  
  for (const modelName of GEMINI_MODELS) {
    try {
      logger.info('🧪 Testing model availability:', { model: modelName });
      
      const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 100 // Small test
        }
      });
      
      // Test with a simple prompt to verify the model works
      const testResult = await model.generateContent('Test prompt: respond with "OK"');
      const testResponse = await testResult.response;
      const testText = testResponse.text();
      
      if (testText) {
        logger.info('✅ Model available and working:', {
          model: modelName,
          testResponse: testText.substring(0, 50)
        });
        return modelName;
      }
    } catch (error: any) {
      logger.warn('❌ Model not available:', {
        model: modelName,
        error: error.message,
        code: error.code
      });
      continue;
    }
  }
  
  throw new Error('No available Gemini models found. Please check your API key and model access.');
}

// AI Summarization worker triggered by Pub/Sub messages
export const summarizeVisit = onMessagePublished({
  topic: 'summarize-request',
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 300, // 5 minutes for AI processing
  maxInstances: 5,
  secrets: [googleAIKey]
}, async (event) => {
  const message = event.data.message;
  const { uid, visitId, transcript, confidence } = message.json;
  
  logger.info('🤖 Starting AI summarization', {
    visitId,
    uid,
    transcriptLength: transcript?.length || 0,
    confidence
  });

  try {
    // Update status to summarizing
    await updateVisitStatus(visitId, 'summarizing', {
      summarizationStartedAt: new Date()
    });

    // Validate transcript
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Transcript too short for meaningful summarization');
    }

    // Get available model with fallback logic
    let selectedModel: string;
    try {
      selectedModel = await getAvailableModel();
      logger.info('🎯 Selected working model:', { model: selectedModel, visitId });
    } catch (modelError: any) {
      logger.error('❌ No available models found:', {
        visitId,
        error: modelError.message,
        availableModels: GEMINI_MODELS
      });
      throw new Error(`Google AI models unavailable: ${modelError.message}`);
    }

    // Get generative model with selected working model
    const model = getGenAI().getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent medical analysis
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        }
      ]
    });

    // Create medical visit analysis prompt
    const prompt = createMedicalSummaryPrompt(transcript);

    logger.info('📤 Sending request to Google AI', {
      visitId,
      model: selectedModel,
      promptLength: prompt.length,
      transcriptLength: transcript.length
    });

    // Generate AI summary with enhanced retry logic and model fallback
    let aiResponse;
    let retryCount = 0;
    const maxRetries = 3;
    let currentModel = selectedModel;

    while (retryCount < maxRetries) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        
        logger.info('✅ AI response received successfully', {
          visitId,
          model: currentModel,
          responseLength: aiResponse?.length || 0,
          attempt: retryCount + 1
        });
        break;
        
      } catch (aiError: any) {
        retryCount++;
        logger.warn(`⚠️ Google AI error (attempt ${retryCount}/${maxRetries})`, {
          visitId,
          model: currentModel,
          error: aiError.message,
          code: aiError.code,
          details: aiError.details
        });

        // If this is a model-specific error and we have more models to try
        if ((aiError.message?.includes('not found') || aiError.message?.includes('not supported')) && retryCount < maxRetries) {
          logger.warn('🔄 Model-specific error detected, trying next model', {
            visitId,
            failedModel: currentModel,
            error: aiError.message
          });
          
          // Try to get the next available model
          try {
            const currentModelIndex = GEMINI_MODELS.indexOf(currentModel as any);
            const nextModelIndex = currentModelIndex + 1;
            
            if (nextModelIndex < GEMINI_MODELS.length) {
              const nextModel = GEMINI_MODELS[nextModelIndex];
              logger.info('🔄 Switching to next model:', {
                visitId,
                from: currentModel,
                to: nextModel
              });
              
              currentModel = nextModel;
              // Recreate model with new name
              const newModel = getGenAI().getGenerativeModel({
                model: currentModel,
                generationConfig: {
                  temperature: 0.1,
                  topP: 0.8,
                  topK: 40,
                  maxOutputTokens: 2048
                },
                safetySettings: [
                  {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                  }
                ]
              });
              
              // Try with the new model
              const result = await newModel.generateContent(prompt);
              const response = await result.response;
              aiResponse = response.text();
              
              logger.info('✅ AI response received with fallback model', {
                visitId,
                model: currentModel,
                responseLength: aiResponse?.length || 0,
                attempt: retryCount + 1
              });
              break;
            }
          } catch (fallbackError: any) {
            logger.error('❌ Fallback model also failed:', {
              visitId,
              model: currentModel,
              error: fallbackError.message
            });
          }
        }

        if (retryCount >= maxRetries) {
          throw aiError;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    if (!aiResponse) {
      throw new Error('No response from Google AI');
    }

    // Parse AI response
    const summaryData = parseAISummary(aiResponse);

    logger.info('✅ AI summarization completed', {
      visitId,
      keyPointsCount: summaryData.keyPoints?.length || 0,
      actionItemsCount: summaryData.actionItems?.length || 0,
      urgencyLevel: summaryData.urgencyLevel,
      medicationChanges: {
        new: summaryData.medications?.new?.length || 0,
        stopped: summaryData.medications?.stopped?.length || 0,
        modified: summaryData.medications?.modified?.length || 0
      }
    });

    // Save summary files to Storage
    await saveSummaryFiles(uid, visitId, summaryData, aiResponse);

    // Update Firestore with results
    await updateVisitStatus(visitId, 'ready', {
      summarizationCompletedAt: new Date(),
      processing: {
        summarization: {
          completedAt: new Date(),
          service: 'google-ai',
          model: currentModel
        }
      },
      results: summaryData
    });

    // Optionally publish to TTS queue if enabled
    const shouldGenerateTTS = process.env.ENABLE_TTS === 'true';
    if (shouldGenerateTTS && summaryData.keyPoints && summaryData.keyPoints.length > 0) {
      const ttsMessage = {
        uid,
        visitId,
        summaryText: createTTSText(summaryData),
        timestamp: new Date().toISOString()
      };

      await pubsub.topic('tts-request').publishMessage({
        json: ttsMessage,
        attributes: {
          visitId,
          uid,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('📤 Published TTS request', { visitId });
    }

    logger.info('🎉 Visit processing completed successfully', {
      visitId,
      finalStatus: shouldGenerateTTS ? 'tts' : 'ready'
    });

  } catch (error) {
    logger.error('❌ AI summarization failed', {
      visitId,
      uid,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update visit status to error
    await updateVisitStatus(visitId, 'error', {
      error: {
        step: 'summarization',
        message: error instanceof Error ? error.message : 'AI summarization failed',
        retryCount: 0,
        lastRetry: new Date()
      }
    });

    // Publish to dead letter queue
    try {
      await pubsub.topic('summarize-request-dlq').publishMessage({
        json: { uid, visitId, transcript, confidence, error: error instanceof Error ? error.message : 'Unknown error' },
        attributes: {
          visitId,
          uid,
          errorType: 'summarization_failed',
          timestamp: new Date().toISOString()
        }
      });
    } catch (dlqError) {
      logger.error('❌ Failed to publish to DLQ', { visitId, dlqError });
    }
  }
});

// Create medical visit analysis prompt
function createMedicalSummaryPrompt(transcript: string): string {
  return `
You are a medical AI assistant analyzing a doctor's visit transcript. Extract key information and provide a structured summary.

TRANSCRIPT:
${transcript}

Please analyze this medical visit transcript and provide a JSON response with the following structure:

{
  "keyPoints": [
    "3-5 most important findings or observations from the visit"
  ],
  "actionItems": [
    "Specific tasks or instructions for the patient/family"
  ],
  "medications": {
    "new": [
      {"name": "medication name", "dosage": "dosage info", "instructions": "how to take"}
    ],
    "stopped": [
      {"name": "medication name", "reason": "why stopped"}
    ],
    "modified": [
      {"name": "medication name", "oldDosage": "previous", "newDosage": "new", "reason": "why changed"}
    ]
  },
  "followUp": {
    "required": true/false,
    "timeframe": "when to follow up",
    "instructions": "specific follow-up instructions"
  },
  "urgencyLevel": "low|medium|high|urgent",
  "riskFactors": [
    "Any concerning symptoms or risk factors mentioned"
  ],
  "recommendations": [
    "Doctor's recommendations for patient care"
  ]
}

Guidelines:
- Focus on medically relevant information
- Use clear, patient-friendly language
- Be accurate and conservative in assessments
- If information is unclear, note it as such
- Prioritize patient safety in urgency assessment
- Extract exact medication names and dosages when mentioned
- Include any allergies or contraindications mentioned

Respond only with valid JSON.
`;
}

// Parse AI response into structured data
function parseAISummary(aiResponse: string): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    const summary = {
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      medications: {
        new: Array.isArray(parsed.medications?.new) ? parsed.medications.new : [],
        stopped: Array.isArray(parsed.medications?.stopped) ? parsed.medications.stopped : [],
        modified: Array.isArray(parsed.medications?.modified) ? parsed.medications.modified : []
      },
      followUp: {
        required: Boolean(parsed.followUp?.required),
        timeframe: parsed.followUp?.timeframe || '',
        instructions: parsed.followUp?.instructions || ''
      },
      urgencyLevel: ['low', 'medium', 'high', 'urgent'].includes(parsed.urgencyLevel) 
        ? parsed.urgencyLevel : 'low',
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    };

    return summary;

  } catch (parseError) {
    logger.error('❌ Failed to parse AI response', {
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
      response: aiResponse.substring(0, 500)
    });

    // Return basic fallback summary
    return {
      keyPoints: ['Visit summary processed - please review transcript for details'],
      actionItems: ['Follow up with healthcare provider as recommended'],
      medications: { new: [], stopped: [], modified: [] },
      followUp: { required: false, timeframe: '', instructions: '' },
      urgencyLevel: 'low',
      riskFactors: [],
      recommendations: []
    };
  }
}

// Create text for TTS
function createTTSText(summaryData: any): string {
  let ttsText = 'Here is your visit summary. ';
  
  if (summaryData.keyPoints && summaryData.keyPoints.length > 0) {
    ttsText += 'Key points from your visit: ';
    ttsText += summaryData.keyPoints.slice(0, 3).join('. ') + '. ';
  }
  
  if (summaryData.actionItems && summaryData.actionItems.length > 0) {
    ttsText += 'Important action items: ';
    ttsText += summaryData.actionItems.slice(0, 2).join('. ') + '. ';
  }
  
  if (summaryData.followUp?.required) {
    ttsText += `Please schedule a follow-up ${summaryData.followUp.timeframe}. `;
  }
  
  return ttsText;
}

// Save summary files to Storage
async function saveSummaryFiles(
  uid: string,
  visitId: string,
  summaryData: any,
  rawResponse: string
) {
  const bucket = storage.bucket();
  
  try {
    // Save structured summary as JSON
    const summaryFile = bucket.file(`patient-visits/${uid}/${visitId}/summary.json`);
    await summaryFile.save(JSON.stringify(summaryData, null, 2), {
      metadata: {
        contentType: 'application/json',
        metadata: {
          visitId,
          uid,
          createdAt: new Date().toISOString(),
          type: 'ai_summary'
        }
      }
    });

    // Save patient-friendly markdown
    const markdownContent = createMarkdownSummary(summaryData);
    const markdownFile = bucket.file(`patient-visits/${uid}/${visitId}/summary.md`);
    await markdownFile.save(markdownContent, {
      metadata: {
        contentType: 'text/markdown',
        metadata: {
          visitId,
          uid,
          createdAt: new Date().toISOString(),
          type: 'patient_summary'
        }
      }
    });

    logger.info('💾 Summary files saved to Storage', {
      visitId,
      summaryPath: `patient-visits/${uid}/${visitId}/summary.json`,
      markdownPath: `patient-visits/${uid}/${visitId}/summary.md`
    });

  } catch (saveError) {
    logger.error('❌ Failed to save summary files', {
      visitId,
      error: saveError instanceof Error ? saveError.message : 'Unknown error'
    });
  }
}

// Create patient-friendly markdown summary
function createMarkdownSummary(summaryData: any): string {
  let markdown = '# Visit Summary\n\n';
  
  if (summaryData.keyPoints && summaryData.keyPoints.length > 0) {
    markdown += '## Key Points\n\n';
    summaryData.keyPoints.forEach((point: string) => {
      markdown += `- ${point}\n`;
    });
    markdown += '\n';
  }
  
  if (summaryData.actionItems && summaryData.actionItems.length > 0) {
    markdown += '## Action Items\n\n';
    summaryData.actionItems.forEach((item: string) => {
      markdown += `- [ ] ${item}\n`;
    });
    markdown += '\n';
  }
  
  if (summaryData.medications) {
    const { new: newMeds, stopped, modified } = summaryData.medications;
    if (newMeds.length > 0 || stopped.length > 0 || modified.length > 0) {
      markdown += '## Medication Changes\n\n';
      
      if (newMeds.length > 0) {
        markdown += '### New Medications\n';
        newMeds.forEach((med: any) => {
          markdown += `- **${med.name}** - ${med.dosage} - ${med.instructions}\n`;
        });
        markdown += '\n';
      }
      
      if (stopped.length > 0) {
        markdown += '### Stopped Medications\n';
        stopped.forEach((med: any) => {
          markdown += `- **${med.name}** - ${med.reason}\n`;
        });
        markdown += '\n';
      }
      
      if (modified.length > 0) {
        markdown += '### Modified Medications\n';
        modified.forEach((med: any) => {
          markdown += `- **${med.name}** - Changed from ${med.oldDosage} to ${med.newDosage} - ${med.reason}\n`;
        });
        markdown += '\n';
      }
    }
  }
  
  if (summaryData.followUp?.required) {
    markdown += '## Follow-up Required\n\n';
    markdown += `**When:** ${summaryData.followUp.timeframe}\n\n`;
    if (summaryData.followUp.instructions) {
      markdown += `**Instructions:** ${summaryData.followUp.instructions}\n\n`;
    }
  }
  
  if (summaryData.recommendations && summaryData.recommendations.length > 0) {
    markdown += '## Recommendations\n\n';
    summaryData.recommendations.forEach((rec: string) => {
      markdown += `- ${rec}\n`;
    });
    markdown += '\n';
  }
  
  markdown += `\n---\n*Generated on ${new Date().toLocaleDateString()}*\n`;
  
  return markdown;
}

// Helper function to update visit status
async function updateVisitStatus(
  visitId: string,
  status: string,
  additionalData?: Record<string, any>
) {
  try {
    const visitRef = db.collection('visits').doc(visitId);
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    await visitRef.update(updateData);
    
    logger.info('📝 Visit status updated', {
      visitId,
      status,
      additionalData: Object.keys(additionalData || {})
    });

  } catch (updateError) {
    logger.error('❌ Failed to update visit status', {
      visitId,
      status,
      error: updateError instanceof Error ? updateError.message : 'Unknown error'
    });
  }
}

// Export for testing
export { parseAISummary, createMedicalSummaryPrompt, createTTSText, updateVisitStatus };