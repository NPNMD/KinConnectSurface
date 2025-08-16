import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  createHealthcareProvider,
  getHealthcareProviders,
  updateHealthcareProvider,
  deleteHealthcareProvider,
  createMedicalFacility,
  getMedicalFacilities,
  updateMedicalFacility,
  deleteMedicalFacility
} from '../services/healthcareProviderService';

const router = express.Router();

// Healthcare Providers Routes
router.get('/providers/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const providers = await getHealthcareProviders(patientId);
    res.json({ success: true, data: providers });
  } catch (error) {
    console.error('Error fetching healthcare providers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch healthcare providers' 
    });
  }
});

router.post('/providers', authenticateToken, async (req, res) => {
  try {
    const provider = await createHealthcareProvider(req.body);
    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    console.error('Error creating healthcare provider:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create healthcare provider' 
    });
  }
});

router.put('/providers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await updateHealthcareProvider(id, req.body);
    res.json({ success: true, data: provider });
  } catch (error) {
    console.error('Error updating healthcare provider:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update healthcare provider' 
    });
  }
});

router.delete('/providers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteHealthcareProvider(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting healthcare provider:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete healthcare provider' 
    });
  }
});

// Medical Facilities Routes
router.get('/facilities/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const facilities = await getMedicalFacilities(patientId);
    res.json({ success: true, data: facilities });
  } catch (error) {
    console.error('Error fetching medical facilities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch medical facilities' 
    });
  }
});

router.post('/facilities', authenticateToken, async (req, res) => {
  try {
    const facility = await createMedicalFacility(req.body);
    res.status(201).json({ success: true, data: facility });
  } catch (error) {
    console.error('Error creating medical facility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create medical facility' 
    });
  }
});

router.put('/facilities/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const facility = await updateMedicalFacility(id, req.body);
    res.json({ success: true, data: facility });
  } catch (error) {
    console.error('Error updating medical facility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update medical facility' 
    });
  }
});

router.delete('/facilities/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMedicalFacility(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting medical facility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete medical facility' 
    });
  }
});

export default router;