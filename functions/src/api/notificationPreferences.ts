/**
 * Notification Preferences API
 * 
 * Endpoints for managing medication notification preferences
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';
import { MedicationNotificationService } from '../services/unified/MedicationNotificationService';

const router = Router();

// Helper to get firestore instance (lazy initialization)
const getFirestore = () => admin.firestore();

/**
 * Get notification preferences for current user
 * GET /notification-preferences
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { patientId } = req.query;
    
    // Determine target patient (default to current user)
    const targetPatientId = patientId as string || userId;
    
    console.log('🔔 Getting notification preferences for patient:', targetPatientId, 'requested by:', userId);
    
    // Check access permissions if requesting another patient's preferences
    if (targetPatientId !== userId) {
      const familyAccess = await getFirestore().collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    const notificationService = new MedicationNotificationService();
    const preferences = await notificationService.getNotificationPreferences(targetPatientId, userId);
    
    res.json({
      success: true,
      data: preferences
    });
    
  } catch (error) {
    console.error('❌ Error getting notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update notification preferences for current user
 * PUT /notification-preferences
 */
router.put('/', async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { patientId, ...preferences } = req.body;
    
    // Determine target patient (default to current user)
    const targetPatientId = patientId || userId;
    
    console.log('🔔 Updating notification preferences for patient:', targetPatientId, 'by user:', userId);
    
    // Check access permissions if updating another patient's preferences
    if (targetPatientId !== userId) {
      const familyAccess = await getFirestore().collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if user has edit permissions
      const accessData = familyAccess.docs[0].data();
      if (!accessData.permissions?.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to edit notification preferences'
        });
      }
    }
    
    // Validate preferences
    if (preferences.enabledMethods && !Array.isArray(preferences.enabledMethods)) {
      return res.status(400).json({
        success: false,
        error: 'enabledMethods must be an array'
      });
    }
    
    if (preferences.quietHours) {
      const { start, end } = preferences.quietHours;
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (start && !timeRegex.test(start)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours start time format (use HH:MM)'
        });
      }
      
      if (end && !timeRegex.test(end)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours end time format (use HH:MM)'
        });
      }
    }
    
    const notificationService = new MedicationNotificationService();
    const result = await notificationService.updateNotificationPreferences(
      targetPatientId,
      userId,
      preferences
    );
    
    if (result.success) {
      // Get updated preferences
      const updatedPreferences = await notificationService.getNotificationPreferences(targetPatientId, userId);
      
      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Notification preferences updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update notification preferences'
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get notification delivery statistics
 * GET /notification-preferences/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { patientId, days = '7' } = req.query;
    
    // Determine target patient (default to current user)
    const targetPatientId = patientId as string || userId;
    
    console.log('📊 Getting notification statistics for patient:', targetPatientId);
    
    // Check access permissions if requesting another patient's statistics
    if (targetPatientId !== userId) {
      const familyAccess = await getFirestore().collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    const notificationService = new MedicationNotificationService();
    const statistics = await notificationService.getDeliveryStatistics(
      targetPatientId,
      parseInt(days as string, 10)
    );
    
    if (statistics.success) {
      res.json({
        success: true,
        data: statistics.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: statistics.error || 'Failed to get delivery statistics'
      });
    }
    
  } catch (error) {
    console.error('❌ Error getting notification statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test notification delivery (for testing purposes)
 * POST /notification-preferences/test
 */
router.post('/test', async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { method = 'browser', patientId } = req.body;
    
    const targetPatientId = patientId || userId;
    
    console.log('🧪 Testing notification delivery:', method, 'for patient:', targetPatientId);
    
    // Get user info
    const userDoc = await getFirestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const notificationService = new MedicationNotificationService();
    
    // Create test notification request
    const testRequest = {
      patientId: targetPatientId,
      commandId: 'test_command',
      medicationName: 'Test Medication',
      notificationType: 'reminder' as const,
      urgency: 'low' as const,
      title: 'Test Notification',
      message: 'This is a test notification from KinConnect',
      recipients: [{
        userId,
        name: userData.name || 'User',
        email: userData.email,
        phone: userData.phone,
        preferredMethods: [method] as ('email' | 'sms' | 'push' | 'browser')[],
        isPatient: true,
        isFamilyMember: false,
        isEmergencyContact: false
      }],
      context: {
        correlationId: `test_${Date.now()}`,
        triggerSource: 'user_action' as const,
        medicationData: {
          dosageAmount: '1 tablet',
          scheduledTime: new Date()
        }
      }
    };
    
    const result = await notificationService.sendNotification(testRequest);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: `Test notification sent via ${method}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test notification'
      });
    }
    
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get notification delivery log
 * GET /notification-preferences/delivery-log
 */
router.get('/delivery-log', async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { patientId, limit = '50', startDate, endDate } = req.query;
    
    const targetPatientId = patientId as string || userId;
    
    console.log('📋 Getting notification delivery log for patient:', targetPatientId);
    
    // Check access permissions
    if (targetPatientId !== userId) {
      const familyAccess = await getFirestore().collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    // Build query
    let query = getFirestore().collection('medication_notification_delivery_log')
      .where('patientId', '==', targetPatientId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string, 10));
    
    // Add date filters if provided
    if (startDate) {
      query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate as string)));
    }
    if (endDate) {
      query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate as string)));
    }
    
    const snapshot = await query.get();
    
    const deliveryLog = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate()
      };
    });
    
    res.json({
      success: true,
      data: deliveryLog,
      message: `Found ${deliveryLog.length} delivery log entries`
    });
    
  } catch (error) {
    console.error('❌ Error getting delivery log:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;