import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { adminDb } from '../firebase-admin';
import type {
  MedicalEvent,
  NewMedicalEvent,
  DeleteMedicalEventRequest,
  DeleteMedicalEventResponse,
  DeletedMedicalEvent
} from '@shared/types';

const router = Router();

/**
 * GET /medical-events/:patientId
 * Get all medical events for a patient
 */
router.get('/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user!.uid;

    console.log('📅 Fetching medical events for patient:', patientId);

    // TODO: Add permission check - verify user has access to this patient's data

    const eventsSnapshot = await adminDb
      .collection('medical_events')
      .where('patientId', '==', patientId)
      .where('status', '!=', 'cancelled')
      .orderBy('status')
      .orderBy('startDateTime', 'asc')
      .get();

    const events: MedicalEvent[] = eventsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      startDateTime: doc.data().startDateTime?.toDate() || new Date(),
      endDateTime: doc.data().endDateTime?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as MedicalEvent[];

    console.log('✅ Found', events.length, 'medical events');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('❌ Error fetching medical events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical events'
    });
  }
});

/**
 * POST /medical-events
 * Create a new medical event
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const eventData: NewMedicalEvent = req.body;

    console.log('📅 Creating new medical event for patient:', eventData.patientId);

    // TODO: Add permission check - verify user can create events for this patient

    const newEvent: Omit<MedicalEvent, 'id'> = {
      ...eventData,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    const docRef = await adminDb.collection('medical_events').add(newEvent);

    const createdEvent: MedicalEvent = {
      id: docRef.id,
      ...newEvent
    };

    console.log('✅ Medical event created:', docRef.id);

    res.status(201).json({
      success: true,
      data: createdEvent
    });
  } catch (error) {
    console.error('❌ Error creating medical event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create medical event'
    });
  }
});

/**
 * PUT /medical-events/:eventId
 * Update an existing medical event
 */
router.put('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    const updates = req.body;

    console.log('📅 Updating medical event:', eventId);

    const eventDoc = await adminDb.collection('medical_events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Medical event not found'
      });
    }

    const event = eventDoc.data() as MedicalEvent;

    // TODO: Add permission check - verify user can edit this event

    const updatedData = {
      ...updates,
      updatedBy: userId,
      updatedAt: new Date(),
      version: (event.version || 1) + 1
    };

    await eventDoc.ref.update(updatedData);

    console.log('✅ Medical event updated:', eventId);

    res.json({
      success: true,
      data: {
        ...event,
        ...updatedData,
        id: eventId
      }
    });
  } catch (error) {
    console.error('❌ Error updating medical event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medical event'
    });
  }
});

/**
 * DELETE /medical-events/:eventId
 * Delete a medical event with audit trail
 */
router.delete('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.uid;
    const { scope = 'single', reason, notifyFamily = false } = req.body as Partial<DeleteMedicalEventRequest>;

    console.log('🗑️ Deleting medical event:', { eventId, scope, userId });

    const eventDoc = await adminDb.collection('medical_events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Medical event not found',
        deletedCount: 0,
        affectedEventIds: []
      } as DeleteMedicalEventResponse);
    }

    const event = eventDoc.data() as MedicalEvent;

    // TODO: Add permission check - verify user can delete this event

    const affectedEventIds: string[] = [];
    let deletedCount = 0;

    // Handle recurring event deletion
    if (event.isRecurring && event.parentEventId) {
      switch (scope) {
        case 'single':
          // Delete only this instance
          affectedEventIds.push(eventId);
          break;

        case 'future':
          // Delete this and all future instances
          const futureEventsSnapshot = await adminDb
            .collection('medical_events')
            .where('parentEventId', '==', event.parentEventId)
            .where('startDateTime', '>=', event.startDateTime)
            .get();

          futureEventsSnapshot.docs.forEach((doc: any) => {
            affectedEventIds.push(doc.id);
          });
          break;

        case 'all':
          // Delete all instances including parent
          const allEventsSnapshot = await adminDb
            .collection('medical_events')
            .where('parentEventId', '==', event.parentEventId)
            .get();

          allEventsSnapshot.docs.forEach((doc: any) => {
            affectedEventIds.push(doc.id);
          });

          // Also delete parent event if it exists
          if (event.parentEventId) {
            affectedEventIds.push(event.parentEventId);
          }
          break;
      }
    } else {
      // Non-recurring event - just delete this one
      affectedEventIds.push(eventId);
    }

    // Create audit trail entries and delete events
    const batch = adminDb.batch();

    for (const id of affectedEventIds) {
      const eventToDelete = await adminDb.collection('medical_events').doc(id).get();
      
      if (eventToDelete.exists) {
        const eventData = eventToDelete.data() as MedicalEvent;

        // Create audit trail entry
        const deletedEvent: Omit<DeletedMedicalEvent, 'id'> = {
          originalEventId: id,
          patientId: eventData.patientId,
          eventData: {
            ...eventData,
            id
          },
          deletionScope: scope || 'single',
          deletionReason: reason,
          deletedBy: userId,
          deletedAt: new Date(),
          familyNotified: notifyFamily || false,
          relatedEventIds: affectedEventIds.filter(aid => aid !== id)
        };

        const auditRef = adminDb.collection('deleted_medical_events').doc();
        batch.set(auditRef, deletedEvent);

        // Delete the event
        batch.delete(eventToDelete.ref);
        deletedCount++;
      }
    }

    // Commit all deletions
    await batch.commit();

    console.log('✅ Deleted', deletedCount, 'medical event(s)');

    // TODO: Send family notifications if notifyFamily is true

    const response: DeleteMedicalEventResponse = {
      success: true,
      deletedCount,
      affectedEventIds,
      message: `Successfully deleted ${deletedCount} event(s)`
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error deleting medical event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete medical event',
      deletedCount: 0,
      affectedEventIds: []
    } as DeleteMedicalEventResponse);
  }
});

export default router;