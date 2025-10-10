import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Pill, Calendar, User, Users, Plus } from 'lucide-react';
import UnifiedFamilyInvitation from '@/components/UnifiedFamilyInvitation';
import FamilyAccessControls from '@/components/FamilyAccessControls';
import { useFamily } from '@/contexts/FamilyContext';

export default function InvitePatient() {
  const { getEffectivePatientId } = useFamily();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const effectivePatientId = getEffectivePatientId();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-8">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                to="/dashboard"
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900">FamMedicalCare</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Family Members
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Manage your family care network and send invitations to new members.
              </p>
            </div>
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Invite Family Member</span>
            </button>
          </div>
        </div>

        {/* Current Family Members */}
        {effectivePatientId && (
          <div className="mb-6 sm:mb-8">
            <FamilyAccessControls
              patientId={effectivePatientId}
              hideInviteButton={true}
            />
          </div>
        )}

        {/* Invitation Form Modal */}
        {showInviteForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <UnifiedFamilyInvitation
                  mode="simple"
                  onInvitationSent={() => {
                    setShowInviteForm(false);
                    console.log('Invitation sent successfully!');
                  }}
                  onClose={() => setShowInviteForm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Information Section */}
        <div className="mt-8 sm:mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">How Family Invitations Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold text-base sm:text-lg">1</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Send Invitation</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Enter your family member's email and name to send them a secure invitation link.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 font-bold text-base sm:text-lg">2</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Family Member Accepts</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Your family member receives an email and clicks the link to join your care network.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 font-bold text-base sm:text-lg">3</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Connected Care</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Your family members can now help coordinate your care and manage your medical calendar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex flex-col items-center space-y-1 p-2 text-rose-600 hover:text-rose-700 transition-colors"
          >
            <div className="bg-rose-100 p-2 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex flex-col items-center space-y-1 p-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <div className="bg-blue-100 p-2 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex flex-col items-center space-y-1 p-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <div className="bg-purple-100 p-2 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center space-y-1 p-2 text-green-600 hover:text-green-700 transition-colors"
          >
            <div className="bg-green-100 p-2 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex flex-col items-center space-y-1 p-2 text-amber-600 hover:text-amber-700 transition-colors"
          >
            <div className="bg-amber-100 p-2 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}