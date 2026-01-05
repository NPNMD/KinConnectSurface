import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Shield, Eye, Clock, AlertCircle, MoreVertical, RefreshCw, Trash2, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiClient } from '@/lib/api';
import ChangeAccessLevelModal from '@/components/ChangeAccessLevelModal';
import RemoveFamilyMemberConfirmation from '@/components/RemoveFamilyMemberConfirmation';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';

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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Enhanced Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-20">
        {/* Page Title Section */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-primary-600" />
              Family & Caregivers
            </h1>
            <p className="text-gray-600 mt-1">
              Manage who has access to your medical information
            </p>
          </div>
          <button
            onClick={() => navigate('/family/invite')}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 w-full sm:w-auto"
            aria-label="Invite new family member"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Invite Member
          </button>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Members</h2>
          
          {activeMembers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No active family members</p>
              <p className="text-sm text-gray-500 mt-1">Invite family members to help manage your care</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeMembers.map((member) => (
                <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {member.familyMemberDetails?.name || member.familyMemberName}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {member.familyMemberDetails?.email || member.familyMemberEmail}
                      </p>
                    </div>
                    <div className="relative group flex-shrink-0 ml-2">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={`More options for ${member.familyMemberDetails?.name || member.familyMemberName}`}
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10 py-1">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowChangeAccessModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Change Access
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRemoveConfirmation(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Access:</span>
                      {getAccessLevelBadge(member.accessLevel)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Status:</span>
                      {getStatusIndicator(member)}
                    </div>
                    {member.acceptedAt && (
                      <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h2>
          
          {pendingInvitations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No pending invitations</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200 shadow-sm overflow-hidden">
              {pendingInvitations.map((member) => {
                const isExpired = member.invitationExpiresAt && new Date(member.invitationExpiresAt) < new Date();
                const daysUntilExpiry = member.invitationExpiresAt 
                  ? Math.ceil((new Date(member.invitationExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div key={member.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-medium text-gray-900">{member.familyMemberEmail}</p>
                          {getAccessLevelBadge(member.accessLevel)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>Sent {new Date(member.invitedAt).toLocaleDateString()}</span>
                          {!isExpired && daysUntilExpiry <= 2 && (
                            <span className="text-amber-600 font-medium">
                              Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-red-600 font-medium">Expired</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResendInvitation(member)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center"
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
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
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
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
