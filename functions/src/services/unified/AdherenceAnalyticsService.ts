/**
 * AdherenceAnalyticsService
 *
 * Single Responsibility: ONLY handles adherence calculations and analytics
 *
 * This service is responsible for:
 * - Calculating comprehensive adherence metrics
 * - Pattern recognition and trend analysis
 * - Risk assessment and predictions
 * - Adherence reporting and insights
 * - Milestone tracking and achievements
 * - Triggering family notifications for concerning patterns
 *
 * This service does NOT:
 * - Modify medication commands or events (read-only analytics)
 * - Send notifications directly (delegates to FamilyAdherenceNotificationService)
 * - Handle transactions (read-only operations)
 * - Manage UI state (pure data service)
 */

import * as admin from 'firebase-admin';
import {
  MedicationEvent,
  MedicationCommand,
  ComprehensiveAdherenceAnalytics,
  AdherenceAnalyticsDocument,
  ENHANCED_ADHERENCE_EVENT_TYPES,
  ALL_MEDICATION_EVENT_TYPES,
  ADHERENCE_MILESTONES,
  ADHERENCE_RISK_LEVELS
} from '../../schemas/unifiedMedicationSchema';

// Import FamilyAdherenceNotificationService for pattern notifications
// Note: Lazy initialization to avoid circular dependencies
let familyNotificationService: any = null;

export interface AdherenceCalculationOptions {
  patientId: string;
  medicationId?: string;
  startDate?: Date;
  endDate?: Date;
  includePatterns?: boolean;
  includePredictions?: boolean;
  includeFamilyData?: boolean;
}

export interface AdherenceReportOptions {
  patientId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'summary' | 'detailed' | 'family_friendly';
  includeCharts?: boolean;
  medicationIds?: string[];
}

export interface AdherenceReport {
  reportId: string;
  patientId: string;
  generatedAt: Date;
  reportType: string;
  format: string;
  
  // Summary data
  summary: {
    overallAdherenceRate: number;
    totalMedications: number;
    totalDoses: number;
    onTimeRate: number;
    improvementTrend: string;
    riskLevel: string;
  };
  
  // Detailed analytics
  analytics: ComprehensiveAdherenceAnalytics[];
  
  // Visual data for charts
  chartData?: {
    adherenceTrend: Array<{ date: string; rate: number }>;
    timingAccuracy: Array<{ timeSlot: string; accuracy: number }>;
    medicationComparison: Array<{ medication: string; adherence: number }>;
  };
  
  // Family-friendly insights
  familyInsights?: {
    keyHighlights: string[];
    concernAreas: string[];
    successStories: string[];
    actionItems: string[];
  };
}

export class AdherenceAnalyticsService {
  private firestore: admin.firestore.Firestore;
  private eventsCollection: admin.firestore.CollectionReference;
  private commandsCollection: admin.firestore.CollectionReference;
  private analyticsCollection: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.eventsCollection = this.firestore.collection('medication_events');
    this.commandsCollection = this.firestore.collection('medication_commands');
    this.analyticsCollection = this.firestore.collection('adherence_analytics');
  }

  // ===== COMPREHENSIVE ADHERENCE CALCULATIONS =====

  /**
   * Calculate comprehensive adherence analytics
   */
  async calculateComprehensiveAdherence(options: AdherenceCalculationOptions): Promise<{
    success: boolean;
    data?: ComprehensiveAdherenceAnalytics;
    error?: string;
  }> {
    try {
      console.log('📊 AdherenceAnalyticsService: Calculating comprehensive adherence:', options);

      // Set default date range (last 30 days)
      const endDate = options.endDate || new Date();
      const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all relevant events
      const eventsResult = await this.getAdherenceEvents(options.patientId, startDate, endDate, options.medicationId);
      
      if (!eventsResult.success || !eventsResult.data) {
        return {
          success: false,
          error: eventsResult.error || 'Failed to fetch adherence events'
        };
      }

      const events = eventsResult.data;

      // Calculate core metrics
      const coreMetrics = this.calculateCoreMetrics(events);
      
      // Calculate patterns (if requested)
      const patterns = options.includePatterns 
        ? await this.calculateAdherencePatterns(events, options.patientId)
        : this.getDefaultPatterns();

      // Calculate risk assessment
      const riskAssessment = this.calculateRiskAssessment(coreMetrics, patterns);

      // Calculate family engagement (if requested)
      const familyEngagement = options.includeFamilyData
        ? await this.calculateFamilyEngagement(options.patientId, startDate, endDate)
        : this.getDefaultFamilyEngagement();

      // Build comprehensive analytics
      const analytics: ComprehensiveAdherenceAnalytics = {
        patientId: options.patientId,
        medicationId: options.medicationId,
        analysisWindow: {
          startDate,
          endDate,
          totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
          windowType: this.determineWindowType(startDate, endDate)
        },
        adherenceMetrics: coreMetrics,
        patterns,
        riskAssessment,
        familyEngagement,
        calculatedAt: new Date(),
        calculatedBy: 'system',
        dataVersion: 1,
        nextCalculationDue: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
      };

      console.log('✅ Comprehensive adherence calculated:', {
        patientId: options.patientId,
        medicationId: options.medicationId,
        adherenceRate: coreMetrics.overallAdherenceRate,
        riskLevel: riskAssessment.currentRiskLevel
      });

      // Trigger family notifications for concerning patterns (async, don't wait)
      this.triggerFamilyNotificationsIfNeeded(analytics).catch(error => {
        console.error('❌ Error triggering family notifications:', error);
        // Don't fail the analytics calculation if notification fails
      });

      return {
        success: true,
        data: analytics
      };

    } catch (error) {
      console.error('❌ AdherenceAnalyticsService: Error calculating adherence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate adherence analytics'
      };
    }
  }

  /**
   * Generate adherence report for patients and families
   */
  async generateAdherenceReport(options: AdherenceReportOptions): Promise<{
    success: boolean;
    data?: AdherenceReport;
    error?: string;
  }> {
    try {
      console.log('📋 AdherenceAnalyticsService: Generating adherence report:', options);

      const reportId = this.generateReportId();
      
      // Calculate date range based on report type
      const { startDate, endDate } = this.getReportDateRange(options.reportType);

      // Get analytics for all medications or specific ones
      const medicationIds = options.medicationIds || await this.getPatientMedicationIds(options.patientId);
      
      const analyticsPromises = medicationIds.map(medicationId =>
        this.calculateComprehensiveAdherence({
          patientId: options.patientId,
          medicationId,
          startDate,
          endDate,
          includePatterns: true,
          includePredictions: true,
          includeFamilyData: options.format === 'family_friendly'
        })
      );

      const analyticsResults = await Promise.all(analyticsPromises);
      const analytics = analyticsResults
        .filter(result => result.success && result.data)
        .map(result => result.data!);

      // Calculate summary metrics
      const summary = this.calculateReportSummary(analytics);

      // Generate chart data if requested
      const chartData = options.includeCharts 
        ? this.generateChartData(analytics)
        : undefined;

      // Generate family insights if requested
      const familyInsights = options.format === 'family_friendly'
        ? this.generateFamilyInsights(analytics)
        : undefined;

      const report: AdherenceReport = {
        reportId,
        patientId: options.patientId,
        generatedAt: new Date(),
        reportType: options.reportType,
        format: options.format,
        summary,
        analytics,
        chartData,
        familyInsights
      };

      console.log('✅ Adherence report generated:', {
        reportId,
        medicationsAnalyzed: analytics.length,
        overallAdherence: summary.overallAdherenceRate
      });

      return {
        success: true,
        data: report
      };

    } catch (error) {
      console.error('❌ AdherenceAnalyticsService: Error generating report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate adherence report'
      };
    }
  }

  /**
   * Check for adherence milestones and achievements
   */
  async checkAdherenceMilestones(patientId: string, medicationId?: string): Promise<{
    success: boolean;
    data?: {
      newMilestones: Array<{
        milestone: string;
        achievedAt: Date;
        description: string;
        icon: string;
      }>;
      currentStreaks: Array<{
        medicationId: string;
        medicationName: string;
        streakDays: number;
        nextMilestone?: string;
      }>;
    };
    error?: string;
  }> {
    try {
      console.log('🏆 AdherenceAnalyticsService: Checking milestones for patient:', patientId);

      // Get recent adherence data
      const analyticsResult = await this.calculateComprehensiveAdherence({
        patientId,
        medicationId,
        includePatterns: true
      });

      if (!analyticsResult.success || !analyticsResult.data) {
        return {
          success: false,
          error: 'Failed to get adherence data for milestone check'
        };
      }

      const analytics = analyticsResult.data;
      const newMilestones: any[] = [];
      const currentStreaks: any[] = [];

      // Check each milestone
      for (const [milestoneKey, milestone] of Object.entries(ADHERENCE_MILESTONES)) {
        const isAchieved = this.checkMilestoneAchievement(milestone.requirement, analytics);
        
        if (isAchieved) {
          // Check if this milestone was already recorded
          const existingMilestone = await this.getMilestoneRecord(patientId, medicationId, milestoneKey);
          
          if (!existingMilestone) {
            newMilestones.push({
              milestone: milestoneKey,
              achievedAt: new Date(),
              description: milestone.description,
              icon: milestone.icon
            });
            
            // Record the milestone
            await this.recordMilestone(patientId, medicationId, milestoneKey, analytics);
          }
        }
      }

      // Get current streaks
      if (medicationId) {
        currentStreaks.push({
          medicationId,
          medicationName: analytics.patterns.currentAdherenceStreak > 0 ? 'Current Medication' : 'Unknown',
          streakDays: analytics.patterns.currentAdherenceStreak,
          nextMilestone: this.getNextMilestone(analytics.patterns.currentAdherenceStreak)
        });
      } else {
        // Get streaks for all medications
        const medicationIds = await this.getPatientMedicationIds(patientId);
        for (const medId of medicationIds) {
          const medAnalytics = await this.calculateComprehensiveAdherence({
            patientId,
            medicationId: medId,
            includePatterns: true
          });
          
          if (medAnalytics.success && medAnalytics.data) {
            const command = await this.getMedicationCommand(medId);
            currentStreaks.push({
              medicationId: medId,
              medicationName: command?.medication.name || 'Unknown',
              streakDays: medAnalytics.data.patterns.currentAdherenceStreak,
              nextMilestone: this.getNextMilestone(medAnalytics.data.patterns.currentAdherenceStreak)
            });
          }
        }
      }

      return {
        success: true,
        data: {
          newMilestones,
          currentStreaks
        }
      };

    } catch (error) {
      console.error('❌ AdherenceAnalyticsService: Error checking milestones:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check adherence milestones'
      };
    }
  }

  // ===== PRIVATE CALCULATION METHODS =====

  /**
   * Get adherence events for analysis
   */
  private async getAdherenceEvents(patientId: string, startDate: Date, endDate: Date, medicationId?: string): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
  }> {
    try {
      let query: admin.firestore.Query = this.eventsCollection
        .where('patientId', '==', patientId)
        .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(endDate));

      if (medicationId) {
        query = query.where('commandId', '==', medicationId);
      }

      // Filter for adherence-related events
      const adherenceEventTypes = [
        ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED,
        ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_LATE,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_EARLY,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE
      ];

      query = query.where('eventType', 'in', adherenceEventTypes);
      query = query.orderBy('timing.eventTimestamp', 'desc');

      const snapshot = await query.get();
      const events = snapshot.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));

      return {
        success: true,
        data: events
      };

    } catch (error) {
      console.error('❌ Error fetching adherence events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch adherence events'
      };
    }
  }

  /**
   * Calculate core adherence metrics
   */
  private calculateCoreMetrics(events: MedicationEvent[]): ComprehensiveAdherenceAnalytics['adherenceMetrics'] {
    const metrics = {
      totalScheduledDoses: 0,
      totalTakenDoses: 0,
      fullDosesTaken: 0,
      partialDosesTaken: 0,
      adjustedDosesTaken: 0,
      missedDoses: 0,
      skippedDoses: 0,
      undoEvents: 0,
      overallAdherenceRate: 0,
      fullDoseAdherenceRate: 0,
      onTimeAdherenceRate: 0,
      averageDelayMinutes: 0,
      medianDelayMinutes: 0,
      maxDelayMinutes: 0,
      earlyDoses: 0,
      lateDoses: 0,
      veryLateDoses: 0
    };

    const delayTimes: number[] = [];
    let onTimeDoses = 0;

    events.forEach(event => {
      switch (event.eventType) {
        case ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED:
          metrics.totalScheduledDoses++;
          break;
          
        case ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN:
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL:
          metrics.totalTakenDoses++;
          metrics.fullDosesTaken++;
          this.processTimingMetrics(event, metrics, delayTimes);
          if (event.timing.isOnTime) onTimeDoses++;
          break;
          
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL:
          metrics.totalTakenDoses++;
          metrics.partialDosesTaken++;
          this.processTimingMetrics(event, metrics, delayTimes);
          if (event.timing.isOnTime) onTimeDoses++;
          break;
          
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED:
          metrics.totalTakenDoses++;
          metrics.adjustedDosesTaken++;
          this.processTimingMetrics(event, metrics, delayTimes);
          if (event.timing.isOnTime) onTimeDoses++;
          break;
          
        case ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED:
          metrics.missedDoses++;
          break;
          
        case ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
          metrics.skippedDoses++;
          break;
          
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE:
          metrics.undoEvents++;
          break;
      }
    });

    // Calculate rates
    if (metrics.totalScheduledDoses > 0) {
      metrics.overallAdherenceRate = ((metrics.totalTakenDoses) / metrics.totalScheduledDoses) * 100;
      metrics.fullDoseAdherenceRate = (metrics.fullDosesTaken / metrics.totalScheduledDoses) * 100;
    }

    if (metrics.totalTakenDoses > 0) {
      metrics.onTimeAdherenceRate = (onTimeDoses / metrics.totalTakenDoses) * 100;
    }

    // Calculate delay statistics
    if (delayTimes.length > 0) {
      metrics.averageDelayMinutes = delayTimes.reduce((sum, delay) => sum + delay, 0) / delayTimes.length;
      delayTimes.sort((a, b) => a - b);
      metrics.medianDelayMinutes = delayTimes[Math.floor(delayTimes.length / 2)];
      metrics.maxDelayMinutes = Math.max(...delayTimes);
    }

    return metrics;
  }

  /**
   * Process timing metrics for an event
   */
  private processTimingMetrics(
    event: MedicationEvent, 
    metrics: ComprehensiveAdherenceAnalytics['adherenceMetrics'], 
    delayTimes: number[]
  ): void {
    const minutesLate = event.timing.minutesLate || 0;
    
    if (minutesLate > 0) {
      delayTimes.push(minutesLate);
      
      if (minutesLate > 120) { // > 2 hours
        metrics.veryLateDoses++;
      } else {
        metrics.lateDoses++;
      }
    } else if (minutesLate < 0) {
      metrics.earlyDoses++;
    }
  }

  /**
   * Calculate adherence patterns
   */
  private async calculateAdherencePatterns(events: MedicationEvent[], patientId: string): Promise<ComprehensiveAdherenceAnalytics['patterns']> {
    // Group events by time slot and day of week
    const timeSlotMisses = { morning: 0, lunch: 0, evening: 0, beforeBed: 0 };
    const dayOfWeekMisses = Array(7).fill(0);
    const weekdayEvents: MedicationEvent[] = [];
    const weekendEvents: MedicationEvent[] = [];
    const missReasons: Record<string, number> = {};
    const effectivenessReports: Record<string, number> = {};
    const undoReasons: Record<string, number> = {};

    let consecutiveMissed = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let totalUndos = 0;
    const undoTimes: number[] = [];

    // Sort events by timestamp for streak calculation
    const sortedEvents = [...events].sort((a, b) => 
      a.timing.eventTimestamp.getTime() - b.timing.eventTimestamp.getTime()
    );

    sortedEvents.forEach(event => {
      const eventDate = event.timing.eventTimestamp;
      const dayOfWeek = eventDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend) {
        weekendEvents.push(event);
      } else {
        weekdayEvents.push(event);
      }

      // Track patterns by event type
      switch (event.eventType) {
        case ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED:
          dayOfWeekMisses[dayOfWeek]++;
          consecutiveMissed++;
          tempStreak = 0;
          
          // Determine time slot (simplified logic)
          const hour = eventDate.getHours();
          if (hour < 10) timeSlotMisses.morning++;
          else if (hour < 15) timeSlotMisses.lunch++;
          else if (hour < 21) timeSlotMisses.evening++;
          else timeSlotMisses.beforeBed++;
          break;
          
        case ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN:
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL:
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL:
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED:
          consecutiveMissed = 0;
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          break;
          
        case ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
          const skipReason = event.eventData.skipReason || 'unknown';
          missReasons[skipReason] = (missReasons[skipReason] || 0) + 1;
          break;
          
        case ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE:
          totalUndos++;
          const undoReason = event.eventData.undoData?.undoReason || 'unknown';
          undoReasons[undoReason] = (undoReasons[undoReason] || 0) + 1;
          
          // Calculate time between take and undo
          if (event.eventData.undoData?.undoTimestamp && event.timing.eventTimestamp) {
            const undoDelay = (event.eventData.undoData.undoTimestamp.getTime() - event.timing.eventTimestamp.getTime()) / 1000;
            undoTimes.push(undoDelay);
          }
          break;
      }

      // Track effectiveness reports
      const effectiveness = event.eventData.adherenceTracking?.circumstances?.effectiveness;
      if (effectiveness) {
        effectivenessReports[effectiveness] = (effectivenessReports[effectiveness] || 0) + 1;
      }
    });

    // Current streak is the temp streak if we're still on a good streak
    currentStreak = tempStreak;

    // Find most problematic time slot and day
    const timeSlotEntries = Object.entries(timeSlotMisses);
    const mostMissedEntry = timeSlotEntries.length > 0
      ? timeSlotEntries.reduce((max, [slot, count]) => count > max.count ? { slot, count } : max, { slot: timeSlotEntries[0][0], count: 0 })
      : { slot: null, count: 0 };
    const mostMissedTimeSlot = mostMissedEntry.slot as 'morning' | 'lunch' | 'evening' | 'beforeBed' | null;

    const mostMissedDayOfWeek = dayOfWeekMisses.indexOf(Math.max(...dayOfWeekMisses));

    // Calculate weekend vs weekday adherence
    const weekdayAdherence = this.calculateAdherenceForEvents(weekdayEvents);
    const weekendAdherence = this.calculateAdherenceForEvents(weekendEvents);

    // Convert reason objects to arrays
    const commonMissReasons = Object.entries(missReasons)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / Math.max(1, Object.values(missReasons).reduce((sum, c) => sum + c, 0))) * 100
      }))
      .sort((a, b) => b.count - a.count);

    const effectivenessReportsArray = Object.entries(effectivenessReports)
      .map(([effectiveness, count]) => ({
        effectiveness,
        count,
        percentage: (count / Math.max(1, Object.values(effectivenessReports).reduce((sum, c) => sum + c, 0))) * 100
      }))
      .sort((a, b) => b.count - a.count);

    const undoReasonsArray = Object.entries(undoReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      mostMissedTimeSlot,
      mostMissedDayOfWeek: mostMissedDayOfWeek >= 0 ? mostMissedDayOfWeek : null,
      weekendVsWeekdayAdherence: {
        weekday: weekdayAdherence,
        weekend: weekendAdherence,
        difference: weekdayAdherence - weekendAdherence
      },
      consecutiveMissedDoses: consecutiveMissed,
      longestAdherenceStreak: longestStreak,
      currentAdherenceStreak: currentStreak,
      improvementTrend: this.calculateImprovementTrend(events),
      commonMissReasons,
      effectivenessReports: effectivenessReportsArray,
      undoPatterns: {
        totalUndos,
        undoReasons: undoReasonsArray,
        averageUndoTime: undoTimes.length > 0 ? undoTimes.reduce((sum, time) => sum + time, 0) / undoTimes.length : 0,
        mostCommonUndoTime: this.getMostCommonUndoTime(events)
      }
    };
  }

  /**
   * Calculate risk assessment
   */
  private calculateRiskAssessment(
    metrics: ComprehensiveAdherenceAnalytics['adherenceMetrics'],
    patterns: ComprehensiveAdherenceAnalytics['patterns']
  ): ComprehensiveAdherenceAnalytics['riskAssessment'] {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];
    const interventionRecommendations: string[] = [];

    // Determine risk level based on adherence rate
    if (metrics.overallAdherenceRate >= ADHERENCE_RISK_LEVELS.LOW.threshold) {
      riskLevel = 'low';
      protectiveFactors.push('Excellent overall adherence');
    } else if (metrics.overallAdherenceRate >= ADHERENCE_RISK_LEVELS.MEDIUM.threshold) {
      riskLevel = 'medium';
      riskFactors.push('Moderate adherence rate');
    } else if (metrics.overallAdherenceRate >= ADHERENCE_RISK_LEVELS.HIGH.threshold) {
      riskLevel = 'high';
      riskFactors.push('Poor adherence rate');
    } else {
      riskLevel = 'critical';
      riskFactors.push('Very poor adherence rate');
    }

    // Additional risk factors
    if (patterns.consecutiveMissedDoses >= 3) {
      riskFactors.push(`${patterns.consecutiveMissedDoses} consecutive missed doses`);
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel === 'medium' ? 'high' : 'critical';
    }

    if (patterns.improvementTrend === 'declining') {
      riskFactors.push('Declining adherence trend');
    }

    if (metrics.onTimeAdherenceRate < 70) {
      riskFactors.push('Poor timing adherence');
    }

    // Protective factors
    if (patterns.currentAdherenceStreak >= 7) {
      protectiveFactors.push(`${patterns.currentAdherenceStreak}-day adherence streak`);
    }

    if (metrics.onTimeAdherenceRate >= 90) {
      protectiveFactors.push('Excellent timing adherence');
    }

    if (patterns.improvementTrend === 'improving') {
      protectiveFactors.push('Improving adherence trend');
    }

    // Generate intervention recommendations
    interventionRecommendations.push(...ADHERENCE_RISK_LEVELS[riskLevel.toUpperCase() as keyof typeof ADHERENCE_RISK_LEVELS].interventions);

    // Predictive analytics (simplified)
    const predictedAdherence = this.predictFutureAdherence(metrics, patterns);
    const confidenceLevel = this.calculatePredictionConfidence(metrics, patterns);

    return {
      currentRiskLevel: riskLevel,
      riskFactors,
      protectiveFactors,
      interventionRecommendations,
      predictedAdherenceNext7Days: predictedAdherence,
      confidenceLevel,
      riskTrend: patterns.improvementTrend === 'declining' ? 'worsening' : patterns.improvementTrend
    };
  }

  /**
   * Calculate family engagement metrics
   */
  private async calculateFamilyEngagement(patientId: string, startDate: Date, endDate: Date): Promise<ComprehensiveAdherenceAnalytics['familyEngagement']> {
    try {
      // Query family interaction events
      const familyEventsQuery = await this.eventsCollection
        .where('patientId', '==', patientId)
        .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .where('eventType', 'in', [
          ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_REMINDER_SENT,
          ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_ADHERENCE_ALERT,
          ENHANCED_ADHERENCE_EVENT_TYPES.CAREGIVER_ASSISTANCE
        ])
        .get();

      const familyEvents = familyEventsQuery.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));

      let familyNotificationsSent = 0;
      let familyInterventions = 0;
      let caregiverAssistance = 0;
      let familyMotivationalMessages = 0;
      const responseTimes: number[] = [];

      familyEvents.forEach(event => {
        switch (event.eventType) {
          case ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_REMINDER_SENT:
            familyNotificationsSent++;
            break;
          case ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_ADHERENCE_ALERT:
            familyInterventions++;
            break;
          case ENHANCED_ADHERENCE_EVENT_TYPES.CAREGIVER_ASSISTANCE:
            caregiverAssistance++;
            break;
        }

        // Track response times
        const responseTime = event.eventData.familyInteraction?.familyResponseTime;
        if (responseTime) {
          responseTimes.push(responseTime);
        }
      });

      const familyResponseRate = familyNotificationsSent > 0 
        ? (responseTimes.length / familyNotificationsSent) * 100 
        : 0;

      const averageFamilyResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      return {
        familyNotificationsSent,
        familyInterventions,
        caregiverAssistance,
        familyMotivationalMessages,
        familyResponseRate,
        averageFamilyResponseTime
      };

    } catch (error) {
      console.error('❌ Error calculating family engagement:', error);
      return this.getDefaultFamilyEngagement();
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Calculate adherence rate for a set of events
   */
  private calculateAdherenceForEvents(events: MedicationEvent[]): number {
    const scheduled = events.filter(e => e.eventType === ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED).length;
    const taken = events.filter(e => 
      e.eventType === ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN ||
      e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL ||
      e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL ||
      e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED
    ).length;

    return scheduled > 0 ? (taken / scheduled) * 100 : 0;
  }

  /**
   * Calculate improvement trend
   */
  private calculateImprovementTrend(events: MedicationEvent[]): 'improving' | 'stable' | 'declining' {
    // Split events into two halves and compare adherence rates
    const midpoint = Math.floor(events.length / 2);
    const firstHalf = events.slice(0, midpoint);
    const secondHalf = events.slice(midpoint);

    const firstHalfAdherence = this.calculateAdherenceForEvents(firstHalf);
    const secondHalfAdherence = this.calculateAdherenceForEvents(secondHalf);

    const difference = secondHalfAdherence - firstHalfAdherence;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  /**
   * Predict future adherence (simplified algorithm)
   */
  private predictFutureAdherence(
    metrics: ComprehensiveAdherenceAnalytics['adherenceMetrics'],
    patterns: ComprehensiveAdherenceAnalytics['patterns']
  ): number {
    let prediction = metrics.overallAdherenceRate;

    // Adjust based on trend
    if (patterns.improvementTrend === 'improving') {
      prediction = Math.min(100, prediction + 5);
    } else if (patterns.improvementTrend === 'declining') {
      prediction = Math.max(0, prediction - 5);
    }

    // Adjust based on current streak
    if (patterns.currentAdherenceStreak >= 7) {
      prediction = Math.min(100, prediction + 3);
    } else if (patterns.consecutiveMissedDoses >= 2) {
      prediction = Math.max(0, prediction - 10);
    }

    return Math.round(prediction);
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(
    metrics: ComprehensiveAdherenceAnalytics['adherenceMetrics'],
    patterns: ComprehensiveAdherenceAnalytics['patterns']
  ): number {
    let confidence = 50; // Base confidence

    // More data = higher confidence
    if (metrics.totalScheduledDoses >= 30) confidence += 20;
    else if (metrics.totalScheduledDoses >= 14) confidence += 10;

    // Stable patterns = higher confidence
    if (patterns.improvementTrend === 'stable') confidence += 15;

    // Recent activity = higher confidence
    if (patterns.currentAdherenceStreak > 0) confidence += 10;

    return Math.min(100, confidence);
  }

  /**
   * Get most common undo time
   */
  private getMostCommonUndoTime(events: MedicationEvent[]): string {
    const undoEvents = events.filter(e => e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE);
    const hourCounts: Record<number, number> = {};

    undoEvents.forEach(event => {
      const hour = event.timing.eventTimestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const mostCommonHour = Object.entries(hourCounts)
      .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, { hour: 12, count: 0 })
      .hour;

    return `${mostCommonHour.toString().padStart(2, '0')}:00`;
  }

  /**
   * Get default patterns when calculation fails
   */
  private getDefaultPatterns(): ComprehensiveAdherenceAnalytics['patterns'] {
    return {
      mostMissedTimeSlot: null,
      mostMissedDayOfWeek: null,
      weekendVsWeekdayAdherence: { weekday: 0, weekend: 0, difference: 0 },
      consecutiveMissedDoses: 0,
      longestAdherenceStreak: 0,
      currentAdherenceStreak: 0,
      improvementTrend: 'stable',
      commonMissReasons: [],
      effectivenessReports: [],
      undoPatterns: {
        totalUndos: 0,
        undoReasons: [],
        averageUndoTime: 0,
        mostCommonUndoTime: '12:00'
      }
    };
  }

  /**
   * Get default family engagement when calculation fails
   */
  private getDefaultFamilyEngagement(): ComprehensiveAdherenceAnalytics['familyEngagement'] {
    return {
      familyNotificationsSent: 0,
      familyInterventions: 0,
      caregiverAssistance: 0,
      familyMotivationalMessages: 0,
      familyResponseRate: 0,
      averageFamilyResponseTime: 0
    };
  }

  /**
   * Determine window type based on date range
   */
  private determineWindowType(startDate: Date, endDate: Date): 'daily' | 'weekly' | 'monthly' | 'custom' {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    
    if (days <= 1) return 'daily';
    if (days <= 7) return 'weekly';
    if (days <= 31) return 'monthly';
    return 'custom';
  }

  /**
   * Generate report date range based on type
   */
  private getReportDateRange(reportType: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (reportType) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  /**
   * Get patient medication IDs
   */
  private async getPatientMedicationIds(patientId: string): Promise<string[]> {
    try {
      const commandsQuery = await this.commandsCollection
        .where('patientId', '==', patientId)
        .where('status.isActive', '==', true)
        .get();

      return commandsQuery.docs.map(doc => doc.id);
    } catch (error) {
      console.error('❌ Error getting patient medication IDs:', error);
      return [];
    }
  }

  /**
   * Get medication command
   */
  private async getMedicationCommand(commandId: string): Promise<MedicationCommand | null> {
    try {
      const doc = await this.commandsCollection.doc(commandId).get();
      return doc.exists ? doc.data() as MedicationCommand : null;
    } catch (error) {
      console.error('❌ Error getting medication command:', error);
      return null;
    }
  }

  /**
   * Calculate report summary
   */
  private calculateReportSummary(analytics: ComprehensiveAdherenceAnalytics[]): AdherenceReport['summary'] {
    if (analytics.length === 0) {
      return {
        overallAdherenceRate: 0,
        totalMedications: 0,
        totalDoses: 0,
        onTimeRate: 0,
        improvementTrend: 'stable',
        riskLevel: 'low'
      };
    }

    const totalScheduled = analytics.reduce((sum, a) => sum + a.adherenceMetrics.totalScheduledDoses, 0);
    const totalTaken = analytics.reduce((sum, a) => sum + a.adherenceMetrics.totalTakenDoses, 0);
    const totalOnTime = analytics.reduce((sum, a) => sum + (a.adherenceMetrics.totalTakenDoses * a.adherenceMetrics.onTimeAdherenceRate / 100), 0);

    const overallAdherenceRate = totalScheduled > 0 ? (totalTaken / totalScheduled) * 100 : 0;
    const onTimeRate = totalTaken > 0 ? (totalOnTime / totalTaken) * 100 : 0;

    // Determine overall trend
    const improvingCount = analytics.filter(a => a.patterns.improvementTrend === 'improving').length;
    const decliningCount = analytics.filter(a => a.patterns.improvementTrend === 'declining').length;
    
    let improvementTrend: string;
    if (improvingCount > decliningCount) improvementTrend = 'improving';
    else if (decliningCount > improvingCount) improvementTrend = 'declining';
    else improvementTrend = 'stable';

    // Determine overall risk level
    const riskLevels = analytics.map(a => a.riskAssessment.currentRiskLevel);
    const hasHigh = riskLevels.includes('high');
    const hasCritical = riskLevels.includes('critical');
    const hasMedium = riskLevels.includes('medium');

    let riskLevel: string;
    if (hasCritical) riskLevel = 'critical';
    else if (hasHigh) riskLevel = 'high';
    else if (hasMedium) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      overallAdherenceRate: Math.round(overallAdherenceRate),
      totalMedications: analytics.length,
      totalDoses: totalTaken,
      onTimeRate: Math.round(onTimeRate),
      improvementTrend,
      riskLevel
    };
  }

  /**
   * Generate chart data for visualizations
   */
  private generateChartData(analytics: ComprehensiveAdherenceAnalytics[]): AdherenceReport['chartData'] {
    // This would generate data for charts - simplified implementation
    return {
      adherenceTrend: [],
      timingAccuracy: [],
      medicationComparison: analytics.map(a => ({
        medication: a.medicationId || 'Unknown',
        adherence: a.adherenceMetrics.overallAdherenceRate
      }))
    };
  }

  /**
   * Generate family-friendly insights
   */
  private generateFamilyInsights(analytics: ComprehensiveAdherenceAnalytics[]): AdherenceReport['familyInsights'] {
    const keyHighlights: string[] = [];
    const concernAreas: string[] = [];
    const successStories: string[] = [];
    const actionItems: string[] = [];

    analytics.forEach(a => {
      // Highlights
      if (a.adherenceMetrics.overallAdherenceRate >= 90) {
        keyHighlights.push(`Excellent adherence with ${a.medicationId || 'medications'} (${Math.round(a.adherenceMetrics.overallAdherenceRate)}%)`);
      }

      if (a.patterns.currentAdherenceStreak >= 7) {
        successStories.push(`${a.patterns.currentAdherenceStreak}-day adherence streak!`);
      }

      // Concerns
      if (a.riskAssessment.currentRiskLevel === 'high' || a.riskAssessment.currentRiskLevel === 'critical') {
        concernAreas.push(`${a.medicationId || 'Medication'} adherence needs attention (${Math.round(a.adherenceMetrics.overallAdherenceRate)}%)`);
      }

      if (a.patterns.consecutiveMissedDoses >= 2) {
        concernAreas.push(`${a.patterns.consecutiveMissedDoses} consecutive missed doses`);
      }

      // Action items
      a.riskAssessment.interventionRecommendations.forEach(rec => {
        if (!actionItems.includes(rec)) {
          actionItems.push(rec);
        }
      });
    });

    return {
      keyHighlights,
      concernAreas,
      successStories,
      actionItems
    };
  }

  /**
   * Check if milestone is achieved
   */
  private checkMilestoneAchievement(requirement: any, analytics: ComprehensiveAdherenceAnalytics): boolean {
    switch (requirement.type) {
      case 'dose_count':
        return analytics.adherenceMetrics.totalTakenDoses >= requirement.value;
      case 'streak_days':
        return analytics.patterns.currentAdherenceStreak >= requirement.value;
      case 'weekly_adherence':
        return analytics.adherenceMetrics.overallAdherenceRate >= requirement.value;
      case 'timing_accuracy':
        return analytics.adherenceMetrics.onTimeAdherenceRate >= requirement.value;
      default:
        return false;
    }
  }

  /**
   * Get existing milestone record
   */
  private async getMilestoneRecord(patientId: string, medicationId: string | undefined, milestoneKey: string): Promise<boolean> {
    try {
      const milestoneDoc = await this.firestore
        .collection('adherence_milestones')
        .doc(`${patientId}_${medicationId || 'all'}_${milestoneKey}`)
        .get();
      
      return milestoneDoc.exists;
    } catch (error) {
      console.error('❌ Error checking milestone record:', error);
      return false;
    }
  }

  /**
   * Record achieved milestone
   */
  private async recordMilestone(
    patientId: string, 
    medicationId: string | undefined, 
    milestoneKey: string, 
    analytics: ComprehensiveAdherenceAnalytics
  ): Promise<void> {
    try {
      const milestoneData = {
        patientId,
        medicationId,
        milestoneKey,
        achievedAt: new Date(),
        adherenceRate: analytics.adherenceMetrics.overallAdherenceRate,
        streakDays: analytics.patterns.currentAdherenceStreak,
        createdAt: new Date()
      };

      await this.firestore
        .collection('adherence_milestones')
        .doc(`${patientId}_${medicationId || 'all'}_${milestoneKey}`)
        .set(milestoneData);

      console.log('🏆 Milestone recorded:', milestoneKey);
    } catch (error) {
      console.error('❌ Error recording milestone:', error);
    }
  }

  /**
   * Get next milestone for current streak
   */
  private getNextMilestone(currentStreak: number): string | undefined {
    const milestones = Object.entries(ADHERENCE_MILESTONES)
      .filter(([_, milestone]) => milestone.requirement.type === 'streak_days')
      .sort((a, b) => a[1].requirement.value - b[1].requirement.value);

    for (const [key, milestone] of milestones) {
      if (milestone.requirement.value > currentStreak) {
        return key;
      }
    }

    return undefined;
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deserialize event from Firestore data
   */
  private deserializeEvent(id: string, data: any): MedicationEvent {
    return {
      ...data,
      id,
      eventData: {
        ...data.eventData,
        scheduledDateTime: data.eventData?.scheduledDateTime?.toDate?.() || null,
        actualDateTime: data.eventData?.actualDateTime?.toDate?.() || null,
        newScheduledTime: data.eventData?.newScheduledTime?.toDate?.() || null,
        reminderSentAt: data.eventData?.reminderSentAt?.toDate?.() || null,
        gracePeriodEnd: data.eventData?.gracePeriodEnd?.toDate?.() || null,
        undoData: data.eventData?.undoData ? {
          ...data.eventData.undoData,
          undoTimestamp: data.eventData.undoData.undoTimestamp?.toDate?.() || null
        } : undefined
      },
      timing: {
        ...data.timing,
        eventTimestamp: data.timing.eventTimestamp.toDate(),
        scheduledFor: data.timing.scheduledFor?.toDate?.() || null,
        gracePeriodEnd: data.timing.gracePeriodEnd?.toDate?.() || null
      },
      metadata: {
        ...data.metadata,
        createdAt: data.metadata.createdAt.toDate()
      }
    };
  }

  /**
   * Trigger family notifications for concerning adherence patterns
   * This is called asynchronously after adherence calculation
   */
  private async triggerFamilyNotificationsIfNeeded(analytics: ComprehensiveAdherenceAnalytics): Promise<void> {
    try {
      // Lazy load FamilyAdherenceNotificationService to avoid circular dependency
      if (!familyNotificationService) {
        const { FamilyAdherenceNotificationService } = await import('../FamilyAdherenceNotificationService');
        familyNotificationService = new FamilyAdherenceNotificationService();
      }

      // Check if any concerning patterns exist
      const shouldNotify =
        analytics.patterns.consecutiveMissedDoses >= 2 ||
        analytics.patterns.improvementTrend === 'declining' ||
        analytics.adherenceMetrics.overallAdherenceRate < 70 ||
        analytics.riskAssessment.currentRiskLevel === 'high' ||
        analytics.riskAssessment.currentRiskLevel === 'critical';

      if (!shouldNotify) {
        return;
      }

      console.log('🔔 Triggering family notifications for concerning adherence patterns');

      // Detect patterns
      const patternsResult = await familyNotificationService.detectAdherencePatterns(
        analytics.patientId,
        analytics.medicationId
      );

      if (patternsResult.success && patternsResult.data && patternsResult.data.length > 0) {
        // Send pattern alerts (async, don't wait)
        familyNotificationService.sendPatternAlerts(analytics.patientId, patternsResult.data)
          .then((result: any) => {
            if (result.success) {
              console.log(`✅ Family notifications triggered: ${result.data?.alertsSent || 0} alerts sent`);
            } else {
              console.error('❌ Failed to send family notifications:', result.error);
            }
          })
          .catch((error: any) => {
            console.error('❌ Error sending family notifications:', error);
          });
      }

    } catch (error) {
      console.error('❌ Error in triggerFamilyNotificationsIfNeeded:', error);
      // Don't throw - this is a best-effort notification
    }
  }
}