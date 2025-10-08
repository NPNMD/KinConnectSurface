/**
 * FamilyAdherenceNotificationService
 * 
 * Single Responsibility: ONLY handles family adherence notifications
 * 
 * This service is responsible for:
 * - Detecting adherence patterns requiring family notification
 * - Generating adherence summaries for family members
 * - Routing notifications based on family permissions
 * - Managing notification thresholds and preferences
 * 
 * This service does NOT:
 * - Calculate adherence metrics (delegates to AdherenceAnalyticsService)
 * - Send notifications directly (delegates to MedicationNotificationService)
 * - Modify medication state (read-only analytics)
 * - Manage family access permissions (uses existing family_access)
 */

import * as admin from 'firebase-admin';
import { AdherenceAnalyticsService, AdherenceReport } from './unified/AdherenceAnalyticsService';
import { MedicationNotificationService, NotificationRequest } from './unified/MedicationNotificationService';
import { ComprehensiveAdherenceAnalytics } from '../schemas/unifiedMedicationSchema';

export interface FamilyNotificationPreferences {
  patientId: string;
  familyMemberId: string;
  
  // Notification types
  enablePatternAlerts: boolean;
  enableWeeklySummaries: boolean;
  enableMonthlySummaries: boolean;
  enableMilestoneNotifications: boolean;
  
  // Pattern alert thresholds
  consecutiveMissedThreshold: number; // Default: 2
  adherenceRateThreshold: number; // Default: 70%
  decliningTrendDays: number; // Default: 7
  
  // Summary preferences
  weeklySummaryDay: number; // 0-6, Sunday = 0, Default: 0 (Sunday)
  monthlySummaryDay: number; // 1-31, Default: 1 (1st of month)
  summaryFormat: 'summary' | 'detailed' | 'family_friendly';
  includeCharts: boolean;
  
  // Quiet hours
  quietHours: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    enabled: boolean;
  };
  
  // Notification methods
  preferredMethods: ('email' | 'sms' | 'push' | 'browser')[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface AdherencePattern {
  patternType: 'consecutive_missed' | 'declining_trend' | 'low_adherence' | 'timing_issues' | 'improvement';
  severity: 'info' | 'warning' | 'critical';
  detected: boolean;
  detectedAt: Date;
  
  // Pattern details
  details: {
    description: string;
    metrics: Record<string, number>;
    affectedMedications: string[];
    timeframe: string;
  };
  
  // Recommendations
  recommendations: string[];
  actionItems: string[];
  
  // Notification tracking
  notificationSent: boolean;
  notificationSentAt?: Date;
  familyMembersNotified: string[];
}

export interface FamilyAdherenceSummary {
  summaryId: string;
  patientId: string;
  summaryType: 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  
  // Summary data
  overallAdherence: number;
  totalMedications: number;
  totalDoses: number;
  onTimeRate: number;
  
  // Highlights
  keyHighlights: string[];
  concernAreas: string[];
  successStories: string[];
  actionItems: string[];
  
  // Detailed analytics
  medicationBreakdown: Array<{
    medicationName: string;
    adherenceRate: number;
    missedDoses: number;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  
  // Patterns detected
  patternsDetected: AdherencePattern[];
  
  // Metadata
  generatedAt: Date;
  generatedBy: string;
  notificationsSent: number;
  familyMembersNotified: string[];
}

export class FamilyAdherenceNotificationService {
  private firestore: admin.firestore.Firestore;
  private adherenceService: AdherenceAnalyticsService;
  private notificationService: MedicationNotificationService;
  private preferencesCollection: admin.firestore.CollectionReference;
  private summariesCollection: admin.firestore.CollectionReference;
  private patternsCollection: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.adherenceService = new AdherenceAnalyticsService();
    this.notificationService = new MedicationNotificationService();
    this.preferencesCollection = this.firestore.collection('family_adherence_notification_preferences');
    this.summariesCollection = this.firestore.collection('family_adherence_summaries');
    this.patternsCollection = this.firestore.collection('adherence_patterns_detected');
  }

  // ===== PATTERN DETECTION =====

  /**
   * Detect adherence patterns requiring family notification
   */
  async detectAdherencePatterns(patientId: string, medicationId?: string): Promise<{
    success: boolean;
    data?: AdherencePattern[];
    error?: string;
  }> {
    try {
      console.log('🔍 FamilyAdherenceNotificationService: Detecting patterns for patient:', patientId);

      // Get comprehensive adherence analytics
      const analyticsResult = await this.adherenceService.calculateComprehensiveAdherence({
        patientId,
        medicationId,
        includePatterns: true,
        includePredictions: true,
        includeFamilyData: true
      });

      if (!analyticsResult.success || !analyticsResult.data) {
        return {
          success: false,
          error: analyticsResult.error || 'Failed to get adherence analytics'
        };
      }

      const analytics = analyticsResult.data;
      const patterns: AdherencePattern[] = [];

      // Pattern 1: Consecutive Missed Doses
      if (analytics.patterns.consecutiveMissedDoses >= 2) {
        patterns.push({
          patternType: 'consecutive_missed',
          severity: analytics.patterns.consecutiveMissedDoses >= 3 ? 'critical' : 'warning',
          detected: true,
          detectedAt: new Date(),
          details: {
            description: `${analytics.patterns.consecutiveMissedDoses} consecutive doses missed`,
            metrics: {
              consecutiveMissed: analytics.patterns.consecutiveMissedDoses,
              adherenceRate: analytics.adherenceMetrics.overallAdherenceRate
            },
            affectedMedications: medicationId ? [medicationId] : [],
            timeframe: 'recent'
          },
          recommendations: [
            'Check if patient needs assistance with medication management',
            'Review medication schedule for conflicts',
            'Consider setting up additional reminders'
          ],
          actionItems: [
            'Contact patient to check on their wellbeing',
            'Review recent missed doses with patient',
            'Adjust reminder schedule if needed'
          ],
          notificationSent: false,
          familyMembersNotified: []
        });
      }

      // Pattern 2: Declining Adherence Trend
      if (analytics.patterns.improvementTrend === 'declining') {
        patterns.push({
          patternType: 'declining_trend',
          severity: analytics.adherenceMetrics.overallAdherenceRate < 70 ? 'critical' : 'warning',
          detected: true,
          detectedAt: new Date(),
          details: {
            description: 'Adherence rate is declining over time',
            metrics: {
              currentAdherence: analytics.adherenceMetrics.overallAdherenceRate,
              trend: -1 // Declining
            },
            affectedMedications: medicationId ? [medicationId] : [],
            timeframe: 'last_30_days'
          },
          recommendations: [
            'Schedule a check-in with patient',
            'Identify barriers to adherence',
            'Consider simplifying medication schedule'
          ],
          actionItems: [
            'Discuss adherence challenges with patient',
            'Review medication side effects',
            'Explore reminder optimization'
          ],
          notificationSent: false,
          familyMembersNotified: []
        });
      }

      // Pattern 3: Low Overall Adherence
      if (analytics.adherenceMetrics.overallAdherenceRate < 70) {
        patterns.push({
          patternType: 'low_adherence',
          severity: analytics.adherenceMetrics.overallAdherenceRate < 50 ? 'critical' : 'warning',
          detected: true,
          detectedAt: new Date(),
          details: {
            description: `Overall adherence rate is ${Math.round(analytics.adherenceMetrics.overallAdherenceRate)}%`,
            metrics: {
              adherenceRate: analytics.adherenceMetrics.overallAdherenceRate,
              missedDoses: analytics.adherenceMetrics.missedDoses,
              totalScheduled: analytics.adherenceMetrics.totalScheduledDoses
            },
            affectedMedications: medicationId ? [medicationId] : [],
            timeframe: 'last_30_days'
          },
          recommendations: [
            'Immediate family intervention recommended',
            'Review medication regimen with healthcare provider',
            'Consider medication management support services'
          ],
          actionItems: [
            'Schedule urgent family meeting',
            'Contact healthcare provider',
            'Assess need for additional support'
          ],
          notificationSent: false,
          familyMembersNotified: []
        });
      }

      // Pattern 4: Timing Issues
      if (analytics.adherenceMetrics.onTimeAdherenceRate < 60 && analytics.adherenceMetrics.totalTakenDoses > 0) {
        patterns.push({
          patternType: 'timing_issues',
          severity: 'info',
          detected: true,
          detectedAt: new Date(),
          details: {
            description: `Only ${Math.round(analytics.adherenceMetrics.onTimeAdherenceRate)}% of doses taken on time`,
            metrics: {
              onTimeRate: analytics.adherenceMetrics.onTimeAdherenceRate,
              averageDelay: analytics.adherenceMetrics.averageDelayMinutes
            },
            affectedMedications: medicationId ? [medicationId] : [],
            timeframe: 'last_30_days'
          },
          recommendations: [
            'Review medication schedule timing',
            'Consider adjusting reminder times',
            'Discuss timing challenges with patient'
          ],
          actionItems: [
            'Optimize reminder schedule',
            'Identify timing conflicts',
            'Adjust medication times if possible'
          ],
          notificationSent: false,
          familyMembersNotified: []
        });
      }

      // Pattern 5: Improvement (positive pattern)
      if (analytics.patterns.improvementTrend === 'improving' && analytics.patterns.currentAdherenceStreak >= 7) {
        patterns.push({
          patternType: 'improvement',
          severity: 'info',
          detected: true,
          detectedAt: new Date(),
          details: {
            description: `${analytics.patterns.currentAdherenceStreak}-day adherence streak!`,
            metrics: {
              streakDays: analytics.patterns.currentAdherenceStreak,
              adherenceRate: analytics.adherenceMetrics.overallAdherenceRate
            },
            affectedMedications: medicationId ? [medicationId] : [],
            timeframe: 'recent'
          },
          recommendations: [
            'Celebrate this achievement with patient',
            'Encourage continued adherence',
            'Identify what\'s working well'
          ],
          actionItems: [
            'Send congratulatory message',
            'Reinforce positive behaviors',
            'Continue current support approach'
          ],
          notificationSent: false,
          familyMembersNotified: []
        });
      }

      console.log(`✅ Detected ${patterns.length} adherence patterns for patient:`, patientId);

      return {
        success: true,
        data: patterns
      };

    } catch (error) {
      console.error('❌ FamilyAdherenceNotificationService: Error detecting patterns:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect adherence patterns'
      };
    }
  }

  /**
   * Send pattern-based alerts to family members
   */
  async sendPatternAlerts(patientId: string, patterns: AdherencePattern[]): Promise<{
    success: boolean;
    data?: {
      alertsSent: number;
      familyMembersNotified: number;
      errors: string[];
    };
    error?: string;
  }> {
    try {
      console.log('📨 FamilyAdherenceNotificationService: Sending pattern alerts for patient:', patientId);

      const alertsSent = 0;
      const familyMembersNotified = new Set<string>();
      const errors: string[] = [];

      // Get family members with notification permissions
      const familyMembers = await this.getFamilyMembersForNotification(patientId);

      if (familyMembers.length === 0) {
        console.log('ℹ️ No family members configured for adherence notifications');
        return {
          success: true,
          data: {
            alertsSent: 0,
            familyMembersNotified: 0,
            errors: []
          }
        };
      }

      // Filter patterns that should trigger notifications
      const criticalPatterns = patterns.filter(p => 
        (p.severity === 'critical' || p.severity === 'warning') && 
        !p.notificationSent
      );

      if (criticalPatterns.length === 0) {
        console.log('ℹ️ No critical patterns requiring notification');
        return {
          success: true,
          data: {
            alertsSent: 0,
            familyMembersNotified: 0,
            errors: []
          }
        };
      }

      // Send notifications for each critical pattern
      for (const pattern of criticalPatterns) {
        try {
          // Filter family members based on their preferences
          const eligibleRecipients = await this.filterRecipientsByPreferences(
            familyMembers,
            'pattern_alert',
            pattern.severity
          );

          if (eligibleRecipients.length === 0) {
            console.log(`⏭️ No eligible recipients for ${pattern.patternType} pattern`);
            continue;
          }

          // Build notification request
          const notificationRequest: NotificationRequest = {
            patientId,
            commandId: 'adherence_pattern', // Not medication-specific
            medicationName: 'Medication Adherence',
            notificationType: 'alert',
            urgency: pattern.severity === 'critical' ? 'critical' : 'high',
            title: `Adherence Alert: ${this.getPatternTitle(pattern)}`,
            message: this.generatePatternAlertMessage(pattern),
            actionUrl: `/patients/${patientId}/adherence`,
            recipients: eligibleRecipients,
            context: {
              correlationId: `pattern_${pattern.patternType}_${Date.now()}`,
              triggerSource: 'system_alert'
            }
          };

          // Send notification
          const sendResult = await this.notificationService.sendNotification(notificationRequest);

          if (sendResult.success && sendResult.data) {
            // Track notification
            eligibleRecipients.forEach(r => familyMembersNotified.add(r.userId));
            
            // Mark pattern as notified
            await this.markPatternNotified(patientId, pattern, Array.from(familyMembersNotified));
            
            console.log(`✅ Pattern alert sent: ${pattern.patternType} to ${sendResult.data.totalSent} recipients`);
          } else {
            errors.push(`Failed to send ${pattern.patternType} alert: ${sendResult.error}`);
          }

        } catch (patternError) {
          const errorMsg = `Error sending alert for ${pattern.patternType}: ${patternError instanceof Error ? patternError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      return {
        success: true,
        data: {
          alertsSent: criticalPatterns.length,
          familyMembersNotified: familyMembersNotified.size,
          errors
        }
      };

    } catch (error) {
      console.error('❌ FamilyAdherenceNotificationService: Error sending pattern alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send pattern alerts'
      };
    }
  }

  /**
   * Generate weekly adherence summary for family members
   */
  async generateWeeklySummary(patientId: string): Promise<{
    success: boolean;
    data?: FamilyAdherenceSummary;
    error?: string;
  }> {
    try {
      console.log('📊 FamilyAdherenceNotificationService: Generating weekly summary for patient:', patientId);

      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Generate adherence report
      const reportResult = await this.adherenceService.generateAdherenceReport({
        patientId,
        reportType: 'weekly',
        format: 'family_friendly',
        includeCharts: true
      });

      if (!reportResult.success || !reportResult.data) {
        return {
          success: false,
          error: reportResult.error || 'Failed to generate adherence report'
        };
      }

      const report = reportResult.data;

      // Detect patterns
      const patternsResult = await this.detectAdherencePatterns(patientId);
      const patterns = patternsResult.success && patternsResult.data ? patternsResult.data : [];

      // Build summary
      const summary: FamilyAdherenceSummary = {
        summaryId: `weekly_${patientId}_${Date.now()}`,
        patientId,
        summaryType: 'weekly',
        periodStart: startDate,
        periodEnd: endDate,
        overallAdherence: report.summary.overallAdherenceRate,
        totalMedications: report.summary.totalMedications,
        totalDoses: report.summary.totalDoses,
        onTimeRate: report.summary.onTimeRate,
        keyHighlights: report.familyInsights?.keyHighlights || [],
        concernAreas: report.familyInsights?.concernAreas || [],
        successStories: report.familyInsights?.successStories || [],
        actionItems: report.familyInsights?.actionItems || [],
        medicationBreakdown: report.analytics.map(a => ({
          medicationName: a.medicationId || 'Unknown',
          adherenceRate: a.adherenceMetrics.overallAdherenceRate,
          missedDoses: a.adherenceMetrics.missedDoses,
          trend: a.patterns.improvementTrend
        })),
        patternsDetected: patterns,
        generatedAt: new Date(),
        generatedBy: 'system',
        notificationsSent: 0,
        familyMembersNotified: []
      };

      // Save summary
      await this.summariesCollection.add({
        ...summary,
        periodStart: admin.firestore.Timestamp.fromDate(summary.periodStart),
        periodEnd: admin.firestore.Timestamp.fromDate(summary.periodEnd),
        generatedAt: admin.firestore.Timestamp.fromDate(summary.generatedAt)
      });

      console.log('✅ Weekly summary generated:', summary.summaryId);

      return {
        success: true,
        data: summary
      };

    } catch (error) {
      console.error('❌ FamilyAdherenceNotificationService: Error generating weekly summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate weekly summary'
      };
    }
  }

  /**
   * Generate monthly adherence summary for family members
   */
  async generateMonthlySummary(patientId: string): Promise<{
    success: boolean;
    data?: FamilyAdherenceSummary;
    error?: string;
  }> {
    try {
      console.log('📊 FamilyAdherenceNotificationService: Generating monthly summary for patient:', patientId);

      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Generate adherence report
      const reportResult = await this.adherenceService.generateAdherenceReport({
        patientId,
        reportType: 'monthly',
        format: 'family_friendly',
        includeCharts: true
      });

      if (!reportResult.success || !reportResult.data) {
        return {
          success: false,
          error: reportResult.error || 'Failed to generate adherence report'
        };
      }

      const report = reportResult.data;

      // Detect patterns
      const patternsResult = await this.detectAdherencePatterns(patientId);
      const patterns = patternsResult.success && patternsResult.data ? patternsResult.data : [];

      // Build summary
      const summary: FamilyAdherenceSummary = {
        summaryId: `monthly_${patientId}_${Date.now()}`,
        patientId,
        summaryType: 'monthly',
        periodStart: startDate,
        periodEnd: endDate,
        overallAdherence: report.summary.overallAdherenceRate,
        totalMedications: report.summary.totalMedications,
        totalDoses: report.summary.totalDoses,
        onTimeRate: report.summary.onTimeRate,
        keyHighlights: report.familyInsights?.keyHighlights || [],
        concernAreas: report.familyInsights?.concernAreas || [],
        successStories: report.familyInsights?.successStories || [],
        actionItems: report.familyInsights?.actionItems || [],
        medicationBreakdown: report.analytics.map(a => ({
          medicationName: a.medicationId || 'Unknown',
          adherenceRate: a.adherenceMetrics.overallAdherenceRate,
          missedDoses: a.adherenceMetrics.missedDoses,
          trend: a.patterns.improvementTrend
        })),
        patternsDetected: patterns,
        generatedAt: new Date(),
        generatedBy: 'system',
        notificationsSent: 0,
        familyMembersNotified: []
      };

      // Save summary
      await this.summariesCollection.add({
        ...summary,
        periodStart: admin.firestore.Timestamp.fromDate(summary.periodStart),
        periodEnd: admin.firestore.Timestamp.fromDate(summary.periodEnd),
        generatedAt: admin.firestore.Timestamp.fromDate(summary.generatedAt)
      });

      console.log('✅ Monthly summary generated:', summary.summaryId);

      return {
        success: true,
        data: summary
      };

    } catch (error) {
      console.error('❌ FamilyAdherenceNotificationService: Error generating monthly summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate monthly summary'
      };
    }
  }

  /**
   * Send adherence summary to family members
   */
  async sendAdherenceSummary(summary: FamilyAdherenceSummary): Promise<{
    success: boolean;
    data?: {
      notificationsSent: number;
      familyMembersNotified: number;
      errors: string[];
    };
    error?: string;
  }> {
    try {
      console.log('📨 FamilyAdherenceNotificationService: Sending summary:', summary.summaryId);

      const familyMembers = await this.getFamilyMembersForNotification(summary.patientId);

      if (familyMembers.length === 0) {
        console.log('ℹ️ No family members configured for summary notifications');
        return {
          success: true,
          data: {
            notificationsSent: 0,
            familyMembersNotified: 0,
            errors: []
          }
        };
      }

      // Filter recipients based on summary preferences
      const eligibleRecipients = await this.filterRecipientsByPreferences(
        familyMembers,
        summary.summaryType === 'weekly' ? 'weekly_summary' : 'monthly_summary',
        'info'
      );

      if (eligibleRecipients.length === 0) {
        console.log('ℹ️ No eligible recipients for summary notifications');
        return {
          success: true,
          data: {
            notificationsSent: 0,
            familyMembersNotified: 0,
            errors: []
          }
        };
      }

      // Build notification request
      const notificationRequest: NotificationRequest = {
        patientId: summary.patientId,
        commandId: 'adherence_summary',
        medicationName: 'Medication Adherence Summary',
        notificationType: 'status_change',
        urgency: 'low',
        title: `${summary.summaryType === 'weekly' ? 'Weekly' : 'Monthly'} Medication Adherence Summary`,
        message: this.generateSummaryMessage(summary),
        actionUrl: `/patients/${summary.patientId}/adherence`,
        recipients: eligibleRecipients,
        context: {
          correlationId: `summary_${summary.summaryId}`,
          triggerSource: 'scheduled'
        }
      };

      // Send notification
      const sendResult = await this.notificationService.sendNotification(notificationRequest);

      if (sendResult.success && sendResult.data) {
        const familyMemberIds = eligibleRecipients.map(r => r.userId);
        
        // Update summary with notification tracking
        await this.summariesCollection.doc(summary.summaryId).update({
          notificationsSent: sendResult.data.totalSent,
          familyMembersNotified: familyMemberIds,
          notificationSentAt: admin.firestore.Timestamp.now()
        });

        console.log(`✅ Summary sent to ${sendResult.data.totalSent} recipients`);

        return {
          success: true,
          data: {
            notificationsSent: sendResult.data.totalSent,
            familyMembersNotified: familyMemberIds.length,
            errors: []
          }
        };
      } else {
        return {
          success: false,
          error: sendResult.error || 'Failed to send summary notifications'
        };
      }

    } catch (error) {
      console.error('❌ FamilyAdherenceNotificationService: Error sending summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send adherence summary'
      };
    }
  }

  // ===== PREFERENCE MANAGEMENT =====

  /**
   * Get family notification preferences
   */
  async getFamilyNotificationPreferences(patientId: string, familyMemberId: string): Promise<FamilyNotificationPreferences> {
    try {
      const prefsDoc = await this.preferencesCollection.doc(`${patientId}_${familyMemberId}`).get();
      
      if (!prefsDoc.exists) {
        return this.getDefaultPreferences(patientId, familyMemberId);
      }

      const data = prefsDoc.data()!;
      return {
        patientId,
        familyMemberId,
        enablePatternAlerts: data.enablePatternAlerts ?? true,
        enableWeeklySummaries: data.enableWeeklySummaries ?? true,
        enableMonthlySummaries: data.enableMonthlySummaries ?? true,
        enableMilestoneNotifications: data.enableMilestoneNotifications ?? true,
        consecutiveMissedThreshold: data.consecutiveMissedThreshold || 2,
        adherenceRateThreshold: data.adherenceRateThreshold || 70,
        decliningTrendDays: data.decliningTrendDays || 7,
        weeklySummaryDay: data.weeklySummaryDay || 0,
        monthlySummaryDay: data.monthlySummaryDay || 1,
        summaryFormat: data.summaryFormat || 'family_friendly',
        includeCharts: data.includeCharts ?? true,
        quietHours: data.quietHours || {
          start: '22:00',
          end: '07:00',
          enabled: true
        },
        preferredMethods: data.preferredMethods || ['email', 'browser'],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };

    } catch (error) {
      console.error('❌ Error getting family notification preferences:', error);
      return this.getDefaultPreferences(patientId, familyMemberId);
    }
  }

  /**
   * Update family notification preferences
   */
  async updateFamilyNotificationPreferences(
    patientId: string,
    familyMemberId: string,
    preferences: Partial<FamilyNotificationPreferences>
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const prefsRef = this.preferencesCollection.doc(`${patientId}_${familyMemberId}`);
      
      const updateData = {
        ...preferences,
        patientId,
        familyMemberId,
        updatedAt: admin.firestore.Timestamp.now()
      };

      await prefsRef.set(updateData, { merge: true });

      console.log('✅ Family notification preferences updated');

      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Error updating family notification preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update preferences'
      };
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Get family members who should receive adherence notifications
   */
  private async getFamilyMembersForNotification(patientId: string): Promise<NotificationRequest['recipients']> {
    try {
      const familyAccessQuery = await this.firestore
        .collection('family_calendar_access')
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();

      const recipients: NotificationRequest['recipients'] = [];

      for (const doc of familyAccessQuery.docs) {
        const access = doc.data();
        
        // Only include family members who can receive notifications
        if (access.permissions?.canReceiveNotifications) {
          const familyMemberDoc = await this.firestore
            .collection('users')
            .doc(access.familyMemberId)
            .get();

          if (familyMemberDoc.exists) {
            const familyMemberData = familyMemberDoc.data()!;
            
            recipients.push({
              userId: access.familyMemberId,
              name: familyMemberData.name || access.familyMemberName || 'Family Member',
              email: familyMemberData.email || access.familyMemberEmail,
              phone: familyMemberData.phone,
              preferredMethods: ['email', 'browser'],
              isPatient: false,
              isFamilyMember: true,
              isEmergencyContact: access.permissions?.isEmergencyContact || false
            });
          }
        }
      }

      return recipients;

    } catch (error) {
      console.error('❌ Error getting family members for notification:', error);
      return [];
    }
  }

  /**
   * Filter recipients based on their notification preferences
   */
  private async filterRecipientsByPreferences(
    recipients: NotificationRequest['recipients'],
    notificationType: 'pattern_alert' | 'weekly_summary' | 'monthly_summary',
    severity: 'info' | 'warning' | 'critical'
  ): Promise<NotificationRequest['recipients']> {
    const filtered: NotificationRequest['recipients'] = [];

    for (const recipient of recipients) {
      if (recipient.isPatient) {
        // Always include patient
        filtered.push(recipient);
        continue;
      }

      // Get family member preferences
      const prefs = await this.getFamilyNotificationPreferences(
        recipients[0].userId, // patientId from first recipient
        recipient.userId
      );

      // Check if this notification type is enabled
      let shouldInclude = false;
      
      switch (notificationType) {
        case 'pattern_alert':
          shouldInclude = prefs.enablePatternAlerts;
          break;
        case 'weekly_summary':
          shouldInclude = prefs.enableWeeklySummaries;
          break;
        case 'monthly_summary':
          shouldInclude = prefs.enableMonthlySummaries;
          break;
      }

      // Always send critical alerts regardless of preferences
      if (severity === 'critical') {
        shouldInclude = true;
      }

      if (shouldInclude) {
        filtered.push(recipient);
      }
    }

    return filtered;
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(patientId: string, familyMemberId: string): FamilyNotificationPreferences {
    return {
      patientId,
      familyMemberId,
      enablePatternAlerts: true,
      enableWeeklySummaries: true,
      enableMonthlySummaries: true,
      enableMilestoneNotifications: true,
      consecutiveMissedThreshold: 2,
      adherenceRateThreshold: 70,
      decliningTrendDays: 7,
      weeklySummaryDay: 0, // Sunday
      monthlySummaryDay: 1, // 1st of month
      summaryFormat: 'family_friendly',
      includeCharts: true,
      quietHours: {
        start: '22:00',
        end: '07:00',
        enabled: true
      },
      preferredMethods: ['email', 'browser'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get pattern title for notification
   */
  private getPatternTitle(pattern: AdherencePattern): string {
    switch (pattern.patternType) {
      case 'consecutive_missed':
        return 'Consecutive Missed Doses Detected';
      case 'declining_trend':
        return 'Declining Adherence Trend';
      case 'low_adherence':
        return 'Low Adherence Rate';
      case 'timing_issues':
        return 'Medication Timing Issues';
      case 'improvement':
        return 'Adherence Improvement!';
      default:
        return 'Adherence Pattern Detected';
    }
  }

  /**
   * Generate pattern alert message
   */
  private generatePatternAlertMessage(pattern: AdherencePattern): string {
    let message = pattern.details.description + '\n\n';
    
    if (pattern.recommendations.length > 0) {
      message += 'Recommendations:\n';
      pattern.recommendations.forEach(rec => {
        message += `• ${rec}\n`;
      });
    }
    
    if (pattern.actionItems.length > 0) {
      message += '\nSuggested Actions:\n';
      pattern.actionItems.forEach(action => {
        message += `• ${action}\n`;
      });
    }
    
    return message.trim();
  }

  /**
   * Generate summary message for family members
   */
  private generateSummaryMessage(summary: FamilyAdherenceSummary): string {
    let message = `${summary.summaryType === 'weekly' ? 'Weekly' : 'Monthly'} Medication Adherence Summary\n\n`;
    
    message += `Overall Adherence: ${Math.round(summary.overallAdherence)}%\n`;
    message += `Total Medications: ${summary.totalMedications}\n`;
    message += `Total Doses: ${summary.totalDoses}\n`;
    message += `On-Time Rate: ${Math.round(summary.onTimeRate)}%\n\n`;
    
    if (summary.keyHighlights.length > 0) {
      message += 'Highlights:\n';
      summary.keyHighlights.forEach(highlight => {
        message += `✓ ${highlight}\n`;
      });
      message += '\n';
    }
    
    if (summary.concernAreas.length > 0) {
      message += 'Areas of Concern:\n';
      summary.concernAreas.forEach(concern => {
        message += `⚠ ${concern}\n`;
      });
      message += '\n';
    }
    
    if (summary.actionItems.length > 0) {
      message += 'Recommended Actions:\n';
      summary.actionItems.forEach(action => {
        message += `• ${action}\n`;
      });
    }
    
    return message.trim();
  }

  /**
   * Mark pattern as notified
   */
  private async markPatternNotified(
    patientId: string,
    pattern: AdherencePattern,
    familyMemberIds: string[]
  ): Promise<void> {
    try {
      await this.patternsCollection.add({
        patientId,
        patternType: pattern.patternType,
        severity: pattern.severity,
        detectedAt: admin.firestore.Timestamp.fromDate(pattern.detectedAt),
        details: pattern.details,
        notificationSent: true,
        notificationSentAt: admin.firestore.Timestamp.now(),
        familyMembersNotified: familyMemberIds,
        createdAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error marking pattern as notified:', error);
    }
  }
}