import { Router } from 'express';
import { calendarService } from '../services/calendarService';
import { emailService } from '../services/emailService';
import { authenticateToken } from '../middleware/auth';
import {
  canViewCalendar,
  canCreateEvents,
  canEditEvents,
  canDeleteEvents,
  canClaimResponsibility,
  canManageFamily,
  canViewMedicalDetails
} from '../middleware/familyPermissions';
import type { NewMedicalEvent, NewFamilyCalendarAccess, NewCalendarViewSettings } from '@shared/types';

const router = Router();

// ===== MEDICAL EVENTS ROUTES =====

// Get all medical events for a patient (requires view permission)
router.get('/events/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { 
      startDate, 
      endDate, 
      eventType, 
      status, 
      priority, 
      providerId, 
      facilityId,
      limit = '50',
      offset = '0'
    } = req.query;

    const events = await calendarService.getMedicalEventsByPatientId(patientId, {
      startDate: startDate as string,
      endDate: endDate as string,
      eventType: eventType as string,
      status: status as string,
      priority: priority as string,
      providerId: providerId as string,
      facilityId: facilityId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
    
    if (!events.success) {
      return res.status(500).json(events);
    }

    res.json(events);
  } catch (error) {
    console.error('Error getting medical events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get a specific medical event by ID (requires view permission)
router.get('/events/:patientId/:eventId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    
    const event = await calendarService.getMedicalEventById(eventId, userId);
    
    if (!event.success) {
      return res.status(event.data ? 500 : 404).json(event);
    }

    res.json(event);
  } catch (error) {
    console.error('Error getting medical event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create a new medical event (requires create permission)
router.post('/events/:patientId', authenticateToken, canCreateEvents, async (req, res) => {
  try {
    const { patientId } = req.params;
    const eventData: NewMedicalEvent = {
      patientId,
      createdBy: req.user!.uid,
      ...req.body,
    };

    // Validate required fields
    if (!eventData.title || !eventData.eventType || !eventData.startDateTime || !eventData.endDateTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, eventType, startDateTime, endDateTime'
      });
    }

    // Validate date logic
    const startDate = new Date(eventData.startDateTime);
    const endDate = new Date(eventData.endDateTime);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    const event = await calendarService.createMedicalEvent(eventData);
    
    if (!event.success) {
      return res.status(500).json(event);
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating medical event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update an existing medical event (requires edit permission)
router.put('/events/:patientId/:eventId', authenticateToken, canEditEvents, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    
    // First check if event exists and user has access
    const existingEvent = await calendarService.getMedicalEventById(eventId, userId);
    
    if (!existingEvent.success) {
      return res.status(404).json(existingEvent);
    }

    // Add updatedBy field
    const updateData = {
      ...req.body,
      updatedBy: userId,
      updatedAt: new Date(),
      version: (existingEvent.data!.version || 0) + 1
    };

    const updatedEvent = await calendarService.updateMedicalEvent(eventId, updateData, userId);
    
    if (!updatedEvent.success) {
      return res.status(500).json(updatedEvent);
    }

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating medical event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Delete a medical event (requires delete permission)
router.delete('/events/:patientId/:eventId', authenticateToken, canDeleteEvents, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    
    // First check if event exists and user has access
    const existingEvent = await calendarService.getMedicalEventById(eventId, userId);
    
    if (!existingEvent.success) {
      return res.status(404).json(existingEvent);
    }

    const result = await calendarService.deleteMedicalEvent(eventId, userId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting medical event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Claim responsibility for an appointment (requires claim responsibility permission)
router.post('/events/:patientId/:eventId/claim-responsibility', authenticateToken, canClaimResponsibility, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    const { transportationNotes } = req.body;

    const result = await calendarService.claimEventResponsibility(eventId, userId, transportationNotes);
    
    if (!result.success) {
      return res.status(result.error?.includes('not found') ? 404 : 403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error claiming event responsibility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Confirm responsibility for an appointment (requires manage family permission)
router.post('/events/:patientId/:eventId/confirm-responsibility', authenticateToken, canManageFamily, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;

    const result = await calendarService.confirmEventResponsibility(eventId, userId);
    
    if (!result.success) {
      return res.status(result.error?.includes('not found') ? 404 : 403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error confirming event responsibility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get events by responsibility status (requires view permission)
router.get('/events/:patientId/responsibility/:status', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.user!.uid;
    
    if (!['unassigned', 'claimed', 'confirmed', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid responsibility status'
      });
    }

    const events = await calendarService.getEventsByResponsibilityStatus(userId, status as any);
    
    if (!events.success) {
      return res.status(500).json(events);
    }

    res.json(events);
  } catch (error) {
    console.error('Error getting events by responsibility status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== FAMILY CALENDAR ACCESS ROUTES =====

// Get family calendar access for a patient (requires manage family permission)
router.get('/family-access/:patientId', authenticateToken, canManageFamily, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const access = await calendarService.getFamilyCalendarAccess(patientId);
    
    if (!access.success) {
      return res.status(500).json(access);
    }

    res.json(access);
  } catch (error) {
    console.error('Error getting family calendar access:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Grant family calendar access (requires manage family permission)
router.post('/family-access/:patientId', authenticateToken, canManageFamily, async (req, res) => {
  try {
    const { patientId } = req.params;
    const accessData: NewFamilyCalendarAccess = {
      patientId,
      createdBy: req.user!.uid,
      ...req.body,
    };

    // Validate required fields
    if (!accessData.familyMemberId || !accessData.familyMemberName || !accessData.familyMemberEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: familyMemberId, familyMemberName, familyMemberEmail'
      });
    }

    const access = await calendarService.createFamilyCalendarAccess(accessData);
    
    if (!access.success) {
      return res.status(500).json(access);
    }

    res.status(201).json(access);
  } catch (error) {
    console.error('Error creating family calendar access:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update family calendar access (requires manage family permission)
router.put('/family-access/:patientId/:accessId', authenticateToken, canManageFamily, async (req, res) => {
  try {
    const { accessId } = req.params;
    const userId = req.user!.uid;
    
    const updatedAccess = await calendarService.updateFamilyCalendarAccess(accessId, req.body, userId);
    
    if (!updatedAccess.success) {
      return res.status(updatedAccess.error?.includes('not found') ? 404 : 403).json(updatedAccess);
    }

    res.json(updatedAccess);
  } catch (error) {
    console.error('Error updating family calendar access:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Revoke family calendar access (requires manage family permission)
router.delete('/family-access/:patientId/:accessId', authenticateToken, canManageFamily, async (req, res) => {
  try {
    const { accessId } = req.params;
    const userId = req.user!.uid;
    
    const result = await calendarService.revokeFamilyCalendarAccess(accessId, userId);
    
    if (!result.success) {
      return res.status(result.error?.includes('not found') ? 404 : 403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error revoking family calendar access:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== CALENDAR VIEW SETTINGS ROUTES =====

// Get calendar view settings (requires view permission)
router.get('/settings/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { patientId } = req.params;
    
    const settings = await calendarService.getCalendarViewSettings(userId, patientId as string);
    
    if (!settings.success) {
      return res.status(500).json(settings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Error getting calendar view settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create or update calendar view settings (requires view permission)
router.post('/settings/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { patientId } = req.params;
    const settingsData: NewCalendarViewSettings = {
      userId: req.user!.uid,
      patientId,
      ...req.body,
    };

    const settings = await calendarService.createOrUpdateCalendarViewSettings(settingsData);
    
    if (!settings.success) {
      return res.status(500).json(settings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Error creating/updating calendar view settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== CALENDAR ANALYTICS ROUTES =====

// Get calendar analytics/summary (requires view permission)
router.get('/analytics/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await calendarService.getCalendarAnalytics(patientId, {
      startDate: startDate as string,
      endDate: endDate as string
    });
    
    if (!analytics.success) {
      return res.status(500).json(analytics);
    }

    res.json(analytics);
  } catch (error) {
    console.error('Error getting calendar analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get upcoming events summary (requires view permission)
router.get('/upcoming/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = '7' } = req.query;
    
    const upcomingEvents = await calendarService.getUpcomingEvents(patientId, parseInt(days as string));
    
    if (!upcomingEvents.success) {
      return res.status(500).json(upcomingEvents);
    }

    res.json(upcomingEvents);
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get events requiring attention (requires view permission)
router.get('/attention-required/:patientId', authenticateToken, canViewCalendar, async (req, res) => {
  try {
    const userId = req.user!.uid;
    
    const attentionEvents = await calendarService.getEventsRequiringAttention(userId);
    
    if (!attentionEvents.success) {
      return res.status(500).json(attentionEvents);
    }

    res.json(attentionEvents);
  } catch (error) {
    console.error('Error getting events requiring attention:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;