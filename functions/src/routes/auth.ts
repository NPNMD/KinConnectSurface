import * as express from 'express';
import { db, admin } from '../firebase';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Auth: profile - upsert and return a lightweight user profile compatible with the client
router.get('/profile', authenticate, async (req, res) => {
  try {
    const decoded: any = (req as any).user;
    const uid: string = decoded.uid;
    const email: string | undefined = decoded.email;
    const name: string | undefined = decoded.name;
    const picture: string | undefined = decoded.picture;

    const usersCol = db.collection('users');
    const userDocRef = usersCol.doc(uid);
    const userSnap = await userDocRef.get();

    const now = admin.firestore.Timestamp.now();

    if (!userSnap.exists) {
      const newUser = {
        id: uid,
        email: email || '',
        name: name || 'Unknown User',
        profilePicture: picture,
        userType: 'patient',
        createdAt: now,
        updatedAt: now,
      };
      await userDocRef.set(newUser, { merge: true });
      return res.json({ success: true, data: { ...newUser, createdAt: new Date(), updatedAt: new Date() } });
    }

    const data = userSnap.data() || {};
    // Ensure required fields
    const merged = {
      id: data.id || uid,
      email: data.email || email || '',
      name: data.name || name || 'Unknown User',
      profilePicture: data.profilePicture || picture,
      userType: data.userType || 'patient',
      createdAt: data.createdAt ? data.createdAt.toDate?.() || new Date() : new Date(),
      updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || new Date() : new Date(),
    };
    return res.json({ success: true, data: merged });
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

