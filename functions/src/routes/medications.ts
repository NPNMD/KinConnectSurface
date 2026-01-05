import * as express from 'express';
import { db, admin } from '../firebase';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Medication CRUD operations
router.get('/', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const medicationsRef = db.collection('medications').where('patientId', '==', uid);
    const snapshot = await medicationsRef.get();
    
    const medications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      prescribedDate: doc.data().prescribedDate?.toDate() || new Date(),
      startDate: doc.data().startDate?.toDate(),
      endDate: doc.data().endDate?.toDate(),
    }));

    res.json({
      success: true,
      data: medications,
      message: 'Medications retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const medicationData = {
      ...req.body,
      patientId: uid,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      prescribedDate: req.body.prescribedDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.prescribedDate)) : admin.firestore.Timestamp.now(),
      startDate: req.body.startDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.startDate)) : null,
      endDate: req.body.endDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.endDate)) : null,
    };

    const docRef = await db.collection('medications').add(medicationData);
    const newDoc = await docRef.get();
    const newMedication = {
      id: newDoc.id,
      ...newDoc.data(),
      createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
      updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
      prescribedDate: newDoc.data()?.prescribedDate?.toDate() || new Date(),
      startDate: newDoc.data()?.startDate?.toDate(),
      endDate: newDoc.data()?.endDate?.toDate(),
    };

    res.status(201).json({
      success: true,
      data: newMedication,
      message: 'Medication created successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { id } = req.params;
    
    const docRef = db.collection('medications').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data()?.patientId !== uid) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now(),
      prescribedDate: req.body.prescribedDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.prescribedDate)) : undefined,
      startDate: req.body.startDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.startDate)) : undefined,
      endDate: req.body.endDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.endDate)) : undefined,
    };

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const updatedMedication = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate() || new Date(),
      updatedAt: updatedDoc.data()?.updatedAt?.toDate() || new Date(),
      prescribedDate: updatedDoc.data()?.prescribedDate?.toDate() || new Date(),
      startDate: updatedDoc.data()?.startDate?.toDate(),
      endDate: updatedDoc.data()?.endDate?.toDate(),
    };

    res.json({
      success: true,
      data: updatedMedication,
      message: 'Medication updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { id } = req.params;
    
    const docRef = db.collection('medications').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data()?.patientId !== uid) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    await docRef.delete();

    res.json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Medication Reminders
router.get('/:medicationId/reminders', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { medicationId } = req.params;

    // Verify medication ownership
    const medDoc = await db.collection('medications').doc(medicationId).get();
    if (!medDoc.exists || medDoc.data()?.patientId !== uid) {
      return res.status(404).json({ success: false, error: 'Medication not found' });
    }

    const remindersRef = db.collection('medicationReminders').where('medicationId', '==', medicationId);
    const snapshot = await remindersRef.get();

    const reminders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    }));

    res.json({
      success: true,
      data: reminders,
      message: 'Reminders retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting reminders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/:medicationId/reminders', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { medicationId } = req.params;

    // Verify medication ownership
    const medDoc = await db.collection('medications').doc(medicationId).get();
    if (!medDoc.exists || medDoc.data()?.patientId !== uid) {
      return res.status(404).json({ success: false, error: 'Medication not found' });
    }

    const reminderData = {
      ...req.body,
      medicationId,
      patientId: uid,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    const docRef = await db.collection('medicationReminders').add(reminderData);
    const newDoc = await docRef.get();

    res.status(201).json({
      success: true,
      data: {
        id: newDoc.id,
        ...newDoc.data(),
        createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
        updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
      },
      message: 'Reminder created successfully'
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/reminders/:reminderId', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { reminderId } = req.params;

    const docRef = db.collection('medicationReminders').doc(reminderId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.patientId !== uid) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now()
    };

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: updatedDoc.data()?.createdAt?.toDate() || new Date(),
        updatedAt: updatedDoc.data()?.updatedAt?.toDate() || new Date(),
      },
      message: 'Reminder updated successfully'
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/reminders/:reminderId', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { reminderId } = req.params;

    const docRef = db.collection('medicationReminders').doc(reminderId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.patientId !== uid) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    await docRef.delete();

    res.json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

