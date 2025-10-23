import express from 'express';
import { adminDb } from '../firebase-admin';

const router = express.Router();

// Middleware to verify Firebase auth token
const verifyAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminDb.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid token'
    });
  }
};

// Complete onboarding endpoint
router.post('/complete-onboarding', verifyAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { completedAt, skipped } = req.body;

    console.log(`📝 Marking onboarding as ${skipped ? 'skipped' : 'complete'} for user:`, userId);

    // Update user document in Firestore
    await adminDb.firestore().collection('users').doc(userId).update({
      hasCompletedOnboarding: true,
      onboardingCompletedAt: completedAt || new Date().toISOString(),
      onboardingSkipped: skipped || false,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Onboarding status updated successfully');

    res.json({
      success: true,
      message: skipped ? 'Onboarding skipped successfully' : 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('❌ Error updating onboarding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update onboarding status'
    });
  }
});

// Get user profile endpoint
router.get('/profile', verifyAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;

    const userDoc = await adminDb.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();
    
    res.json({
      success: true,
      data: {
        id: userDoc.id,
        ...userData
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

export default router;