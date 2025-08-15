import { Router } from 'express';
import { medicationService } from '../services/medicationService';
import { authenticateToken } from '../middleware/auth';
import type { NewMedication, NewMedicationLog } from '@shared/types';

const router = Router();

// Get all medications for the authenticated user's patient profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    // For now, using user ID as patient ID - in a real app, you'd get the patient ID from the user
    const patientId = req.user!.uid;
    const medications = await medicationService.getMedicationsByPatientId(patientId);
    
    if (!medications.success) {
      return res.status(500).json(medications);
    }

    res.json(medications);
  } catch (error) {
    console.error('Error getting medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get a specific medication by ID
router.get('/:medicationId', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    const medication = await medicationService.getMedicationById(medicationId);
    
    if (!medication.success) {
      return res.status(medication.data ? 500 : 404).json(medication);
    }

    // TODO: Verify user has access to this medication
    // Check if the medication belongs to the user's patient profile or family group

    res.json(medication);
  } catch (error) {
    console.error('Error getting medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create a new medication
router.post('/', authenticateToken, async (req, res) => {
  try {
    const medicationData: NewMedication = {
      patientId: req.user!.uid, // Using user ID as patient ID for now
      ...req.body,
    };

    // Validate required fields
    if (!medicationData.name || !medicationData.dosage || !medicationData.frequency || !medicationData.instructions || !medicationData.prescribedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, dosage, frequency, instructions, prescribedBy'
      });
    }

    const medication = await medicationService.createMedication(medicationData);
    
    if (!medication.success) {
      return res.status(500).json(medication);
    }

    res.status(201).json(medication);
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update an existing medication
router.put('/:medicationId', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    
    // First check if medication exists and belongs to user
    const existingMedication = await medicationService.getMedicationById(medicationId);
    
    if (!existingMedication.success) {
      return res.status(404).json(existingMedication);
    }

    if (existingMedication.data!.patientId !== req.user!.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedMedication = await medicationService.updateMedication(medicationId, req.body);
    
    if (!updatedMedication.success) {
      return res.status(500).json(updatedMedication);
    }

    res.json(updatedMedication);
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Delete a medication
router.delete('/:medicationId', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    
    // First check if medication exists and belongs to user
    const existingMedication = await medicationService.getMedicationById(medicationId);
    
    if (!existingMedication.success) {
      return res.status(404).json(existingMedication);
    }

    if (existingMedication.data!.patientId !== req.user!.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await medicationService.deleteMedication(medicationId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get active medications only
router.get('/active/list', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    const medications = await medicationService.getActiveMedicationsByPatientId(patientId);
    
    if (!medications.success) {
      return res.status(500).json(medications);
    }

    res.json(medications);
  } catch (error) {
    console.error('Error getting active medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Search medications by name
router.get('/search/:searchTerm', authenticateToken, async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const patientId = req.user!.uid;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters long'
      });
    }

    const medications = await medicationService.searchMedicationsByName(patientId, searchTerm);
    
    if (!medications.success) {
      return res.status(500).json(medications);
    }

    res.json(medications);
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Medication Log Routes

// Get all medication logs for the user
router.get('/logs/all', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user!.uid;
    const logs = await medicationService.getMedicationLogsByPatientId(patientId);
    
    if (!logs.success) {
      return res.status(500).json(logs);
    }

    res.json(logs);
  } catch (error) {
    console.error('Error getting medication logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get medication logs for a specific medication
router.get('/:medicationId/logs', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    
    // First verify the medication belongs to the user
    const medication = await medicationService.getMedicationById(medicationId);
    
    if (!medication.success) {
      return res.status(404).json(medication);
    }

    if (medication.data!.patientId !== req.user!.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const logs = await medicationService.getMedicationLogsByMedicationId(medicationId);
    
    if (!logs.success) {
      return res.status(500).json(logs);
    }

    res.json(logs);
  } catch (error) {
    console.error('Error getting medication logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create a medication log entry
router.post('/:medicationId/logs', authenticateToken, async (req, res) => {
  try {
    const { medicationId } = req.params;
    
    // First verify the medication belongs to the user
    const medication = await medicationService.getMedicationById(medicationId);
    
    if (!medication.success) {
      return res.status(404).json(medication);
    }

    if (medication.data!.patientId !== req.user!.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const logData: NewMedicationLog = {
      medicationId,
      patientId: req.user!.uid,
      takenBy: req.user!.uid, // Assuming the user is taking their own medication
      ...req.body,
    };

    // Validate required fields
    if (!logData.takenAt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: takenAt'
      });
    }

    const log = await medicationService.createMedicationLog(logData);
    
    if (!log.success) {
      return res.status(500).json(log);
    }

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating medication log:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update a medication log entry
router.put('/logs/:logId', authenticateToken, async (req, res) => {
  try {
    const { logId } = req.params;
    
    // TODO: Verify the log belongs to the user's medications
    // This would require getting the log, then checking the medication ownership

    const updatedLog = await medicationService.updateMedicationLog(logId, req.body);
    
    if (!updatedLog.success) {
      return res.status(404).json(updatedLog);
    }

    res.json(updatedLog);
  } catch (error) {
    console.error('Error updating medication log:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Delete a medication log entry
router.delete('/logs/:logId', authenticateToken, async (req, res) => {
  try {
    const { logId } = req.params;
    
    // TODO: Verify the log belongs to the user's medications
    
    const result = await medicationService.deleteMedicationLog(logId);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting medication log:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;