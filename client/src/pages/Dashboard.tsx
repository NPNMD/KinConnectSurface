import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { signOutUser } from '@/lib/firebase';
import {
  Heart,
  Calendar,
  Pill,
  Users,
  Settings,
  LogOut,
  Plus,
  Bell,
  Activity,
  Shield,
  Mail,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import MedicationReminders from '@/components/MedicationReminders';
import MedicationAdherenceDashboard from '@/components/MedicationAdherenceDashboard';
import CalendarIntegration from '@/components/CalendarIntegration';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface FamilyConnection {
  id: string;
  patientId?: string;
  familyMemberId?: string;
  patientName?: string;
  familyMemberName?: string;
  patientEmail?: string;
  familyMemberEmail?: string;
  accessLevel: string;
  permissions: any;
  status: string;
  acceptedAt?: Date;
  relationship: 'family_member' | 'patient';
}

interface FamilyAccessData {
  patientsIHaveAccessTo: FamilyConnection[];
  familyMembersWithAccessToMe: FamilyConnection[];
  totalConnections: number;
}

export default function Dashboard() {
  const { user, firebaseUser } = useAuth();
  const [familyAccess, setFamilyAccess] = useState<FamilyAccessData | null>(null);
  const [loadingFamily, setLoadingFamily] = useState(true);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const fetchFamilyAccess = async () => {
    try {
      setLoadingFamily(true);
      setFamilyError(null);
      
      console.log('🔧 Dashboard: Fetching family access data...');
      console.log('🔧 Dashboard: Using endpoint:', API_ENDPOINTS.FAMILY_ACCESS);
      
      const response = await apiClient.get<{ success: boolean; data: FamilyAccessData }>(
        API_ENDPOINTS.FAMILY_ACCESS
      );
      
      console.log('🔧 Dashboard: Family access response:', response);
      
      if (response.success) {
        setFamilyAccess(response.data);
        console.log('✅ Dashboard: Family access data loaded successfully');
      } else {
        console.error('❌ Dashboard: Family access request failed:', response);
        setFamilyError('Failed to load family connections');
      }
    } catch (error) {
      console.error('❌ Dashboard: Error fetching family access:', error);
      setFamilyError('Failed to load family connections');
    } finally {
      setLoadingFamily(false);
    }
  };

  const handleRemoveFamilyMember = async (accessId: string, memberName: string) => {
    try {
      setRemovingMember(accessId);
      const response = await apiClient.post<{ success: boolean; message: string }>(
        API_ENDPOINTS.REMOVE_FAMILY_MEMBER,
        { action: 'remove', accessId }
      );
      
      if (response.success) {
        // Refresh family access data
        await fetchFamilyAccess();
        setShowRemoveConfirm(null);
        // You could add a toast notification here
        console.log(`✅ Successfully removed ${memberName} from your care network`);
      } else {
        setFamilyError('Failed to remove family member');
      }
    } catch (error) {
      console.error('Error removing family member:', error);
      setFamilyError('Failed to remove family member');
    } finally {
      setRemovingMember(null);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchFamilyAccess();
    }
  }, [firebaseUser]);

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'full': return 'bg-green-100 text-green-800 border-green-200';
      case 'limited': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'view_only': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'emergency_only': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const quickActions = [
    {
      title: 'Add Medication',
      description: 'Record a new prescription',
      icon: Pill,
      href: '/profile',
      color: 'bg-blue-500',
    },
    {
      title: 'Schedule Appointment',
      description: 'Book a healthcare visit',
      icon: Calendar,
      href: '/appointments/new',
      color: 'bg-green-500',
    },
    {
      title: 'Invite Family Member',
      description: 'Add someone to your care team',
      icon: Users,
      href: '/family/invite',
      color: 'bg-purple-500',
    },
    {
      title: 'Update Profile',
      description: 'Edit your medical information',
      icon: Heart,
      href: '/profile',
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
              <span className="text-lg sm:text-2xl font-bold text-gray-900">KinConnect</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              
              <div className="hidden sm:flex items-center space-x-3">
                {firebaseUser?.photoURL && (
                  <img
                    src={firebaseUser.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-gray-700 font-medium">
                  {user?.name || firebaseUser?.displayName || 'User'}
                </span>
              </div>
              
              {/* Mobile: Show only avatar */}
              <div className="sm:hidden">
                {firebaseUser?.photoURL && (
                  <img
                    src={firebaseUser.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                )}
              </div>
              
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || 'there'}! 👋
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your family's care today.
          </p>
        </div>

        {/* Quick Actions - Mobile Optimized */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-2 sm:space-y-0">
                  <div className={`${action.color} p-2 sm:p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{action.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Dashboard Grid - Mobile Optimized */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Medication Reminders */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <MedicationReminders
                patientId={user?.id || firebaseUser?.uid || ''}
                maxItems={5}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Today's Overview</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Medications Due</span>
                  <span className="font-semibold text-gray-400">Loading...</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Appointments</span>
                  <span className="font-semibold text-gray-400">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Pending Tasks</span>
                  <span className="font-semibold text-gray-400">0</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  to="/profile"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View all medications →
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Family Connections</h3>
              
              {loadingFamily ? (
                <div className="text-center py-6">
                  <LoadingSpinner size="sm" />
                  <p className="text-gray-500 mt-2">Loading family connections...</p>
                </div>
              ) : familyError ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-600 mb-4 text-sm">{familyError}</p>
                  <button
                    onClick={fetchFamilyAccess}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : familyAccess && familyAccess.totalConnections > 0 ? (
                <div className="space-y-4">
                  {/* Patients I have access to */}
                  {familyAccess.patientsIHaveAccessTo.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Patients I Help Care For</h4>
                      <div className="space-y-2">
                        {familyAccess.patientsIHaveAccessTo.map((connection) => (
                          <div key={connection.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{connection.patientName}</p>
                                <p className="text-xs text-gray-600">{connection.patientEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(connection.accessLevel)}`}>
                                <Shield className="w-3 h-3 mr-1" />
                                {connection.accessLevel.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Family members who have access to me */}
                  {familyAccess.familyMembersWithAccessToMe.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">My Care Team</h4>
                      <div className="space-y-2">
                        {familyAccess.familyMembersWithAccessToMe.map((connection) => (
                          <div key={connection.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{connection.familyMemberName}</p>
                                <p className="text-xs text-gray-600">{connection.familyMemberEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(connection.accessLevel)}`}>
                                <Shield className="w-3 h-3 mr-1" />
                                {connection.accessLevel.replace('_', ' ')}
                              </span>
                              <button
                                onClick={() => setShowRemoveConfirm(connection.id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Remove family member"
                                disabled={removingMember === connection.id}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <Link
                      to="/family/invite"
                      className="inline-flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Invite Family Member
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No family connections yet</h4>
                  <p className="text-gray-500 mb-4 text-sm">
                    Invite family members to help coordinate care or accept invitations from patients.
                  </p>
                  <Link
                    to="/family/invite"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Invite Family Member
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Medical Calendar Section - Mobile Optimized */}
        <div className="mt-6 sm:mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <CalendarIntegration
              patientId={user?.id || firebaseUser?.uid || ''}
            />
          </div>
        </div>

        {/* Medication Adherence Section - Mobile Optimized */}
        <div className="mt-6 sm:mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <MedicationAdherenceDashboard
              patientId={user?.id || firebaseUser?.uid || ''}
            />
          </div>
        </div>
      </main>

      {/* Remove Family Member Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Remove Family Member</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to remove this family member from your care network?
              They will no longer be able to access your medical information.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={removingMember === showRemoveConfirm}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const connection = familyAccess?.familyMembersWithAccessToMe.find(c => c.id === showRemoveConfirm);
                  if (connection) {
                    handleRemoveFamilyMember(showRemoveConfirm, connection.familyMemberName || 'Unknown');
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={removingMember === showRemoveConfirm}
              >
                {removingMember === showRemoveConfirm ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
