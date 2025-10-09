import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Shield, Eye, Clock, AlertCircle, MoreVertical, RefreshCw, Trash2, Edit, Heart, Calendar, Pill, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiClient } from '@/lib/api';
import ChangeAccessLevelModal from '@/components/ChangeAccessLevelModal';
import RemoveFamilyMemberConfirmation from '@/components/RemoveFamilyMemberConfirmation';

interface FamilyMember {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  familyMemberEmail: string;
  accessLevel: 'full' | 'view_only';
  status: 'active' | 'pending' | 'revoked';
  acceptedAt?: Date;
  invitedAt: Date;
  invitationExpiresAt?: Date;
  familyMemberDetails?: {
    name: string;
    email: string;
  };
}

export default function FamilyManagement() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { activePatientId } = useFamily();
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showChangeAccessModal, setShowChangeAccessModal] = useState(false);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activePatientId) {
      fetchFamilyMembers();
    }
  }, [activePatientId]);

  const fetchFamilyMembers = async () => {
    if (!activePatientId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<{ success: boolean; data: FamilyMember[] }>(
        `/family-access/patient/${activePatientId}`
      );
      
      if (response.success) {
        setFamilyMembers(response.data);
      } else {
        setError('Failed to load family members');
      }
    } catch (err: any) {
      console.error('Error fetching family members:', err);
      setError(err?.message || 'Failed to load family members');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAccessLevel = async (newAccessLevel: 'full' | 'view_only') => {
    if (!selectedMember) return;
    
    try {
      setActionLoading(true);
      
      const response = await apiClient.patch<{ success: boolean; message?: string }>(
        `/family-access/${selectedMember.id}/access-level`,
        { accessLevel: newAccessLevel }
      );
      
      if (response.success) {
        // Refresh the list
        await fetchFamilyMembers();
        setShowChangeAccessModal(false);
        setSelectedMember(null);
      } else {
        setError('Failed to update access level');
      }
    } catch (err: any) {
      console.error('Error updating access level:', err);
      setError(err?.message || 'Failed to update access level');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    
    try {
      setActionLoading(true);
      
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        `/family-access/${selectedMember.id}`
      );
      
      if (response.success) {
        // Refresh the list
        await fetchFamilyMembers();
        setShowRemoveConfirmation(false);
        setSelectedMember(null);
      } else {
        setError('Failed to remove family member');
      }
    } catch (err: any) {
      console.error('Error removing family member:', err);
      setError(err?.message || 'Failed to remove family member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async (member: FamilyMember) => {
    try {
      setActionLoading(true);
      
      const response = await apiClient.post<{ success: boolean; message?: string }>(
        `/invitations/${member.id}/resend`
      );
      
      if (response.success) {
        // Refresh the list
        await fetchFamilyMembers();
      } else {
        setError('Failed to resend invitation');
      }
    } catch (err: any) {
      console.error('Error resending invitation:', err);
      setError(err?.message || 'Failed to resend invitation');
    } finally {
      setActionLoading(false);
    }
  };

  const getAccessLevelBadge = (accessLevel: 'full' | 'view_only') => {
    if (accessLevel === 'full') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Shield className="w-3 h-3 mr-1" />
          Full Access
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Eye className="w-3 h-3 mr-1" />
        View Only
      </span>
    );
  };

  const getStatusIndicator = (member: FamilyMember) => {
    if (member.status === 'active') {
      return <span className="flex items-center text-green-600 text-sm"><span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>Active</span>;
    }
    
    if (member.status === 'pending') {
      const isExpired = member.invitationExpiresAt && new Date(member.invitationExpiresAt) < new Date();
      if (isExpired) {
        return <span className="flex items-center text-red-600 text-sm"><span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>Expired</span>;
      }
      return <span className="flex items-center text-yellow-600 text-sm"><span className="w-2 h-2 bg-yellow-600 rounded-full mr-2"></span>Pending</span>;
    }
    
    return <span className="flex items-center text-gray-600 text-sm"><span className="w-2 h-2 bg-gray-600 rounded-full mr-2"></span>Revoked</span>;
  };

  const activeMembers = familyMembers.filter(m => m.status === 'active');
  const pendingInvitations = familyMembers.filter(m => m.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="w-8 h-8 mr-3 text-blue-600" />
              Family & Caregivers
            </h1>
            <p className="mt-2 text-gray-600">
              Manage who has access to your medical information and appointments
            </p>
          </div>
          <button
            onClick={() => navigate('/invite-family')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Invite New Member
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {/* Active Family Members */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Family Members</h2>
        
        {activeMembers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No active family members yet</p>
            <p className="text-sm text-gray-500 mt-1">Invite family members to help manage your care</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {member.familyMemberDetails?.name || member.familyMemberName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {member.familyMemberDetails?.email || member.familyMemberEmail}
                    </p>
                  </div>
                  <div className="relative group">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 hidden group-hover:block z-10">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowChangeAccessModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Change Access Level
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRemoveConfirmation(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Access
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Access Level:</span>
                    {getAccessLevelBadge(member.accessLevel)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    {getStatusIndicator(member)}
                  </div>
                  {member.acceptedAt && (
                    <div className="text-xs text-gray-500 mt-2">
                      Joined {new Date(member.acceptedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Invitations</h2>
        
        {pendingInvitations.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No pending invitations</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {pendingInvitations.map((member) => {
              const isExpired = member.invitationExpiresAt && new Date(member.invitationExpiresAt) < new Date();
              const daysUntilExpiry = member.invitationExpiresAt 
                ? Math.ceil((new Date(member.invitationExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              
              return (
                <div key={member.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-medium text-gray-900">{member.familyMemberEmail}</p>
                          <div className="flex items-center space-x-3 mt-1">
                            {getAccessLevelBadge(member.accessLevel)}
                            {getStatusIndicator(member)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Sent {new Date(member.invitedAt).toLocaleDateString()}
                        {!isExpired && daysUntilExpiry <= 2 && (
                          <span className="ml-2 text-amber-600 font-medium">
                            • Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isExpired && (
                          <span className="ml-2 text-red-600 font-medium">• Expired</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResendInvitation(member)}
                        disabled={actionLoading}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Resend
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRemoveConfirmation(true);
                        }}
                        disabled={actionLoading}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showChangeAccessModal && selectedMember && (
        <ChangeAccessLevelModal
          member={selectedMember}
          onClose={() => {
            setShowChangeAccessModal(false);
            setSelectedMember(null);
          }}
          onConfirm={handleChangeAccessLevel}
          loading={actionLoading}
        />
      )}

      {showRemoveConfirmation && selectedMember && (
        <RemoveFamilyMemberConfirmation
          member={selectedMember}
          onClose={() => {
            setShowRemoveConfirmation(false);
            setSelectedMember(null);
          }}
          onConfirm={handleRemoveMember}
          loading={actionLoading}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-between">
          <a
            href="/dashboard"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-rose-600 hover:text-rose-700 transition-colors"
          >
            <div className="bg-rose-100 p-1.5 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs">Home</span>
          </a>
          
          <a
            href="/medications"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs">Medications</span>
          </a>
          
          <a
            href="/calendar"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs">Calendar</span>
          </a>
          
          <a
            href="/profile"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-green-600 hover:text-green-700 transition-colors"
          >
            <div className="bg-green-100 p-1.5 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">Profile</span>
          </a>
          
          <a
            href="/family-management"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-amber-600 hover:text-amber-700 transition-colors"
          >
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Family</span>
          </a>
        </div>
      </nav>
    </div>
  );
}