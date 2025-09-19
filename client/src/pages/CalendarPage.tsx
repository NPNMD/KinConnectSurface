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

export default function CalendarPage() {
  const { getEffectivePatientId, userRole, activePatientAccess } = useFamily();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
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
      <main className="px-4 py-4 pb-20">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <CalendarIntegration patientId={getEffectivePatientId() || ''} />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-around">
          <Link
            to="/dashboard"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pill className="w-5 h-5" />
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex flex-col items-center space-y-1 p-2 text-primary-600"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-medium">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}