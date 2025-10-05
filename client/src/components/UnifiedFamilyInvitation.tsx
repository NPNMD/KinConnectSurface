import React, { useState } from 'react';
import { Users, Shield, Mail, Phone, Settings, Plus, X, AlertCircle, Check } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import AccessLevelSelector from './AccessLevelSelector';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, type ApiResponse, API_ENDPOINTS } from '@/lib/api';
import type { FamilyAccessLevel, FamilyPermission } from '@shared/types';

interface UnifiedFamilyInvitationProps {
  mode?: 'simple' | 'advanced';
  onInvitationSent?: () => void;
  onClose?: () => void;
  patientId?: string;
}

const ACCESS_LEVELS: { value: FamilyAccessLevel; label: string; description: string }[] = [
  { value: 'full', label: 'Full Access', description: 'Can view, create, and edit all medical information' },
  { value: 'limited', label: 'Limited Access', description: 'Can view and create appointments, limited medical info' },
  { value: 'view_only', label: 'View Only', description: 'Can only view basic appointment information' },
  { value: 'emergency_only', label: 'Emergency Only', description: 'Only receives emergency notifications' }
];

const PERMISSIONS: { value: FamilyPermission; label: string; description: string }[] = [
  { value: 'view_appointments', label: 'View Appointments', description: 'See scheduled medical appointments' },
  { value: 'create_appointments', label: 'Create Appointments', description: 'Schedule new medical appointments' },
  { value: 'edit_appointments', label: 'Edit Appointments', description: 'Modify existing appointments' },
  { value: 'cancel_appointments', label: 'Cancel Appointments', description: 'Cancel scheduled appointments' },
  { value: 'view_medical_records', label: 'View Medical Records', description: 'Access medical history and records' },
  { value: 'manage_medications', label: 'Manage Medications', description: 'View and update medication information' },
  { value: 'receive_notifications', label: 'Receive Notifications', description: 'Get appointment and medical reminders' },
  { value: 'emergency_contact', label: 'Emergency Contact', description: 'Receive emergency medical notifications' }
];

const RELATIONSHIPS = [
  'spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 
  'aunt_uncle', 'cousin', 'friend', 'caregiver', 'other'
];

// Default permission sets for different access levels
const DEFAULT_PERMISSIONS: Record<FamilyAccessLevel, FamilyPermission[]> = {
  full: ['view_appointments', 'create_appointments', 'edit_appointments', 'cancel_appointments', 'view_medical_records', 'manage_medications', 'receive_notifications'],
  limited: ['view_appointments', 'create_appointments', 'receive_notifications'],
  view_only: ['view_appointments', 'receive_notifications'],
  emergency_only: ['emergency_contact', 'receive_notifications']
};

export const UnifiedFamilyInvitation: React.FC<UnifiedFamilyInvitationProps> = ({ 
  mode = 'simple', 
  onInvitationSent, 
  onClose,
  patientId 
}) => {
  const { firebaseUser, isAuthenticated } = useAuth();
  const [currentMode, setCurrentMode] = useState<'simple' | 'advanced'>(mode);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    message: '',
    phone: '',
    relationship: 'spouse' as string,
    accessLevel: 'view_only' as 'full' | 'view_only', // Phase 1: Only full and view_only
    permissions: ['view_appointments', 'receive_notifications'] as FamilyPermission[],
    isEmergencyContact: false,
    preferredContactMethod: 'email' as 'email' | 'phone' | 'sms'
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDuplicateError, setIsDuplicateError] = useState(false);

  // Update permissions when access level changes
  const handleAccessLevelChange = (newAccessLevel: FamilyAccessLevel) => {
    // For Phase 1, only allow 'full' and 'view_only'
    const allowedLevel = (newAccessLevel === 'full' || newAccessLevel === 'view_only')
      ? newAccessLevel
      : 'view_only';
    
    setFormData(prev => ({
      ...prev,
      accessLevel: allowedLevel,
      permissions: DEFAULT_PERMISSIONS[newAccessLevel]
    }));
  };

  const handlePermissionToggle = (permission: FamilyPermission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setIsDuplicateError(false);

    try {
      // Check authentication first
      if (!isAuthenticated || !firebaseUser) {
        throw new Error('Please sign in to send invitations');
      }

      console.log('🚀 Sending unified invitation request:', formData);

      // Prepare invitation data based on mode
      const invitationData = currentMode === 'simple'
        ? {
            // Simple mode - email, name, message, and access level
            email: formData.email,
            patientName: formData.name,
            message: formData.message,
            accessLevel: formData.accessLevel // Phase 1: Include access level
          }
        : {
            // Advanced mode - full permission data
            email: formData.email,
            patientName: formData.name,
            message: formData.message,
            phone: formData.phone,
            relationship: formData.relationship,
            accessLevel: formData.accessLevel,
            permissions: formData.permissions,
            isEmergencyContact: formData.isEmergencyContact,
            preferredContactMethod: formData.preferredContactMethod
          };

      const result = await apiClient.post<ApiResponse<any>>(API_ENDPOINTS.SEND_INVITATION, invitationData);
      console.log('📨 Invitation response:', result);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send invitation';
        console.error('❌ Invitation failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('✅ Invitation sent successfully!');
      setSuccess('Invitation sent successfully! The family member will receive an email shortly.');
      
      // Reset form
      setFormData({
        email: '',
        name: '',
        message: '',
        phone: '',
        relationship: 'spouse',
        accessLevel: 'view_only', // Phase 1: Default to view_only
        permissions: ['view_appointments', 'receive_notifications'],
        isEmergencyContact: false,
        preferredContactMethod: 'email'
      });
      
      onInvitationSent?.();

    } catch (err: any) {
      console.error('❌ Invitation error:', err);
      
      // Handle specific error types for better user experience
      let errorMessage = err?.message || err?.details || 'Failed to send invitation';
      
      // Check for 409 duplicate invitation error
      if (errorMessage.includes('already pending') || errorMessage.includes('409') || err?.status === 409 || err?.statusCode === 409) {
        setIsDuplicateError(true);
        setError('An invitation is already pending for this email address. The invitation will expire in 7 days if not accepted.');
      } else if (errorMessage.includes('already has active access')) {
        setError('This family member already has access to your medical calendar. Check your Family Access settings.');
      } else if (errorMessage.includes('cannot invite yourself')) {
        setError('You cannot invite yourself to your own medical calendar. Please use a different email address.');
      } else if (errorMessage.includes('Invalid email format')) {
        setError('Please enter a valid email address.');
      } else if (errorMessage.includes('Email and patient name are required')) {
        setError('Please fill in both the email address and family member name.');
      } else if (errorMessage.includes('Authentication required') || errorMessage.includes('sign in')) {
        setError('Please sign in to send invitations to family members.');
      } else if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        setError('Network error - please check your internet connection and try again.');
      } else if (errorMessage.includes('Too many requests')) {
        setError('Too many requests - please wait a moment and try again.');
      } else if (errorMessage.includes('Service temporarily unavailable') || errorMessage.includes('Circuit breaker')) {
        setError('Service temporarily unavailable - please try again in a few moments.');
      } else {
        // Generic error with more helpful context
        setError(`Unable to send invitation: ${errorMessage}. Please try again or contact support if the problem persists.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invite Family Member</h2>
            <p className="text-sm text-gray-600">
              {currentMode === 'simple' 
                ? 'Send a basic invitation to help manage your medical care'
                : 'Configure detailed access permissions for family member'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Mode Toggle */}
          <div className="flex rounded-md border border-gray-200">
            <button
              type="button"
              onClick={() => setCurrentMode('simple')}
              className={`px-3 py-1 text-sm font-medium transition-colors rounded-l-md ${
                currentMode === 'simple'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('advanced')}
              className={`px-3 py-1 text-sm font-medium transition-colors rounded-r-md ${
                currentMode === 'advanced'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Advanced
            </button>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md mb-4">
          <p className="text-sm">Please sign in to send invitations to family members.</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information - Always shown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Family Member Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="family.member@example.com"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Family Member Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Smith"
            />
          </div>
        </div>

        {/* Access Level Selector - Always shown in simple mode, part of advanced mode */}
        {currentMode === 'simple' && (
          <AccessLevelSelector
            selectedLevel={formData.accessLevel}
            onChange={(level) => setFormData(prev => ({ ...prev, accessLevel: level }))}
            disabled={isLoading}
          />
        )}

        {/* Advanced Fields - Only shown in advanced mode */}
        {currentMode === 'advanced' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1-555-0123"
                />
              </div>

              <div>
                <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <select
                  id="relationship"
                  name="relationship"
                  value={formData.relationship}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {RELATIONSHIPS.map(rel => (
                    <option key={rel} value={rel}>
                      {rel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="accessLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Access Level
                </label>
                <select
                  id="accessLevel"
                  name="accessLevel"
                  value={formData.accessLevel}
                  onChange={(e) => handleAccessLevelChange(e.target.value as FamilyAccessLevel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ACCESS_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {ACCESS_LEVELS.find(l => l.value === formData.accessLevel)?.description}
                </p>
              </div>

              <div>
                <label htmlFor="preferredContactMethod" className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Contact
                </label>
                <select
                  id="preferredContactMethod"
                  name="preferredContactMethod"
                  value={formData.preferredContactMethod}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>

            {/* Permissions Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specific Permissions
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                {PERMISSIONS.map(permission => (
                  <div key={permission.value} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id={permission.value}
                      checked={formData.permissions.includes(permission.value)}
                      onChange={() => handlePermissionToggle(permission.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                    />
                    <div>
                      <label htmlFor={permission.value} className="text-sm font-medium text-gray-700">
                        {permission.label}
                      </label>
                      <p className="text-xs text-gray-500">{permission.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isEmergencyContact"
                name="isEmergencyContact"
                checked={formData.isEmergencyContact}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isEmergencyContact" className="text-sm text-gray-700">
                Emergency contact (will receive urgent medical notifications)
              </label>
            </div>
          </>
        )}

        {/* Message - Always shown */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Personal Message (Optional)
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add a personal message to the invitation..."
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className={`border px-4 py-3 rounded-md ${
            isDuplicateError
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-start">
              <div className="flex-1">
                <p className="font-medium mb-1">
                  {isDuplicateError ? 'Invitation Already Pending' : 'Invitation Failed'}
                </p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
            {isDuplicateError && (
              <div className="mt-3 pt-3 border-t border-yellow-200">
                <p className="text-sm font-medium mb-2">What you can do:</p>
                <ul className="text-sm space-y-1">
                  <li>• Wait for them to check their email and accept the invitation</li>
                  <li>• Ask them to check their spam/junk folder</li>
                  <li>• The invitation will automatically expire in 7 days</li>
                  <li>• Contact support if you need to cancel the pending invitation</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5" />
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !formData.email || !formData.name || !isAuthenticated}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Sending Invitation...</span>
              </>
            ) : (
              'Send Invitation'
            )}
          </button>
        </div>
      </form>

      {/* Information Section */}
      <div className="mt-6 text-sm text-gray-600">
        <p>Your family member will receive an email invitation to help manage your medical care on KinConnect.</p>
        {currentMode === 'advanced' && (
          <p className="mt-2">
            <strong>Access Level:</strong> {ACCESS_LEVELS.find(l => l.value === formData.accessLevel)?.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default UnifiedFamilyInvitation;