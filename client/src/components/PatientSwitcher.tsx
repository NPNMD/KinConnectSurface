import React, { useState } from 'react';
import { ChevronDown, User, Shield, Eye, Edit } from 'lucide-react';
import { useFamily } from '@/contexts/FamilyContext';

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
          <span className="text-blue-900 font-medium">Viewing {patient.patientName}'s data</span>
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
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <User className="w-4 h-4 text-blue-600" />
        <span className="text-blue-900 font-medium text-sm">
          {activePatient ? `Viewing ${activePatient.patientName}'s data` : 'Select Patient'}
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
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
                Select Patient to View
              </div>
              
              {patientsWithAccess.map((patient) => (
                <button
                  key={patient.patientId}
                  onClick={() => {
                    switchToPatient(patient.patientId);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    patient.patientId === activePatientId
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{patient.patientName}</div>
                      <div className="text-xs text-gray-500">{patient.patientEmail}</div>
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
                    
                    <div className="flex items-center space-x-1 ml-2">
                      {patient.permissions.canEdit ? (
                        <Edit className="w-4 h-4 text-green-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-blue-600" />
                      )}
                      {patient.permissions.canManageFamily && (
                        <Shield className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="border-t border-gray-200 p-2">
              <div className="text-xs text-gray-500 px-2">
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