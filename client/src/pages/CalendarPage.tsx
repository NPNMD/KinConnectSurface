import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import {
  Heart,
  ArrowLeft,
  Calendar,
  User,
  Users,
  Pill,
  Settings
} from 'lucide-react';
import CalendarIntegration from '@/components/CalendarIntegration';
import PatientSwitcher from '@/components/PatientSwitcher';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';

export default function CalendarPage() {
  const { getEffectivePatientId, userRole, activePatientAccess } = useFamily();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Mobile-First Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-2">
                <Calendar className="w-6 h-6 text-primary-600" />
                <span className="text-lg font-bold text-gray-900">
                  {userRole === 'family_member' && activePatientAccess
                    ? `${activePatientAccess.patientName}'s Calendar`
                    : 'Calendar'
                  }
                </span>
              </div>
            </div>
            
            {/* Patient Switcher for Family Members */}
            <div className="flex-1 flex justify-center">
              <PatientSwitcher />
            </div>
            
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-20 max-w-full overflow-x-hidden">
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-full">
          <CalendarIntegration patientId={getEffectivePatientId() || ''} />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-rose-600 hover:text-rose-700 transition-colors"
          >
            <div className="bg-rose-100 p-1.5 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-green-600 hover:text-green-700 transition-colors"
          >
            <div className="bg-green-100 p-1.5 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-amber-600 hover:text-amber-700 transition-colors"
          >
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}