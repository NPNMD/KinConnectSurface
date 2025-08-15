import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';
import type { User, NewUser, ApiResponse } from '@shared/types';

export class UserService {
  private collection = adminDb.collection(COLLECTIONS.USERS);

  // Create a new user with Firebase UID as document ID
  async createUser(userData: NewUser, firebaseUid: string): Promise<ApiResponse<User>> {
    try {
      const userRef = this.collection.doc(firebaseUid);
      const newUser: User = {
        id: firebaseUid,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await userRef.set(newUser);
      return { success: true, data: newUser };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<ApiResponse<User | null>> {
    try {
      const userDoc = await this.collection.doc(userId).get();
      
      if (!userDoc.exists) {
        return { success: true, data: null };
      }

      const userData = userDoc.data() as User;
      return { success: true, data: userData };
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: 'Failed to get user' };
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<ApiResponse<User | null>> {
    try {
      const query = await this.collection.where('email', '==', email).limit(1).get();
      
      if (query.empty) {
        return { success: true, data: null };
      }

      const userDoc = query.docs[0];
      const userData = userDoc.data() as User;
      return { success: true, data: userData };
    } catch (error) {
      console.error('Error getting user by email:', error);
      return { success: false, error: 'Failed to get user by email' };
    }
  }

  // Update user
  async updateUser(userId: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      await this.collection.doc(userId).update(updateData);
      
      // Get updated user
      const updatedUser = await this.getUserById(userId);
      if (!updatedUser.success || !updatedUser.data) {
        throw new Error('Failed to get updated user');
      }

      return { success: true, data: updatedUser.data };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  }

  // Delete user
  async deleteUser(userId: string): Promise<ApiResponse<boolean>> {
    try {
      await this.collection.doc(userId).delete();
      return { success: true, data: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  }

  // Get all users (with pagination)
  async getUsers(page: number = 1, limit: number = 20): Promise<ApiResponse<User[]>> {
    try {
      const offset = (page - 1) * limit;
      const query = await this.collection
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const users = query.docs.map(doc => doc.data() as User);
      return { success: true, data: users };
    } catch (error) {
      console.error('Error getting users:', error);
      return { success: false, error: 'Failed to get users' };
    }
  }

  // Search users
  async searchUsers(searchTerm: string): Promise<ApiResponse<User[]>> {
    try {
      // Note: Firestore doesn't support full-text search out of the box
      // This is a simple prefix search on name and email
      const nameQuery = await this.collection
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff')
        .limit(10)
        .get();

      const emailQuery = await this.collection
        .where('email', '>=', searchTerm)
        .where('email', '<=', searchTerm + '\uf8ff')
        .limit(10)
        .get();

      const users = new Map<string, User>();
      
      nameQuery.docs.forEach(doc => {
        const user = doc.data() as User;
        users.set(user.id, user);
      });

      emailQuery.docs.forEach(doc => {
        const user = doc.data() as User;
        users.set(user.id, user);
      });

      return { success: true, data: Array.from(users.values()) };
    } catch (error) {
      console.error('Error searching users:', error);
      return { success: false, error: 'Failed to search users' };
    }
  }
}

export const userService = new UserService();
