import React, { useState, useEffect } from 'react';
import { useFamily } from '@/contexts/FamilyContext';
import { Eye, X } from 'lucide-react';

/**
 * ViewOnlyBanner Component
 * 
 * Displays a banner at the top of pages for view-only family members.
 * - Only shows for family members with view-only access
 * - Clear message indicating read-only mode
 * - Dismissible (stores in sessionStorage)
 * - Subtle but noticeable design
 */
export function ViewOnlyBanner() {
  const { userRole, activePatientAccess } = useFamily();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner was dismissed in this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('viewOnlyBannerDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Only show for view-only family members (those without edit permissions)
  const shouldShow =
    userRole === 'family_member' &&
    activePatientAccess &&
    !activePatientAccess.permissions.canEdit &&
    !activePatientAccess.permissions.canCreate &&
    !isDismissed;

  if (!shouldShow) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('viewOnlyBannerDismissed', 'true');
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Eye className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              You have view-only access to {activePatientAccess.patientName}'s information
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              You can view all information but cannot create, edit, or delete items
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-4 text-blue-600 hover:text-blue-800 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}