import { Router } from 'express';
import { medicationCalendarService } from '../services/medicationCalendarService';
import { authenticateToken } from '../middleware/auth';
import type { NewMedicationSchedule } from '@shared/types';

const router = Router();

// ===== MEDICATION SCHEDULE ROUTES =====

// Get medication schedules for the authenticated user
router.get('/schedules', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    const schedules = await medicationCalendarService.getMedicationSchedulesByPatientId(patientId);
    
    if (!schedules.success) {
      return res.status(500).json(schedules);
    }

    res.json(schedules);
  } catch (error) {
    console.error('Error getting medication schedules:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get medication schedules for a specific medication
router.get('/schedules/medication/:medicationId', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    const schedules = await medicationCalendarService.getMedicationSchedulesByMedicationId(medicationId);
    
    if (!schedules.success) {
      return res.status(500).json(schedules);
    }

    res.json(schedules);
  } catch (error) {
    console.error('Error getting medication schedules by medication ID:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create a new medication schedule
router.post('/schedules', authenticateToken, async (req, res) => {
  try {
    const scheduleData: NewMedicationSchedule = {
      patientId: req.user!.uid,
      ...req.body,
    };

    // Validate required fields
    if (!scheduleData.medicationId || !scheduleData.frequency || !scheduleData.times || !scheduleData.dosageAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: medicationId, frequency, times, dosageAmount'
      });
    }

    // Validate times array
    if (!Array.isArray(scheduleData.times) || scheduleData.times.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Times must be a non-empty array of HH:MM format strings'
      });
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const time of scheduleData.times) {
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          success: false,
          error: `Invalid time format: ${time}. Use HH:MM format (e.g., 08:00, 14:30)`
        });
      }
    }

    const schedule = await medicationCalendarService.createMedicationSchedule(scheduleData);
    
    if (!schedule.success) {
      return res.status(500).json(schedule);
    }

    res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating medication schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update a medication schedule
router.put('/schedules/:scheduleId', authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    // TODO: Add authorization check to ensure user owns this schedule
    
    const updatedSchedule = await medicationCalendarService.updateMedicationSchedule(scheduleId, req.body);
    
    if (!updatedSchedule.success) {
      return res.status(404).json(updatedSchedule);
    }

    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating medication schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Pause a medication schedule
router.post('/schedules/:scheduleId/pause', authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { pausedUntil } = req.body;
    
    const pausedUntilDate = pausedUntil ? new Date(pausedUntil) : undefined;
    const result = await medicationCalendarService.pauseMedicationSchedule(scheduleId, pausedUntilDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error pausing medication schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Resume a medication schedule
router.post('/schedules/:scheduleId/resume', authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    const result = await medicationCalendarService.resumeMedicationSchedule(scheduleId);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error resuming medication schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== MEDICATION CALENDAR EVENT ROUTES =====

// Get medication calendar events for the authenticated user
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    const { startDate, endDate, medicationId, status } = req.query;
    
    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (medicationId) options.medicationId = medicationId as string;
    if (status) options.status = status as string;

    const events = await medicationCalendarService.getMedicationCalendarEventsByPatientId(patientId, options);
    
    if (!events.success) {
      return res.status(500).json(events);
    }

    res.json(events);
  } catch (error) {
    console.error('Error getting medication calendar events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Mark medication as taken
router.post('/events/:eventId/taken', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { takenAt, notes } = req.body;
    const takenBy = req.user!.uid;
    
    const takenAtDate = takenAt ? new Date(takenAt) : undefined;
    const result = await medicationCalendarService.markMedicationTaken(eventId, takenBy, takenAtDate, notes);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error marking medication as taken:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== ADHERENCE TRACKING ROUTES =====

// Get medication adherence analytics
router.get('/adherence', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    const { medicationId, startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const medId = medicationId as string | undefined;

    const adherence = await medicationCalendarService.calculateMedicationAdherence(
      patientId, 
      medId, 
      start, 
      end
    );
    
    if (!adherence.success) {
      return res.status(500).json(adherence);
    }

    res.json(adherence);
  } catch (error) {
    console.error('Error getting medication adherence:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get adherence summary for dashboard
router.get('/adherence/summary', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    
    // Get adherence for the last 30 days
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    const adherence = await medicationCalendarService.calculateMedicationAdherence(
      patientId, 
      undefined, 
      startDate, 
      endDate
    );
    
    if (!adherence.success) {
      return res.status(500).json(adherence);
    }

    // Calculate overall summary
    const adherenceData = adherence.data || [];
    const summary = {
      totalMedications: adherenceData.length,
      overallAdherenceRate: adherenceData.length > 0 
        ? Math.round(adherenceData.reduce((sum, med) => sum + med.adherenceRate, 0) / adherenceData.length * 100) / 100
        : 0,
      totalScheduledDoses: adherenceData.reduce((sum, med) => sum + med.totalScheduledDoses, 0),
      totalTakenDoses: adherenceData.reduce((sum, med) => sum + med.takenDoses, 0),
      totalMissedDoses: adherenceData.reduce((sum, med) => sum + med.missedDoses, 0),
      medicationsWithPoorAdherence: adherenceData.filter(med => med.adherenceRate < 80).length,
      period: {
        startDate,
        endDate,
        days: 30
      }
    };

    res.json({
      success: true,
      data: {
        summary,
        medications: adherenceData
      }
    });
  } catch (error) {
    console.error('Error getting adherence summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;