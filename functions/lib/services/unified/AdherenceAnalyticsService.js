"use strict";
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
 *
 * This service does NOT:
 * - Modify medication commands or events (read-only analytics)
 * - Send notifications (delegates to NotificationService)
 * - Handle transactions (read-only operations)
 * - Manage UI state (pure data service)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdherenceAnalyticsService = void 0;
const admin = __importStar(require("firebase-admin"));
const unifiedMedicationSchema_1 = require("../../schemas/unifiedMedicationSchema");
class AdherenceAnalyticsService {
    firestore;
    eventsCollection;
    commandsCollection;
    analyticsCollection;
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
    async calculateComprehensiveAdherence(options) {
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
            const analytics = {
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
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
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
    async generateAdherenceReport(options) {
        try {
            console.log('📋 AdherenceAnalyticsService: Generating adherence report:', options);
            const reportId = this.generateReportId();
            // Calculate date range based on report type
            const { startDate, endDate } = this.getReportDateRange(options.reportType);
            // Get analytics for all medications or specific ones
            const medicationIds = options.medicationIds || await this.getPatientMedicationIds(options.patientId);
            const analyticsPromises = medicationIds.map(medicationId => this.calculateComprehensiveAdherence({
                patientId: options.patientId,
                medicationId,
                startDate,
                endDate,
                includePatterns: true,
                includePredictions: true,
                includeFamilyData: options.format === 'family_friendly'
            }));
            const analyticsResults = await Promise.all(analyticsPromises);
            const analytics = analyticsResults
                .filter(result => result.success && result.data)
                .map(result => result.data);
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
            const report = {
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
        }
        catch (error) {
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
    async checkAdherenceMilestones(patientId, medicationId) {
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
            const newMilestones = [];
            const currentStreaks = [];
            // Check each milestone
            for (const [milestoneKey, milestone] of Object.entries(unifiedMedicationSchema_1.ADHERENCE_MILESTONES)) {
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
            }
            else {
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
        }
        catch (error) {
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
    async getAdherenceEvents(patientId, startDate, endDate, medicationId) {
        try {
            let query = this.eventsCollection
                .where('patientId', '==', patientId)
                .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
                .where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(endDate));
            if (medicationId) {
                query = query.where('commandId', '==', medicationId);
            }
            // Filter for adherence-related events
            const adherenceEventTypes = [
                unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
                unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN,
                unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED,
                unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_LATE,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_EARLY,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE
            ];
            query = query.where('eventType', 'in', adherenceEventTypes);
            query = query.orderBy('timing.eventTimestamp', 'desc');
            const snapshot = await query.get();
            const events = snapshot.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));
            return {
                success: true,
                data: events
            };
        }
        catch (error) {
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
    calculateCoreMetrics(events) {
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
        const delayTimes = [];
        let onTimeDoses = 0;
        events.forEach(event => {
            switch (event.eventType) {
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED:
                    metrics.totalScheduledDoses++;
                    break;
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN:
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL:
                    metrics.totalTakenDoses++;
                    metrics.fullDosesTaken++;
                    this.processTimingMetrics(event, metrics, delayTimes);
                    if (event.timing.isOnTime)
                        onTimeDoses++;
                    break;
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL:
                    metrics.totalTakenDoses++;
                    metrics.partialDosesTaken++;
                    this.processTimingMetrics(event, metrics, delayTimes);
                    if (event.timing.isOnTime)
                        onTimeDoses++;
                    break;
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED:
                    metrics.totalTakenDoses++;
                    metrics.adjustedDosesTaken++;
                    this.processTimingMetrics(event, metrics, delayTimes);
                    if (event.timing.isOnTime)
                        onTimeDoses++;
                    break;
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED:
                    metrics.missedDoses++;
                    break;
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
                    metrics.skippedDoses++;
                    break;
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE:
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
    processTimingMetrics(event, metrics, delayTimes) {
        const minutesLate = event.timing.minutesLate || 0;
        if (minutesLate > 0) {
            delayTimes.push(minutesLate);
            if (minutesLate > 120) { // > 2 hours
                metrics.veryLateDoses++;
            }
            else {
                metrics.lateDoses++;
            }
        }
        else if (minutesLate < 0) {
            metrics.earlyDoses++;
        }
    }
    /**
     * Calculate adherence patterns
     */
    async calculateAdherencePatterns(events, patientId) {
        // Group events by time slot and day of week
        const timeSlotMisses = { morning: 0, lunch: 0, evening: 0, beforeBed: 0 };
        const dayOfWeekMisses = Array(7).fill(0);
        const weekdayEvents = [];
        const weekendEvents = [];
        const missReasons = {};
        const effectivenessReports = {};
        const undoReasons = {};
        let consecutiveMissed = 0;
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let totalUndos = 0;
        const undoTimes = [];
        // Sort events by timestamp for streak calculation
        const sortedEvents = [...events].sort((a, b) => a.timing.eventTimestamp.getTime() - b.timing.eventTimestamp.getTime());
        sortedEvents.forEach(event => {
            const eventDate = event.timing.eventTimestamp;
            const dayOfWeek = eventDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (isWeekend) {
                weekendEvents.push(event);
            }
            else {
                weekdayEvents.push(event);
            }
            // Track patterns by event type
            switch (event.eventType) {
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED:
                    dayOfWeekMisses[dayOfWeek]++;
                    consecutiveMissed++;
                    tempStreak = 0;
                    // Determine time slot (simplified logic)
                    const hour = eventDate.getHours();
                    if (hour < 10)
                        timeSlotMisses.morning++;
                    else if (hour < 15)
                        timeSlotMisses.lunch++;
                    else if (hour < 21)
                        timeSlotMisses.evening++;
                    else
                        timeSlotMisses.beforeBed++;
                    break;
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN:
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL:
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL:
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED:
                    consecutiveMissed = 0;
                    tempStreak++;
                    if (tempStreak > longestStreak)
                        longestStreak = tempStreak;
                    break;
                case unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
                    const skipReason = event.eventData.skipReason || 'unknown';
                    missReasons[skipReason] = (missReasons[skipReason] || 0) + 1;
                    break;
                case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE:
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
        const mostMissedTimeSlot = mostMissedEntry.slot;
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
    calculateRiskAssessment(metrics, patterns) {
        let riskLevel = 'low';
        const riskFactors = [];
        const protectiveFactors = [];
        const interventionRecommendations = [];
        // Determine risk level based on adherence rate
        if (metrics.overallAdherenceRate >= unifiedMedicationSchema_1.ADHERENCE_RISK_LEVELS.LOW.threshold) {
            riskLevel = 'low';
            protectiveFactors.push('Excellent overall adherence');
        }
        else if (metrics.overallAdherenceRate >= unifiedMedicationSchema_1.ADHERENCE_RISK_LEVELS.MEDIUM.threshold) {
            riskLevel = 'medium';
            riskFactors.push('Moderate adherence rate');
        }
        else if (metrics.overallAdherenceRate >= unifiedMedicationSchema_1.ADHERENCE_RISK_LEVELS.HIGH.threshold) {
            riskLevel = 'high';
            riskFactors.push('Poor adherence rate');
        }
        else {
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
        interventionRecommendations.push(...unifiedMedicationSchema_1.ADHERENCE_RISK_LEVELS[riskLevel.toUpperCase()].interventions);
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
    async calculateFamilyEngagement(patientId, startDate, endDate) {
        try {
            // Query family interaction events
            const familyEventsQuery = await this.eventsCollection
                .where('patientId', '==', patientId)
                .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
                .where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
                .where('eventType', 'in', [
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_REMINDER_SENT,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_ADHERENCE_ALERT,
                unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.CAREGIVER_ASSISTANCE
            ])
                .get();
            const familyEvents = familyEventsQuery.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));
            let familyNotificationsSent = 0;
            let familyInterventions = 0;
            let caregiverAssistance = 0;
            let familyMotivationalMessages = 0;
            const responseTimes = [];
            familyEvents.forEach(event => {
                switch (event.eventType) {
                    case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_REMINDER_SENT:
                        familyNotificationsSent++;
                        break;
                    case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.FAMILY_ADHERENCE_ALERT:
                        familyInterventions++;
                        break;
                    case unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.CAREGIVER_ASSISTANCE:
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
        }
        catch (error) {
            console.error('❌ Error calculating family engagement:', error);
            return this.getDefaultFamilyEngagement();
        }
    }
    // ===== HELPER METHODS =====
    /**
     * Calculate adherence rate for a set of events
     */
    calculateAdherenceForEvents(events) {
        const scheduled = events.filter(e => e.eventType === unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED).length;
        const taken = events.filter(e => e.eventType === unifiedMedicationSchema_1.ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN ||
            e.eventType === unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL ||
            e.eventType === unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL ||
            e.eventType === unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED).length;
        return scheduled > 0 ? (taken / scheduled) * 100 : 0;
    }
    /**
     * Calculate improvement trend
     */
    calculateImprovementTrend(events) {
        // Split events into two halves and compare adherence rates
        const midpoint = Math.floor(events.length / 2);
        const firstHalf = events.slice(0, midpoint);
        const secondHalf = events.slice(midpoint);
        const firstHalfAdherence = this.calculateAdherenceForEvents(firstHalf);
        const secondHalfAdherence = this.calculateAdherenceForEvents(secondHalf);
        const difference = secondHalfAdherence - firstHalfAdherence;
        if (difference > 5)
            return 'improving';
        if (difference < -5)
            return 'declining';
        return 'stable';
    }
    /**
     * Predict future adherence (simplified algorithm)
     */
    predictFutureAdherence(metrics, patterns) {
        let prediction = metrics.overallAdherenceRate;
        // Adjust based on trend
        if (patterns.improvementTrend === 'improving') {
            prediction = Math.min(100, prediction + 5);
        }
        else if (patterns.improvementTrend === 'declining') {
            prediction = Math.max(0, prediction - 5);
        }
        // Adjust based on current streak
        if (patterns.currentAdherenceStreak >= 7) {
            prediction = Math.min(100, prediction + 3);
        }
        else if (patterns.consecutiveMissedDoses >= 2) {
            prediction = Math.max(0, prediction - 10);
        }
        return Math.round(prediction);
    }
    /**
     * Calculate prediction confidence
     */
    calculatePredictionConfidence(metrics, patterns) {
        let confidence = 50; // Base confidence
        // More data = higher confidence
        if (metrics.totalScheduledDoses >= 30)
            confidence += 20;
        else if (metrics.totalScheduledDoses >= 14)
            confidence += 10;
        // Stable patterns = higher confidence
        if (patterns.improvementTrend === 'stable')
            confidence += 15;
        // Recent activity = higher confidence
        if (patterns.currentAdherenceStreak > 0)
            confidence += 10;
        return Math.min(100, confidence);
    }
    /**
     * Get most common undo time
     */
    getMostCommonUndoTime(events) {
        const undoEvents = events.filter(e => e.eventType === unifiedMedicationSchema_1.ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE);
        const hourCounts = {};
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
    getDefaultPatterns() {
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
    getDefaultFamilyEngagement() {
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
    determineWindowType(startDate, endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        if (days <= 1)
            return 'daily';
        if (days <= 7)
            return 'weekly';
        if (days <= 31)
            return 'monthly';
        return 'custom';
    }
    /**
     * Generate report date range based on type
     */
    getReportDateRange(reportType) {
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
    async getPatientMedicationIds(patientId) {
        try {
            const commandsQuery = await this.commandsCollection
                .where('patientId', '==', patientId)
                .where('status.isActive', '==', true)
                .get();
            return commandsQuery.docs.map(doc => doc.id);
        }
        catch (error) {
            console.error('❌ Error getting patient medication IDs:', error);
            return [];
        }
    }
    /**
     * Get medication command
     */
    async getMedicationCommand(commandId) {
        try {
            const doc = await this.commandsCollection.doc(commandId).get();
            return doc.exists ? doc.data() : null;
        }
        catch (error) {
            console.error('❌ Error getting medication command:', error);
            return null;
        }
    }
    /**
     * Calculate report summary
     */
    calculateReportSummary(analytics) {
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
        let improvementTrend;
        if (improvingCount > decliningCount)
            improvementTrend = 'improving';
        else if (decliningCount > improvingCount)
            improvementTrend = 'declining';
        else
            improvementTrend = 'stable';
        // Determine overall risk level
        const riskLevels = analytics.map(a => a.riskAssessment.currentRiskLevel);
        const hasHigh = riskLevels.includes('high');
        const hasCritical = riskLevels.includes('critical');
        const hasMedium = riskLevels.includes('medium');
        let riskLevel;
        if (hasCritical)
            riskLevel = 'critical';
        else if (hasHigh)
            riskLevel = 'high';
        else if (hasMedium)
            riskLevel = 'medium';
        else
            riskLevel = 'low';
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
    generateChartData(analytics) {
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
    generateFamilyInsights(analytics) {
        const keyHighlights = [];
        const concernAreas = [];
        const successStories = [];
        const actionItems = [];
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
    checkMilestoneAchievement(requirement, analytics) {
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
    async getMilestoneRecord(patientId, medicationId, milestoneKey) {
        try {
            const milestoneDoc = await this.firestore
                .collection('adherence_milestones')
                .doc(`${patientId}_${medicationId || 'all'}_${milestoneKey}`)
                .get();
            return milestoneDoc.exists;
        }
        catch (error) {
            console.error('❌ Error checking milestone record:', error);
            return false;
        }
    }
    /**
     * Record achieved milestone
     */
    async recordMilestone(patientId, medicationId, milestoneKey, analytics) {
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
        }
        catch (error) {
            console.error('❌ Error recording milestone:', error);
        }
    }
    /**
     * Get next milestone for current streak
     */
    getNextMilestone(currentStreak) {
        const milestones = Object.entries(unifiedMedicationSchema_1.ADHERENCE_MILESTONES)
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
    generateReportId() {
        return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Deserialize event from Firestore data
     */
    deserializeEvent(id, data) {
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
}
exports.AdherenceAnalyticsService = AdherenceAnalyticsService;
