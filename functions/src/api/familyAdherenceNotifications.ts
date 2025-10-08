/**
 * Family Adherence Notifications API
 * 
 * Endpoints for managing family member adherence notification preferences
 * and accessing adherence summaries.
 * 
 * Routes:
 * - GET /family-adherence-preferences/:patientId/:familyMemberId - Get preferences
 * - PUT /family-adherence-preferences/:patientId/:familyMemberId - Update preferences
 * - GET /family-adherence-summaries/:patientId - Get summaries for a patient
 * - GET /family-adherence-patterns/:patientId - Get detected patterns
 * - POST /family-adherence-patterns/:patientId/detect - Manually trigger pattern detection
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';
import { FamilyAdherenceNotificationService } from '../services/FamilyAdherenceNotificationService';

const router = Router();

// Helper to get firestore instance (lazy initialization)
const getFirestore = () => admin.firestore();

// Lazy initialization to avoid circular dependencies
let familyNotificationService: FamilyAdherenceNotificationService | null = null;

function getFamilyNotificationService(): FamilyAdherenceNotificationService {
  if (!familyNotificationService) {
    familyNotificationService = new FamilyAdherenceNotificationService();
  }
  return familyNotificationService;
}

/**
 * Get family adherence notification preferences
 */
router.get('/family-adherence-preferences/:patientId/:familyMemberId', async (req, res) => {
  try {
    const { patientId, familyMemberId } = req.params;
    const currentUserId = (req as any).user?.uid;

    console.log('📋 Getting family adherence preferences:', { patientId, familyMemberId, currentUserId });

    // Verify access - must be the family member or the patient
    if (currentUserId !== familyMemberId && currentUserId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify family access relationship exists
    const familyAccessQuery = await getFirestore()
      .collection('family_calendar_access')
      .where('patientId', '==', patientId)
      .where('familyMemberId', '==', familyMemberId)
      .where('status', '==', 'active')
      .get();

    if (familyAccessQuery.empty) {
      return res.status(404).json({
        success: false,
        error: 'Family access relationship not found'
      });
    }

    const service = getFamilyNotificationService();
    const preferences = await service.getFamilyNotificationPreferences(patientId, familyMemberId);

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('❌ Error getting family adherence preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update family adherence notification preferences
 */
router.put('/family-adherence-preferences/:patientId/:familyMemberId', async (req, res) => {
  try {
    const { patientId, familyMemberId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const updates = req.body;

    console.log('📝 Updating family adherence preferences:', { patientId, familyMemberId, currentUserId });

    // Verify access - must be the family member
    if (currentUserId !== familyMemberId) {
      return res.status(403).json({
        success: false,
        error: 'Only the family member can update their own preferences'
      });
    }

    // Verify family access relationship exists
    const familyAccessQuery = await getFirestore()
      .collection('family_calendar_access')
      .where('patientId', '==', patientId)
      .where('familyMemberId', '==', familyMemberId)
      .where('status', '==', 'active')
      .get();

    if (familyAccessQuery.empty) {
      return res.status(404).json({
        success: false,
        error: 'Family access relationship not found'
      });
    }

    const service = getFamilyNotificationService();
    const updateResult = await service.updateFamilyNotificationPreferences(
      patientId,
      familyMemberId,
      updates
    );

    if (updateResult.success) {
      // Get updated preferences
      const updatedPreferences = await service.getFamilyNotificationPreferences(patientId, familyMemberId);
      
      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Preferences updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

  } catch (error) {
    console.error('❌ Error updating family adherence preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get adherence summaries for a patient
 */
router.get('/family-adherence-summaries/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const { limit = '10', summaryType } = req.query;

    console.log('📊 Getting adherence summaries for patient:', patientId);

    // Verify access - must be patient or family member with access
    if (currentUserId !== patientId) {
      const familyAccessQuery = await getFirestore()
        .collection('family_calendar_access')
        .where('patientId', '==', patientId)
        .where('familyMemberId', '==', currentUserId)
        .where('status', '==', 'active')
        .get();

      if (familyAccessQuery.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check if family member can receive notifications
      const access = familyAccessQuery.docs[0].data();
      if (!access.permissions?.canReceiveNotifications) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view adherence summaries'
        });
      }
    }

    // Query summaries
    let query = getFirestore()
      .collection('family_adherence_summaries')
      .where('patientId', '==', patientId)
      .orderBy('generatedAt', 'desc')
      .limit(parseInt(limit as string, 10));

    if (summaryType) {
      query = query.where('summaryType', '==', summaryType);
    }

    const summariesSnapshot = await query.get();

    const summaries = summariesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        periodStart: data.periodStart?.toDate(),
        periodEnd: data.periodEnd?.toDate(),
        generatedAt: data.generatedAt?.toDate()
      };
    });

    res.json({
      success: true,
      data: summaries,
      message: `Found ${summaries.length} adherence summaries`
    });

  } catch (error) {
    console.error('❌ Error getting adherence summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get detected adherence patterns for a patient
 */
router.get('/family-adherence-patterns/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const { limit = '20', severity } = req.query;

    console.log('🔍 Getting adherence patterns for patient:', patientId);

    // Verify access
    if (currentUserId !== patientId) {
      const familyAccessQuery = await getFirestore()
        .collection('family_calendar_access')
        .where('patientId', '==', patientId)
        .where('familyMemberId', '==', currentUserId)
        .where('status', '==', 'active')
        .get();

      if (familyAccessQuery.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const access = familyAccessQuery.docs[0].data();
      if (!access.permissions?.canReceiveNotifications) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view adherence patterns'
        });
      }
    }

    // Query patterns
    let query = getFirestore()
      .collection('adherence_patterns_detected')
      .where('patientId', '==', patientId)
      .orderBy('detectedAt', 'desc')
      .limit(parseInt(limit as string, 10));

    if (severity) {
      query = query.where('severity', '==', severity);
    }

    const patternsSnapshot = await query.get();

    const patterns = patternsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        detectedAt: data.detectedAt?.toDate(),
        notificationSentAt: data.notificationSentAt?.toDate(),
        createdAt: data.createdAt?.toDate()
      };
    });

    res.json({
      success: true,
      data: patterns,
      message: `Found ${patterns.length} adherence patterns`
    });

  } catch (error) {
    console.error('❌ Error getting adherence patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger pattern detection for a patient
 */
router.post('/family-adherence-patterns/:patientId/detect', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const { medicationId, sendNotifications = true } = req.body;

    console.log('🔍 Manual pattern detection requested for patient:', patientId);

    // Verify access - must be patient or family member with permissions
    if (currentUserId !== patientId) {
      const familyAccessQuery = await getFirestore()
        .collection('family_calendar_access')
        .where('patientId', '==', patientId)
        .where('familyMemberId', '==', currentUserId)
        .where('status', '==', 'active')
        .get();

      if (familyAccessQuery.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const access = familyAccessQuery.docs[0].data();
      if (!access.permissions?.canReceiveNotifications) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
    }

    const service = getFamilyNotificationService();

    // Detect patterns
    const patternsResult = await service.detectAdherencePatterns(patientId, medicationId);

    if (!patternsResult.success || !patternsResult.data) {
      return res.status(500).json({
        success: false,
        error: patternsResult.error || 'Failed to detect patterns'
      });
    }

    const patterns = patternsResult.data;

    // Send notifications if requested
    let notificationResult = null;
    if (sendNotifications && patterns.length > 0) {
      notificationResult = await service.sendPatternAlerts(patientId, patterns);
    }

    res.json({
      success: true,
      data: {
        patternsDetected: patterns.length,
        patterns,
        notificationsSent: notificationResult?.data?.alertsSent || 0,
        familyMembersNotified: notificationResult?.data?.familyMembersNotified || 0
      },
      message: `Detected ${patterns.length} adherence patterns`
    });

  } catch (error) {
    console.error('❌ Error in manual pattern detection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger weekly summary generation
 */
router.post('/family-adherence-summaries/:patientId/generate-weekly', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const { sendNotifications = true } = req.body;

    console.log('📊 Manual weekly summary generation requested for patient:', patientId);

    // Verify access - must be patient
    if (currentUserId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Only the patient can manually generate summaries'
      });
    }

    const service = getFamilyNotificationService();

    // Generate summary
    const summaryResult = await service.generateWeeklySummary(patientId);

    if (!summaryResult.success || !summaryResult.data) {
      return res.status(500).json({
        success: false,
        error: summaryResult.error || 'Failed to generate weekly summary'
      });
    }

    const summary = summaryResult.data;

    // Send to family members if requested
    let notificationResult = null;
    if (sendNotifications) {
      notificationResult = await service.sendAdherenceSummary(summary);
    }

    res.json({
      success: true,
      data: {
        summary,
        notificationsSent: notificationResult?.data?.notificationsSent || 0,
        familyMembersNotified: notificationResult?.data?.familyMembersNotified || 0
      },
      message: 'Weekly summary generated successfully'
    });

  } catch (error) {
    console.error('❌ Error generating weekly summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger monthly summary generation
 */
router.post('/family-adherence-summaries/:patientId/generate-monthly', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;
    const { sendNotifications = true } = req.body;

    console.log('📊 Manual monthly summary generation requested for patient:', patientId);

    // Verify access - must be patient
    if (currentUserId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Only the patient can manually generate summaries'
      });
    }

    const service = getFamilyNotificationService();

    // Generate summary
    const summaryResult = await service.generateMonthlySummary(patientId);

    if (!summaryResult.success || !summaryResult.data) {
      return res.status(500).json({
        success: false,
        error: summaryResult.error || 'Failed to generate monthly summary'
      });
    }

    const summary = summaryResult.data;

    // Send to family members if requested
    let notificationResult = null;
    if (sendNotifications) {
      notificationResult = await service.sendAdherenceSummary(summary);
    }

    res.json({
      success: true,
      data: {
        summary,
        notificationsSent: notificationResult?.data?.notificationsSent || 0,
        familyMembersNotified: notificationResult?.data?.familyMembersNotified || 0
      },
      message: 'Monthly summary generated successfully'
    });

  } catch (error) {
    console.error('❌ Error generating monthly summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get family members who receive adherence notifications for a patient
 */
router.get('/family-adherence-recipients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user?.uid;

    console.log('👥 Getting adherence notification recipients for patient:', patientId);

    // Verify access - must be patient
    if (currentUserId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Only the patient can view notification recipients'
      });
    }

    // Get family members with notification permissions
    const familyAccessQuery = await getFirestore()
      .collection('family_calendar_access')
      .where('patientId', '==', patientId)
      .where('status', '==', 'active')
      .get();

    const recipients = [];

    for (const doc of familyAccessQuery.docs) {
      const access = doc.data();
      
      if (access.permissions?.canReceiveNotifications) {
        // Get family member's preferences
        const service = getFamilyNotificationService();
        const preferences = await service.getFamilyNotificationPreferences(patientId, access.familyMemberId);
        
        recipients.push({
          familyMemberId: access.familyMemberId,
          familyMemberName: access.familyMemberName,
          familyMemberEmail: access.familyMemberEmail,
          relationship: access.relationship,
          isEmergencyContact: access.permissions?.isEmergencyContact || false,
          preferences: {
            enablePatternAlerts: preferences.enablePatternAlerts,
            enableWeeklySummaries: preferences.enableWeeklySummaries,
            enableMonthlySummaries: preferences.enableMonthlySummaries,
            preferredMethods: preferences.preferredMethods
          }
        });
      }
    }

    res.json({
      success: true,
      data: recipients,
      message: `Found ${recipients.length} family members receiving adherence notifications`
    });

  } catch (error) {
    console.error('❌ Error getting adherence recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;