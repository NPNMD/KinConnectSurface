import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, User, Shield, Eye, Edit, Check, Loader2 } from 'lucide-react';
import { useFamily } from '@/contexts/FamilyContext';
import { showSuccess, showError } from '@/utils/toast';

interface PatientSwitcherProps {
  className?: string;
}

export default function PatientSwitcher({ className = '' }: PatientSwitcherProps) {
  const {
    userRole,
    patientsWithAccess,
    activePatientId,
    activePatientAccess,
    switchToPatient
  } = useFamily();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update selected index when active patient changes
  useEffect(() => {
    const index = patientsWithAccess.findIndex(p => p.patientId === activePatientId);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [activePatientId, patientsWithAccess]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % patientsWithAccess.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + patientsWithAccess.length) % patientsWithAccess.length);
          break;
        case 'Enter':
          e.preventDefault();
          handlePatientSwitch(patientsWithAccess[selectedIndex].patientId);
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, patientsWithAccess]);

  // Handle patient switch with loading state and error handling
  const handlePatientSwitch = async (patientId: string) => {
    if (patientId === activePatientId || isSwitching) return;

    const patient = patientsWithAccess.find(p => p.patientId === patientId);
    if (!patient) return;

    try {
      setIsSwitching(true);
      
      // Switch patient
      await switchToPatient(patientId);
      
      // Trigger data refresh event
      window.dispatchEvent(new CustomEvent('patientSwitched', {
        detail: { patientId, patientName: patient.patientName }
      }));
      
      setIsOpen(false);
      showSuccess(`Switched to ${patient.patientName}'s data`);
      
      // Force page reload to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to switch patient:', error);
      showError('Failed to switch patient. Please try again.');
    } finally {
      setIsSwitching(false);
    }
  };

  // Don't show switcher for patients or if no patient access
  if (userRole !== 'family_member' || patientsWithAccess.length === 0) {
    return null;
  }

  // Don't show switcher if only one patient
  if (patientsWithAccess.length === 1) {
    const patient = patientsWithAccess[0];
    return (
      <div className={`flex items-center space-x-2 text-sm ${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-blue-900 font-medium truncate max-w-[150px]">
            {patient.patientName}
          </span>
          <div className="flex items-center space-x-1">
            {patient.permissions.canEdit ? (
              <Edit className="w-3 h-3 text-green-600" />
            ) : (
              <Eye className="w-3 h-3 text-blue-600" />
            )}
          </div>
        </div>
      </div>
    );
  }

  const activePatient = patientsWithAccess.find(p => p.patientId === activePatientId);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !isSwitching && setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Switch patient"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {isSwitching ? (
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        ) : (
          <User className="w-4 h-4 text-blue-600" />
        )}
        <span className="text-blue-900 font-medium text-sm truncate max-w-[150px]">
          {activePatient ? activePatient.patientName : 'Select Patient'}
        </span>
        <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div
            className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto"
            role="listbox"
            aria-label="Patient list"
          >
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
                Select Patient to View
              </div>
              
              {patientsWithAccess.map((patient, index) => {
                const isActive = patient.patientId === activePatientId;
                const isSelected = index === selectedIndex;
                
                return (
                  <button
                    key={patient.patientId}
                    onClick={() => handlePatientSwitch(patient.patientId)}
                    disabled={isSwitching}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors disabled:opacity-50 ${
                      isActive
                        ? 'bg-blue-100 text-blue-900'
                        : isSelected
                        ? 'bg-gray-100 text-gray-900'
                        : 'hover:bg-gray-50 text-gray-900'
                    }`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <div className="font-medium text-sm truncate">{patient.patientName}</div>
                          {isActive && (
                            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" aria-label="Currently selected" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{patient.patientEmail}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            patient.accessLevel === 'full' ? 'bg-green-100 text-green-800' :
                            patient.accessLevel === 'limited' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {patient.accessLevel.replace('_', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            patient.status === 'active' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {patient.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                        {patient.permissions.canEdit ? (
                          <Edit className="w-4 h-4 text-green-600" aria-label="Can edit" />
                        ) : (
                          <Eye className="w-4 h-4 text-blue-600" aria-label="View only" />
                        )}
                        {patient.permissions.canManageFamily && (
                          <Shield className="w-4 h-4 text-purple-600" aria-label="Can manage family" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="border-t border-gray-200 p-2 bg-gray-50">
              <div className="text-xs text-gray-500 px-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Legend:</span>
                  <span className="text-gray-400">Use ↑↓ arrows to navigate</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>View only</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Edit className="w-3 h-3" />
                    <span>Can edit</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>Can manage</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}