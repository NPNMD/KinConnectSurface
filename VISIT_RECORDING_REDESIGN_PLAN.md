# 🎯 Visit Recording & Summary System - Complete Redesign Plan

## 📋 Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 New Backend Services
```typescript
// services/VisitRecordingService.ts
class VisitRecordingService {
  async processVisitRecording(audioBlob: Blob, patientId: string): Promise<VisitSummary> {
    // Step 1: Upload audio to cloud storage
    const audioUrl = await this.uploadAudio(audioBlob);
    
    // Step 2: Google Speech-to-Text
    const transcription = await this.transcribeAudio(audioUrl);
    
    // Step 3: Google Natural Language API
    const entities = await this.extractMedicalEntities(transcription);
    
    // Step 4: Google AI for actionable items
    const actionItems = await this.generateActionItems(transcription, entities);
    
    // Step 5: Save structured summary
    return await this.saveVisitSummary({
      patientId,
      audioUrl,
      transcription,
      entities,
      actionItems
    });
  }
}
```

#### 1.2 Database Schema Updates
```sql
-- New simplified visit summaries table
CREATE TABLE visit_summaries_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR NOT NULL,
  audio_url VARCHAR,
  transcription TEXT,
  summary TEXT,
  entities JSONB,
  action_items JSONB,
  processing_status VARCHAR DEFAULT 'pending',
  completed_actions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Action items tracking
CREATE TABLE visit_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_summary_id UUID REFERENCES visit_summaries_v2(id),
  type VARCHAR NOT NULL, -- 'medication', 'appointment', 'lab_test'
  description TEXT NOT NULL,
  data JSONB NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 2: Frontend Components (Week 2-3)

#### 2.1 Simple Recording Component
```typescript
// components/visit-recording/SimpleRecorder.tsx
interface SimpleRecorderProps {
  patientId: string;
  onComplete: (summaryId: string) => void;
}

const SimpleRecorder: React.FC<SimpleRecorderProps> = ({ patientId, onComplete }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [progress, setProgress] = useState(0);
  
  const handleRecord = async () => {
    setState('recording');
    const audioBlob = await recordAudio();
    setState('processing');
    
    const summary = await processVisitRecording(audioBlob, patientId);
    onComplete(summary.id);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Record Visit Summary</h2>
        
        {state === 'idle' && (
          <button
            onClick={handleRecord}
            className="w-24 h-24 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center mx-auto"
          >
            <Mic className="w-8 h-8" />
          </button>
        )}
        
        {state === 'recording' && (
          <div className="space-y-4">
            <div className="w-24 h-24 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto animate-pulse">
              <MicOff className="w-8 h-8" />
            </div>
            <p>Recording... Speak clearly about the visit</p>
          </div>
        )}
        
        {state === 'processing' && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            <p>Processing with AI...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 2.2 Actionable Results Component
```typescript
// components/visit-recording/ActionableResults.tsx
interface ActionableResultsProps {
  visitSummary: VisitSummary;
  onActionComplete: (actionId: string) => void;
}

const ActionableResults: React.FC<ActionableResultsProps> = ({ 
  visitSummary, 
  onActionComplete 
}) => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Visit Summary */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Visit Summary</h3>
        <p className="text-blue-800">{visitSummary.summary}</p>
      </div>

      {/* Action Items */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recommended Actions</h3>
        
        {visitSummary.actionItems.medications?.toAdd?.map((med, index) => (
          <ActionCard
            key={`med-add-${index}`}
            icon="💊"
            title={`Add ${med.name} to medications`}
            description={`${med.dosage} - ${med.frequency}`}
            buttonText="Add to Med List"
            onAction={() => handleAddMedication(med)}
          />
        ))}
        
        {visitSummary.actionItems.appointments?.toSchedule?.map((apt, index) => (
          <ActionCard
            key={`apt-${index}`}
            icon="📅"
            title={`Schedule ${apt.type} appointment`}
            description={`Timeframe: ${apt.timeframe}`}
            buttonText="Add to Calendar"
            onAction={() => handleScheduleAppointment(apt)}
          />
        ))}
        
        {visitSummary.actionItems.tests?.toOrder?.map((test, index) => (
          <ActionCard
            key={`test-${index}`}
            icon="🧪"
            title={`Order ${test.type}`}
            description={`Priority: ${test.urgency}`}
            buttonText="Add Reminder"
            onAction={() => handleOrderTest(test)}
          />
        ))}
      </div>
    </div>
  );
};
```

#### 2.3 Reusable Action Card Component
```typescript
// components/shared/ActionCard.tsx
interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  onAction: () => Promise<void>;
  completed?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  title,
  description,
  buttonText,
  onAction,
  completed = false
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    try {
      await onAction();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        
        {!completed && (
          <button
            onClick={handleAction}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 flex items-center space-x-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{buttonText}</span>
          </button>
        )}
        
        {completed && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Completed</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Phase 3: API Integration (Week 3-4)

#### 3.1 Enhanced Google Speech-to-Text
```typescript
// services/SpeechToTextService.ts
class SpeechToTextService {
  private client = new speech.SpeechClient();
  
  async transcribeAudio(audioUrl: string): Promise<string> {
    const config = {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 48000,
      languageCode: 'en-US',
      model: 'medical_conversation',
      enableAutomaticPunctuation: true,
      speechContexts: [{
        phrases: [
          // Medical terms
          'blood pressure', 'heart rate', 'medication', 'prescription',
          'symptoms', 'diagnosis', 'treatment', 'follow up',
          'lisinopril', 'metformin', 'atorvastatin', 'ibuprofen',
          // Action words
          'start', 'stop', 'continue', 'increase', 'decrease',
          'schedule', 'order', 'check', 'monitor', 'take'
        ],
        boost: 10.0
      }]
    };

    const [response] = await this.client.recognize({
      audio: { uri: audioUrl },
      config
    });

    return response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .join(' ') || '';
  }
}
```

#### 3.2 Google Natural Language Integration
```typescript
// services/NaturalLanguageService.ts
class NaturalLanguageService {
  private client = new language.LanguageServiceClient();
  
  async extractMedicalEntities(text: string): Promise<MedicalEntity[]> {
    // Entity extraction
    const [entityResponse] = await this.client.analyzeEntities({
      document: { content: text, type: 'PLAIN_TEXT' }
    });

    // Classify medical entities
    const medicalEntities: MedicalEntity[] = [];
    
    entityResponse.entities?.forEach(entity => {
      const entityType = this.classifyMedicalEntity(entity.name, text);
      if (entityType) {
        medicalEntities.push({
          type: entityType,
          text: entity.name,
          confidence: entity.salience || 0,
          startOffset: entity.mentions?.[0]?.text?.beginOffset || 0,
          endOffset: entity.mentions?.[0]?.text?.beginOffset || 0 + entity.name.length
        });
      }
    });

    return medicalEntities;
  }

  private classifyMedicalEntity(entityName: string, context: string): MedicalEntityType | null {
    const lowerName = entityName.toLowerCase();
    const lowerContext = context.toLowerCase();
    
    // Medication detection
    if (this.isMedication(lowerName) || 
        lowerContext.includes(`${lowerName} medication`) ||
        lowerContext.includes(`take ${lowerName}`)) {
      return 'MEDICATION';
    }
    
    // Dosage detection
    if (/\d+\s*(mg|mcg|ml|units?)/.test(lowerName)) {
      return 'DOSAGE';
    }
    
    // Frequency detection
    if /(daily|twice|once|morning|evening|bedtime)/.test(lowerName)) {
      return 'FREQUENCY';
    }
    
    // Medical condition detection
    if (this.isMedicalCondition(lowerName)) {
      return 'CONDITION';
    }
    
    return null;
  }
}
```

#### 3.3 Google AI Action Item Generation
```typescript
// services/ActionItemService.ts
class ActionItemService {
  private genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  
  async generateActionItems(transcription: string, entities: MedicalEntity[]): Promise<ActionItems> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
Analyze this medical visit transcript and extract ONLY actionable items.
Focus on specific actions the patient or care team should take.

Transcript: "${transcription}"

Identified entities: ${JSON.stringify(entities)}

Return a JSON object with this exact structure:
{
  "medications": {
    "toAdd": [{"name": "", "dosage": "", "frequency": "", "instructions": ""}],
    "toStop": [{"name": "", "reason": ""}],
    "toModify": [{"name": "", "change": "", "newDosage": ""}]
  },
  "appointments": {
    "toSchedule": [{"type": "", "timeframe": "", "provider": "", "reason": ""}]
  },
  "tests": {
    "toOrder": [{"type": "", "urgency": "routine|urgent", "instructions": ""}]
  },
  "followUp": {
    "required": boolean,
    "timeframe": "",
    "instructions": ""
  }
}

Only include items that are explicitly mentioned or clearly implied in the transcript.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.createEmptyActionItems();
    }
  }
}
```

### Phase 4: Action Integration (Week 4-5)

#### 4.1 Medication Integration
```typescript
// services/MedicationActionService.ts
class MedicationActionService {
  async addMedication(medicationData: MedicationToAdd, patientId: string): Promise<void> {
    // Use existing medication API
    await apiClient.post('/medications', {
      patientId,
      name: medicationData.name,
      dosage: medicationData.dosage,
      frequency: medicationData.frequency,
      instructions: medicationData.instructions,
      prescribedDate: new Date(),
      isActive: true,
      hasReminders: true,
      reminderTimes: this.calculateReminderTimes(medicationData.frequency)
    });
  }

  async stopMedication(medicationName: string, patientId: string, reason: string): Promise<void> {
    // Find existing medication
    const medications = await apiClient.get(`/medications?patientId=${patientId}`);
    const medication = medications.data.find((med: any) => 
      med.name.toLowerCase().includes(medicationName.toLowerCase())
    );
    
    if (medication) {
      await apiClient.put(`/medications/${medication.id}`, {
        isActive: false,
        endDate: new Date(),
        notes: `Stopped: ${reason}`
      });
    }
  }

  private calculateReminderTimes(frequency: string): string[] {
    switch (frequency.toLowerCase()) {
      case 'once daily':
      case 'daily':
        return ['08:00'];
      case 'twice daily':
        return ['08:00', '20:00'];
      case 'three times daily':
        return ['08:00', '14:00', '20:00'];
      default:
        return ['08:00'];
    }
  }
}
```

#### 4.2 Calendar Integration
```typescript
// services/CalendarActionService.ts
class CalendarActionService {
  async scheduleAppointment(appointmentData: AppointmentToSchedule, patientId: string): Promise<void> {
    const appointmentDate = this.parseTimeframe(appointmentData.timeframe);
    
    // Use existing medical events API
    await apiClient.post('/medical-events', {
      patientId,
      title: `${appointmentData.type} Appointment`,
      description: appointmentData.reason,
      eventType: 'appointment',
      startDateTime: appointmentDate,
      endDateTime: new Date(appointmentDate.getTime() + 60 * 60 * 1000), // 1 hour
      providerName: appointmentData.provider,
      requiresTransportation: true,
      responsibilityStatus: 'unassigned',
      priority: 'medium',
      reminders: [
        { type: 'email', minutesBefore: 1440, isActive: true }, // 1 day
        { type: 'email', minutesBefore: 60, isActive: true }    // 1 hour
      ]
    });
  }

  async orderTest(testData: TestToOrder, patientId: string): Promise<void> {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + (testData.urgency === 'urgent' ? 1 : 7));
    
    await apiClient.post('/medical-events', {
      patientId,
      title: `${testData.type} - Lab Test`,
      description: testData.instructions,
      eventType: 'lab_test',
      startDateTime: testDate,
      priority: testData.urgency === 'urgent' ? 'high' : 'medium',
      reminders: [
        { type: 'email', minutesBefore: 1440, isActive: true }
      ]
    });
  }

  private parseTimeframe(timeframe: string): Date {
    const now = new Date();
    const lower = timeframe.toLowerCase();
    
    if (lower.includes('week')) {
      const weeks = this.extractNumber(lower) || 1;
      now.setDate(now.getDate() + (weeks * 7));
    } else if (lower.includes('month')) {
      const months = this.extractNumber(lower) || 1;
      now.setMonth(now.getMonth() + months);
    } else if (lower.includes('day')) {
      const days = this.extractNumber(lower) || 7;
      now.setDate(now.getDate() + days);
    } else {
      // Default to 2 weeks
      now.setDate(now.getDate() + 14);
    }
    
    return now;
  }
}
```

### Phase 5: Testing & Validation (Week 5-6)

#### 5.1 Component Testing
```typescript
// __tests__/SimpleRecorder.test.tsx
describe('SimpleRecorder', () => {
  it('should handle recording workflow', async () => {
    const mockOnComplete = jest.fn();
    render(<SimpleRecorder patientId="test-patient" onComplete={mockOnComplete} />);
    
    // Test recording button
    const recordButton = screen.getByRole('button');
    fireEvent.click(recordButton);
    
    // Verify recording state
    expect(screen.getByText('Recording...')).toBeInTheDocument();
    
    // Mock successful processing
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
```

#### 5.2 Integration Testing
```typescript
// __tests__/integration/VisitRecording.test.ts
describe('Visit Recording Integration', () => {
  it('should process complete workflow', async () => {
    // Mock audio blob
    const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
    
    // Process visit
    const result = await visitRecordingService.processVisitRecording(audioBlob, 'test-patient');
    
    // Verify results
    expect(result.transcription).toBeDefined();
    expect(result.actionItems).toBeDefined();
    expect(result.actionItems.medications).toBeDefined();
  });
});
```

#### 5.3 End-to-End Testing
```typescript
// e2e/visit-recording.spec.ts
test('complete visit recording workflow', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Start recording
  await page.click('[data-testid="record-visit-button"]');
  
  // Simulate recording (mock audio)
  await page.evaluate(() => {
    // Mock MediaRecorder API
    window.mockAudioRecording();
  });
  
  // Wait for processing
  await page.waitForSelector('[data-testid="action-items"]');
  
  // Verify action items appear
  const actionItems = await page.locator('[data-testid="action-item"]').count();
  expect(actionItems).toBeGreaterThan(0);
  
  // Test action execution
  await page.click('[data-testid="add-medication-button"]');
  await page.waitForSelector('[data-testid="medication-added-success"]');
});
```

## 🚀 Deployment Strategy

### 1. Feature Flag Implementation
```typescript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  NEW_VISIT_RECORDING: process.env.ENABLE_NEW_VISIT_RECORDING === 'true',
  NATURAL_LANGUAGE_API: process.env.ENABLE_NATURAL_LANGUAGE === 'true',
  ACTION_ITEMS: process.env.ENABLE_ACTION_ITEMS === 'true'
};
```

### 2. A/B Testing Setup
- 10% of users get new system initially
- Monitor success rates and user feedback
- Gradual rollout to 50%, then 100%

### 3. Rollback Plan
- Keep existing system as fallback
- Database migration strategy
- Quick rollback switches

## 📊 Success Metrics

### Technical Metrics
- **Transcription Accuracy**: >95% (vs current ~70%)
- **Processing Time**: <30 seconds (vs current 60+ seconds)
- **Error Rate**: <5% (vs current ~20%)
- **Component Size**: <300 lines per component (vs current 1,800 lines)

### User Experience Metrics
- **Time to Complete**: <2 minutes (vs current 5+ minutes)
- **User Satisfaction**: >4.5/5 stars
- **Action Completion Rate**: >80%
- **Support Tickets**: <50% reduction

### Business Metrics
- **Feature Adoption**: >70% of users
- **Data Quality**: >90% actionable summaries
- **Integration Success**: >95% successful medication/calendar additions

## 🔧 Migration Strategy

### Phase 1: Parallel Development
- Build new system alongside existing
- Use feature flags for controlled testing
- Maintain backward compatibility

### Phase 2: Gradual Migration
- Start with new users only
- Migrate existing users in batches
- Monitor performance and feedback

### Phase 3: Full Replacement
- Deprecate old system
- Clean up legacy code
- Optimize new system based on usage data

This implementation plan provides a clear, step-by-step approach to replacing your complex current system with a simplified, more reliable solution focused on actionable outcomes.