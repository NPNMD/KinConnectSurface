import * as express from 'express';
import { db, admin } from '../firebase';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Patient profile endpoints
router.get('/profile', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const patientsRef = db.collection('patients').where('userId', '==', uid);
    const snapshot = await patientsRef.get();
    
    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: 'No patient profile found'
      });
    }
    
    const patientDoc = snapshot.docs[0];
    const patientData = {
      id: patientDoc.id,
      ...patientDoc.data(),
      createdAt: patientDoc.data().createdAt?.toDate() || new Date(),
      updatedAt: patientDoc.data().updatedAt?.toDate() || new Date(),
    };

    res.json({
      success: true,
      data: patientData,
      message: 'Patient profile retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting patient profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.post('/profile', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const profileData = {
      ...req.body,
      userId: uid,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const docRef = await db.collection('patients').add(profileData);
    const newDoc = await docRef.get();
    const newProfile = {
      id: newDoc.id,
      ...newDoc.data(),
      createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
      updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
    };

    res.status(201).json({
      success: true,
      data: newProfile,
      message: 'Patient profile created successfully'
    });
  } catch (error) {
    console.error('Error creating patient profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    
    // Find existing patient profile
    const patientsRef = db.collection('patients').where('userId', '==', uid);
    const snapshot = await patientsRef.get();
    
    if (snapshot.empty) {
      // If no patient profile exists, create one instead of returning 404
      const patientData = {
        ...req.body,
        userId: uid,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const docRef = await db.collection('patients').add(patientData);
      const newDoc = await docRef.get();
      const newProfile = {
        id: newDoc.id,
        ...newDoc.data(),
        createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
        updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
      };

      return res.status(201).json({
        success: true,
        data: newProfile,
        message: 'Patient profile created successfully'
      });
    }
    
    const patientDoc = snapshot.docs[0];
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await patientDoc.ref.update(updateData);
    const updatedDoc = await patientDoc.ref.get();
    const updatedProfile = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate() || new Date(),
      updatedAt: updatedDoc.data()?.updatedAt?.toDate() || new Date(),
    };

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Patient profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;

