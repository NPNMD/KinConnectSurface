# Visit Recording Implementation Roadmap

## Phase 1: Cleanup & Preparation (Day 1)

### Files to Remove/Replace
- [ ] `client/src/components/SimpleSpeechRecorder.tsx` - Replace with new simplified version
- [ ] Complex recording logic in `client/src/components/VisitSummaryForm.tsx` (lines 44-1049) - Simplify drastically
- [ ] Remove audio level monitoring, quality detection, and browser speech recognition code
- [ ] Clean up outdated audio transcription endpoint in `functions/src/index.ts` (lines 4615-5010)

### New Files to Create
- [ ] `client/src/components/SimpleVisitRecorder.tsx` - New simplified recording component
- [ ] `client/src/hooks/useVisitRecording.tsx` - Recording logic hook
- [ ] `client/src/lib/visitStorage.ts` - Firebase Storage utilities
- [ ] `functions/src/visitUploadTrigger.ts` - Cloud Function for upload handling
- [ ] `functions/src/workers/speechToTextWorker.ts` - STT processing worker
- [ ] `functions/src/workers/aiSummarizationWorker.ts` - AI summarization worker
- [ ] `functions/src/utils/visitProcessing.ts` - Shared processing utilities
- [ ] `firestore.rules` - Update with visit document rules
- [ ] `storage.rules` - Create Firebase Storage security rules

## Phase 2: Core Implementation (Days 2-3)

### Frontend Components
1. **Simple Recording Component** - Replace complex 1,810-line implementation
2. **Firebase Storage Integration** - Upload audio files directly
3. **Real-time Status Updates** - Listen to Firestore document changes
4. **Error Handling** - Simple, user-friendly error states

### Backend Infrastructure
1. **Cloud Function Trigger** - Process uploaded audio files
2. **Firestore Schema** - Visit document structure
3. **Pub/Sub Topics** - Message queuing for workers
4. **Basic STT Worker** - Google Speech-to-Text v2 integration

## Phase 3: Advanced Features (Days 4-5)

### AI Processing
1. **Vertex AI Integration** - Medical visit summarization
2. **Medication Detection** - Extract medication changes
3. **Action Items** - Generate patient tasks
4. **Urgency Assessment** - Classify visit urgency

### Enhanced Features
1. **TTS Worker** - Optional audio summaries
2. **Family Sharing** - Access control for visit summaries
3. **Error Recovery** - Retry mechanisms and dead letter queues
4. **Cost Optimization** - Storage lifecycle and processing efficiency

## Phase 4: Testing & Deployment (Day 6)

### Testing
1. **Unit Tests** - Component and function testing
2. **Integration Tests** - End-to-end recording flow
3. **Load Testing** - Concurrent upload handling
4. **Cost Analysis** - Monitor processing costs

### Deployment
1. **Firebase Functions Deployment**
2. **Cloud Run Workers Deployment**
3. **Firestore Rules Update**
4. **Storage Rules Configuration**
5. **Pub/Sub Topic Creation**

## Implementation Order

### Day 1: Foundation
1. ✅ Remove complex recording code
2. ✅ Create simplified recording component
3. ✅ Set up Firebase Storage structure
4. ✅ Create basic Firestore schema

### Day 2: Core Recording
1. ✅ Implement MediaRecorder-based recording
2. ✅ Add Firebase Storage upload
3. ✅ Create Cloud Function trigger
4. ✅ Basic STT integration

### Day 3: Processing Pipeline
1. ✅ Pub/Sub message handling
2. ✅ STT worker implementation
3. ✅ Basic AI summarization
4. ✅ Real-time status updates

### Day 4: Advanced AI
1. ✅ Enhanced AI prompts for medical content
2. ✅ Medication change detection
3. ✅ Action item generation
4. ✅ Urgency level assessment

### Day 5: Polish & Optimization
1. ✅ Error handling and retries
2. ✅ TTS worker (optional)
3. ✅ Family sharing controls
4. ✅ Cost optimization

### Day 6: Testing & Deployment
1. ✅ End-to-end testing
2. ✅ Performance optimization
3. ✅ Production deployment
4. ✅ Monitoring setup

## Success Criteria

### Technical
- [ ] Recording component < 200 lines (vs current 1,810)
- [ ] < 30 seconds average processing time
- [ ] > 95% recording success rate
- [ ] > 90% transcription accuracy
- [ ] < $1.00 cost per visit

### User Experience
- [ ] One-click recording start/stop
- [ ] Real-time processing status
- [ ] Clear error messages
- [ ] Automatic retry on failures
- [ ] Family-friendly summaries

## Risk Mitigation

### Technical Risks
- **Audio Format Compatibility**: Use WebM with Opus codec for broad support
- **Upload Failures**: Implement retry logic with exponential backoff
- **Processing Delays**: Set realistic user expectations (30-60 seconds)
- **Cost Overruns**: Implement usage monitoring and alerts

### User Experience Risks
- **Microphone Permission**: Clear instructions and fallback options
- **Network Issues**: Offline recording with delayed upload
- **Browser Compatibility**: Test across Chrome, Firefox, Safari, Edge
- **Mobile Support**: Responsive design and touch-friendly controls

## Monitoring & Alerts

### Key Metrics
- Upload success rate
- Processing completion time
- Transcription accuracy
- Cost per visit
- User satisfaction scores

### Alerts
- Failed uploads > 5%
- Processing time > 60 seconds
- Daily costs > $100
- Error rate > 1%

## Rollback Plan

### If Issues Arise
1. **Feature Flag**: Toggle between old and new recording systems
2. **Gradual Rollout**: Start with 10% of users, increase gradually
3. **Quick Rollback**: Revert to old system within 5 minutes if needed
4. **Data Preservation**: Ensure no visit data is lost during transition

This roadmap provides a structured approach to implementing the new visit recording architecture while minimizing risks and ensuring a smooth transition from the current complex system.