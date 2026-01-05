import * as express from 'express';
import { db, admin } from '../firebase';
import { authenticate } from '../middleware/auth';
import { emailService } from '../emails/emailService';

const router = express.Router();
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Patient invitation endpoints
router.post('/send', authenticate, async (req, res) => {
  try {
    const { email, patientName, message } = req.body;
    const inviterUid = (req as any).user.uid;
    
    if (!email || !patientName) {
      return res.status(400).json({
        success: false,
        error: 'Email and patient name are required'
      });
    }

    // Get inviter information
    const inviterDoc = await db.collection('users').doc(inviterUid).get();
    const inviterData = inviterDoc.data();
    const inviterName = inviterData?.name || 'A family member';

    // Create invitation record
    const invitationData = {
      inviterUid,
      inviterName,
      inviterEmail: inviterData?.email || '',
      patientEmail: email,
      patientName,
      message: message || '',
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
    };

    const invitationRef = await db.collection('invitations').add(invitationData);
    const invitationId = invitationRef.id;

    // Send email invitation
    await emailService.sendInvitation({
      to: email,
      patientName,
      inviterName,
      invitationLink: `${APP_URL}/invitation/${invitationId}`,
      message
    });

    res.status(201).json({
      success: true,
      data: { invitationId, ...invitationData },
      message: 'Invitation sent successfully'
    });

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation'
    });
  }
});

// Get invitation details
router.get('/:invitationId', async (req, res) => {
  try {
    const { invitationId } = req.params;
    
    const invitationDoc = await db.collection('invitations').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    const invitationData = invitationDoc.data();
    
    // Check if invitation has expired
    const now = new Date();
    const expiresAt = invitationData?.expiresAt?.toDate();
    
    if (expiresAt && now > expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Invitation has expired'
      });
    }

    // Check if invitation is already accepted
    if (invitationData?.status === 'accepted') {
      return res.status(410).json({
        success: false,
        error: 'Invitation has already been accepted'
      });
    }

    res.json({
      success: true,
      data: {
        id: invitationId,
        ...invitationData,
        createdAt: invitationData?.createdAt?.toDate(),
        expiresAt: invitationData?.expiresAt?.toDate(),
      }
    });

  } catch (error) {
    console.error('Error getting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitation'
    });
  }
});

// Accept invitation
router.post('/:invitationId/accept', authenticate, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const accepterUid = (req as any).user.uid;
    
    const invitationDoc = await db.collection('invitations').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    const invitationData = invitationDoc.data();
    
    // Check if invitation has expired
    const now = new Date();
    const expiresAt = invitationData?.expiresAt?.toDate();
    
    if (expiresAt && now > expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Invitation has expired'
      });
    }

    // Check if invitation is already accepted
    if (invitationData?.status === 'accepted') {
      return res.status(410).json({
        success: false,
        error: 'Invitation has already been accepted'
      });
    }

    // Update invitation status
    await db.collection('invitations').doc(invitationId).update({
      status: 'accepted',
      acceptedBy: accepterUid,
      acceptedAt: admin.firestore.Timestamp.now(),
    });

    // Create or update family group
    const inviterUid = invitationData?.inviterUid;
    if (inviterUid) {
      // Check if inviter already has a family group
      const familyGroupQuery = await db.collection('familyGroups')
        .where('createdBy', '==', inviterUid)
        .limit(1)
        .get();

      let familyGroupId: string;

      if (familyGroupQuery.empty) {
        // Create new family group
        const familyGroupData = {
          createdBy: inviterUid,
          name: `${invitationData?.inviterName}'s Family`,
          members: [
            {
              uid: inviterUid,
              email: invitationData?.inviterEmail,
              name: invitationData?.inviterName,
              role: 'admin',
              joinedAt: admin.firestore.Timestamp.now(),
            },
            {
              uid: accepterUid,
              email: invitationData?.patientEmail,
              name: invitationData?.patientName,
              role: 'member',
              joinedAt: admin.firestore.Timestamp.now(),
            }
          ],
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        };

        const familyGroupRef = await db.collection('familyGroups').add(familyGroupData);
        familyGroupId = familyGroupRef.id;
      } else {
        // Add to existing family group
        const familyGroupDoc = familyGroupQuery.docs[0];
        familyGroupId = familyGroupDoc.id;
        const familyGroupData = familyGroupDoc.data();

        // Check if user is already a member
        const existingMember = familyGroupData.members?.find((member: any) => member.uid === accepterUid);
        
        if (!existingMember) {
          const newMember = {
            uid: accepterUid,
            email: invitationData?.patientEmail,
            name: invitationData?.patientName,
            role: 'member',
            joinedAt: admin.firestore.Timestamp.now(),
          };

          await db.collection('familyGroups').doc(familyGroupId).update({
            members: admin.firestore.FieldValue.arrayUnion(newMember),
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
      }

      // Update user profiles with family group reference
      await db.collection('users').doc(accepterUid).update({
        familyGroupId: familyGroupId,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Ensure inviter also has family group reference
      await db.collection('users').doc(inviterUid).update({
        familyGroupId: familyGroupId,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    res.json({
      success: true,
      message: 'Invitation accepted successfully and family group updated'
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation'
    });
  }
});

// Get user's sent invitations
router.get('/sent', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    
    const invitationsRef = db.collection('invitations')
      .where('inviterUid', '==', uid)
      .orderBy('createdAt', 'desc');
    
    const snapshot = await invitationsRef.get();
    
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
      acceptedAt: doc.data().acceptedAt?.toDate(),
    }));

    res.json({
      success: true,
      data: invitations,
      message: 'Sent invitations retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting sent invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sent invitations'
    });
  }
});

export default router;

