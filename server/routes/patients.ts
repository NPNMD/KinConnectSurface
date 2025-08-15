import { Router } from 'express';
import { patientService } from '../services/patientService';
import { authenticateToken } from '../middleware/auth';
import type { NewPatient } from '@shared/types';

const router = Router();

// Get patient profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const patient = await patientService.getPatientByUserId(req.user!.uid);
    
    if (!patient.success) {
      return res.status(500).json(patient);
    }

    res.json(patient);
  } catch (error) {
    console.error('Error getting patient profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create patient profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const patientData: NewPatient = {
      userId: req.user!.uid,
      ...req.body,
    };

    const patient = await patientService.createPatient(patientData);
    
    if (!patient.success) {
      return res.status(500).json(patient);
    }

    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update patient profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const patient = await patientService.getPatientByUserId(req.user!.uid);
    
    if (!patient.success) {
      return res.status(500).json(patient);
    }

    if (!patient.data) {
      // If no patient profile exists, create one instead of returning 404
      const patientData: NewPatient = {
        userId: req.user!.uid,
        ...req.body,
      };

      const newPatient = await patientService.createPatient(patientData);
      
      if (!newPatient.success) {
        return res.status(500).json(newPatient);
      }

      return res.status(201).json(newPatient);
    }

    const updatedPatient = await patientService.updatePatient(patient.data.id, req.body);
    
    if (!updatedPatient.success) {
      return res.status(500).json(updatedPatient);
    }

    res.json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get patient by ID (for family members)
router.get('/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await patientService.getPatientById(patientId);
    
    if (!patient.success) {
      return res.status(500).json(patient);
    }

    if (!patient.data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Patient not found' 
      });
    }

    // TODO: Check if current user has access to this patient
    // This should be implemented with family group permissions

    res.json(patient);
  } catch (error) {
    console.error('Error getting patient:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Search patients by medical condition
router.get('/search/condition/:condition', authenticateToken, async (req, res) => {
  try {
    const { condition } = req.params;
    const patients = await patientService.searchPatientsByCondition(condition);
    
    if (!patients.success) {
      return res.status(500).json(patients);
    }

    res.json(patients);
  } catch (error) {
    console.error('Error searching patients by condition:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Search patients by allergy
router.get('/search/allergy/:allergy', authenticateToken, async (req, res) => {
  try {
    const { allergy } = req.params;
    const patients = await patientService.searchPatientsByAllergy(allergy);
    
    if (!patients.success) {
      return res.status(500).json(patients);
    }

    res.json(patients);
  } catch (error) {
    console.error('Error searching patients by allergy:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get patients by age range
router.get('/search/age/:minAge/:maxAge', authenticateToken, async (req, res) => {
  try {
    const { minAge, maxAge } = req.params;
    const minAgeNum = parseInt(minAge);
    const maxAgeNum = parseInt(maxAge);

    if (isNaN(minAgeNum) || isNaN(maxAgeNum)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid age range' 
      });
    }

    const patients = await patientService.getPatientsByAgeRange(minAgeNum, maxAgeNum);
    
    if (!patients.success) {
      return res.status(500).json(patients);
    }

    res.json(patients);
  } catch (error) {
    console.error('Error getting patients by age range:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
