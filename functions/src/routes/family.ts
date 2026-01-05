import * as express from 'express';
import { db } from '../firebase';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get user's family group
router.get('/group', authenticate, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    
    // Get user's family group ID
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const familyGroupId = userData?.familyGroupId;
    
    if (!familyGroupId) {
      return res.json({
        success: true,
        data: null,
        message: 'User is not part of any family group'
      });
    }
    
    // Get family group details
    const familyGroupDoc = await db.collection('familyGroups').doc(familyGroupId).get();
    
    if (!familyGroupDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Family group not found'
      });
    }
    
    const familyGroupData = familyGroupDoc.data();
    
    res.json({
      success: true,
      data: {
        id: familyGroupDoc.id,
        ...familyGroupData,
        createdAt: familyGroupData?.createdAt?.toDate(),
        updatedAt: familyGroupData?.updatedAt?.toDate(),
        members: familyGroupData?.members?.map((member: any) => ({
          ...member,
          joinedAt: member.joinedAt?.toDate(),
        })),
      },
      message: 'Family group retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting family group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get family group'
    });
  }
});

export default router;

