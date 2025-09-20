import React, { useState, useEffect } from 'react';
import { Users, Shield, Mail, Phone, Settings, Plus, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';
import type { FamilyMember, FamilyAccessLevel, FamilyPermission } from '@shared/types';
import { apiClient, API_ENDPOINTS } from '../lib/api';

interface FamilyAccessControlsProps {
  patientId: string;
  onClose?: () => void;
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

export default function FamilyAccessControls({ patientId, onClose }: FamilyAccessControlsProps) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: 'spouse' as string,
    accessLevel: 'limited' as FamilyAccessLevel,
    permissions: ['view_appointments', 'receive_notifications'] as FamilyPermission[],
    isEmergencyContact: false,
    preferredContactMethod: 'email' as 'email' | 'phone' | 'sms'
  });

  useEffect(() => {
    loadFamilyMembers();
  }, [patientId]);

  // Listen for family member added events
  useEffect(() => {
    const handleFamilyMemberAdded = (event: CustomEvent) => {
      console.log('🎉 Family member added event received:', event.detail);
      // Refresh the family members list
      loadFamilyMembers();
    };

    window.addEventListener('familyMemberAdded', handleFamilyMemberAdded as EventListener);
    
    return () => {
      window.removeEventListener('familyMemberAdded', handleFamilyMemberAdded as EventListener);
    };
  }, []);

  const loadFamilyMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<{ success: boolean; data: any }>(API_ENDPOINTS.FAMILY_ACCESS);
      if (response.success && response.data) {
        // Convert family access data to family members format
        const members: FamilyMember[] = [
          ...(response.data.familyMembersWithAccessToMe || []).map((access: any) => ({
            id: access.id,
            patientId: patientId,
            userId: access.familyMemberId,
            name: access.familyMemberName,
            email: access.familyMemberEmail,
            phone: '',
            relationship: 'family_member',
            accessLevel: access.accessLevel,
            permissions: Object.keys(access.permissions || {}).filter(key => access.permissions[key]),
            isEmergencyContact: false,
            canReceiveNotifications: access.permissions?.canReceiveNotifications || false,
            preferredContactMethod: 'email' as const,
            invitationStatus: 'accepted' as const,
            invitedAt: new Date(access.acceptedAt || Date.now()),
            acceptedAt: new Date(access.acceptedAt || Date.now()),
            createdAt: new Date(access.acceptedAt || Date.now()),
            updatedAt: new Date(access.acceptedAt || Date.now())
          }))
        ];
        setFamilyMembers(members);
      }
    } catch (err) {
      console.error('Error loading family members:', err);
      setError('Failed to load family members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAccessLevelColor = (level: FamilyAccessLevel) => {
    switch (level) {
      case 'full': return 'bg-green-100 text-green-800 border-green-200';
      case 'limited': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'view_only': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'emergency_only': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpdateMember = (member: FamilyMember, updates: Partial<FamilyMember>) => {
    setFamilyMembers(prev => prev.map(m => 
      m.id === member.id 
        ? { ...m, ...updates, updatedAt: new Date() }
        : m
    ));
    setEditingMember(null);
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this family member? This action cannot be undone.')) {
      setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const handleSendInvite = async () => {
    if (!newInvite.name || !newInvite.email) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await apiClient.post<{ success: boolean; data: any }>(API_ENDPOINTS.SEND_INVITATION, {
        email: newInvite.email,
        patientName: newInvite.name
      });

      if (response.success) {
        // Reset form
        setNewInvite({
          name: '',
          email: '',
          phone: '',
          relationship: 'spouse',
          accessLevel: 'limited',
          permissions: ['view_appointments', 'receive_notifications'],
          isEmergencyContact: false,
          preferredContactMethod: 'email'
        });
        setShowInviteForm(false);

        // Reload family members to show the new invitation
        await loadFamilyMembers();
        
        alert('Invitation sent successfully!');
      } else {
        alert('Failed to send invitation. Please try again.');
      }
    } catch (err) {
      console.error('Error sending invitation:', err);
      alert('Failed to send invitation. Please try again.');
    }
  };

  const handleResendInvite = (member: FamilyMember) => {
    setFamilyMembers(prev => prev.map(m => 
      m.id === member.id 
        ? { ...m, invitedAt: new Date(), updatedAt: new Date() }
        : m
    ));
    console.log('Invitation resent to:', member.email);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Family Access Controls</h3>
            <p className="text-sm text-gray-600">Manage who can access and modify medical information</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowInviteForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Invite Family Member</span>
          </button>
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

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Invite Family Member</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                type="text"
                value={newInvite.name}
                onChange={(e) => setNewInvite(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="label">Email Address *</label>
              <input
                type="email"
                value={newInvite.email}
                onChange={(e) => setNewInvite(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                value={newInvite.phone}
                onChange={(e) => setNewInvite(prev => ({ ...prev, phone: e.target.value }))}
                className="input"
                placeholder="+1-555-0123"
              />
            </div>

            <div>
              <label className="label">Relationship</label>
              <select
                value={newInvite.relationship}
                onChange={(e) => setNewInvite(prev => ({ ...prev, relationship: e.target.value }))}
                className="input"
              >
                {RELATIONSHIPS.map(rel => (
                  <option key={rel} value={rel}>
                    {rel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Access Level</label>
              <select
                value={newInvite.accessLevel}
                onChange={(e) => setNewInvite(prev => ({ ...prev, accessLevel: e.target.value as FamilyAccessLevel }))}
                className="input"
              >
                {ACCESS_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Preferred Contact</label>
              <select
                value={newInvite.preferredContactMethod}
                onChange={(e) => setNewInvite(prev => ({ ...prev, preferredContactMethod: e.target.value as 'email' | 'phone' | 'sms' }))}
                className="input"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isEmergencyContact"
                  checked={newInvite.isEmergencyContact}
                  onChange={(e) => setNewInvite(prev => ({ ...prev, isEmergencyContact: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isEmergencyContact" className="text-sm text-gray-700">
                  Emergency contact (will receive urgent medical notifications)
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowInviteForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvite}
              className="btn-primary"
            >
              Send Invitation
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading family members...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={loadFamilyMembers}
            className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Family Members List */}
      {!loading && !error && (
        <div className="space-y-4">
          {familyMembers.map((member) => (
          <div
            key={member.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="font-medium text-gray-900">{member.name}</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(member.accessLevel)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {ACCESS_LEVELS.find(l => l.value === member.accessLevel)?.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getInvitationStatusColor(member.invitationStatus)}`}>
                    {member.invitationStatus === 'accepted' && <Check className="w-3 h-3 mr-1" />}
                    {member.invitationStatus.charAt(0).toUpperCase() + member.invitationStatus.slice(1)}
                  </span>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <span className="font-medium">Relationship:</span> {member.relationship.replace(/_/g, ' ')}
                    {member.isEmergencyContact && (
                      <span className="ml-2 text-red-600 font-medium">• Emergency Contact</span>
                    )}
                  </div>
                  
                  <div>
                    <span className="font-medium">Permissions:</span> {member.permissions.length} granted
                  </div>
                  
                  {member.invitationStatus === 'pending' && (
                    <div className="text-yellow-600">
                      Invitation sent {member.invitedAt.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {member.invitationStatus === 'pending' && (
                  <button
                    onClick={() => handleResendInvite(member)}
                    className="text-blue-600 hover:text-blue-700 p-1"
                    title="Resend invitation"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditingMember(member)}
                  className="text-gray-600 hover:text-gray-700 p-1"
                  title="Edit permissions"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Remove family member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          ))}
        </div>
      )}

      {!loading && !error && familyMembers.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No family members added</h4>
          <p className="text-gray-500 mb-4">
            Invite family members to help coordinate medical care and appointments.
          </p>
          <button
            onClick={() => setShowInviteForm(true)}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Invite First Family Member</span>
          </button>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              Edit Permissions - {editingMember.name}
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="label">Access Level</label>
                <select
                  value={editingMember.accessLevel}
                  onChange={(e) => setEditingMember(prev => prev ? { ...prev, accessLevel: e.target.value as FamilyAccessLevel } : null)}
                  className="input"
                >
                  {ACCESS_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Specific Permissions</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {PERMISSIONS.map(permission => (
                    <div key={permission.value} className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id={permission.value}
                        checked={editingMember.permissions.includes(permission.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingMember(prev => prev ? {
                              ...prev,
                              permissions: [...prev.permissions, permission.value]
                            } : null);
                          } else {
                            setEditingMember(prev => prev ? {
                              ...prev,
                              permissions: prev.permissions.filter(p => p !== permission.value)
                            } : null);
                          }
                        }}
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editEmergencyContact"
                  checked={editingMember.isEmergencyContact}
                  onChange={(e) => setEditingMember(prev => prev ? { ...prev, isEmergencyContact: e.target.checked } : null)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editEmergencyContact" className="text-sm text-gray-700">
                  Emergency contact
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingMember(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateMember(editingMember, {
                  accessLevel: editingMember.accessLevel,
                  permissions: editingMember.permissions,
                  isEmergencyContact: editingMember.isEmergencyContact
                })}
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}