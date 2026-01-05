import React from 'react';
import { useFamily } from '@/contexts/FamilyContext';
import { Calendar } from 'lucide-react';
import CalendarIntegration from '@/components/CalendarIntegration';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

export default function CalendarPage() {
  const { getEffectivePatientId, userRole, activePatientAccess } = useFamily();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Enhanced Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-20">
        
        {/* Page Title Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-primary-600" />
            {userRole === 'family_member' && activePatientAccess
              ? `${activePatientAccess.patientName}'s Calendar`
              : 'Calendar'
            }
          </h1>
          <p className="text-gray-600 mt-1">
            Manage appointments, visits, and reminders
          </p>
        </div>

        {/* Calendar Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <CalendarIntegration patientId={getEffectivePatientId() || ''} />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
