import { Router } from 'express';
import { userService } from '../services/userService';
import { authenticateToken } from '../middleware/auth';
import type { NewUser } from '@shared/types';

const router = Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Auth Profile Request - User UID:', req.user!.uid);
    console.log('🔍 Auth Profile Request - User Info:', {
      email: req.user!.email,
      name: req.user!.name,
      picture: req.user!.picture
    });
    
    const user = await userService.getUserById(req.user!.uid);
    console.log('🔍 User lookup result:', user);
    
    if (!user.success) {
      console.error('❌ User lookup failed:', user.error);
      return res.status(500).json(user);
    }

    if (!user.data) {
      console.log('👤 User not found in database, creating new user...');
      // User doesn't exist in our database, create them
      const newUserData: NewUser = {
        email: req.user!.email,
        name: req.user!.name || 'Unknown User',
        profilePicture: req.user!.picture,
        userType: 'patient', // Default user type
      };

      console.log('👤 Creating user with data:', newUserData);
      const createdUser = await userService.createUser(newUserData, req.user!.uid);
      console.log('👤 User creation result:', createdUser);
      
      if (!createdUser.success) {
        console.error('❌ User creation failed:', createdUser.error);
        return res.status(500).json(createdUser);
      }

      console.log('✅ New user created successfully');
      return res.json(createdUser);
    }

    console.log('✅ Existing user found, returning profile');
    res.json(user);
  } catch (error) {
    console.error('💥 Error getting user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await userService.updateUser(req.user!.uid, updates);
    
    if (!updatedUser.success) {
      return res.status(500).json(updatedUser);
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const deletedUser = await userService.deleteUser(req.user!.uid);
    
    if (!deletedUser.success) {
      return res.status(500).json(deletedUser);
    }

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Search users (for family group invitations)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Search term is required' 
      });
    }

    const users = await userService.searchUsers(searchTerm);
    
    if (!users.success) {
      return res.status(500).json(users);
    }

    // Filter out the current user; default to empty list if no data
    const filteredUsers = (users.data ?? []).filter(user => user.id !== req.user!.uid);
    
    res.json({ 
      success: true, 
      data: filteredUsers 
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
