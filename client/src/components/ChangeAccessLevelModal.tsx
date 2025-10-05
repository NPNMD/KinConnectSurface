import React, { useState } from 'react';
import { X, AlertTriangle, Shield, Eye } from 'lucide-react';
import AccessLevelSelector from './AccessLevelSelector';
import LoadingSpinner from './LoadingSpinner';

interface FamilyMember {
  id: string;
  familyMemberName: string;
  familyMemberEmail: string;
  accessLevel: 'full' | 'view_only';
  familyMemberDetails?: {
    name: string;
    email: string;
  };
}

interface ChangeAccessLevelModalProps {
  member: FamilyMember;
  onClose: () => void;
  onConfirm: (newAccessLevel: 'full' | 'view_only') => Promise<void>;
  loading?: boolean;
}

export default function ChangeAccessLevelModal({
  member,
  onClose,
  onConfirm,
  loading = false
}: ChangeAccessLevelModalProps) {
  const [newAccessLevel, setNewAccessLevel] = useState<'full' | 'view_only'>(member.accessLevel);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);

  const memberName = member.familyMemberDetails?.name || member.familyMemberName;
  const isDowngrade = member.accessLevel === 'full' && newAccessLevel === 'view_only';
  const isUpgrade = member.accessLevel === 'view_only' && newAccessLevel === 'full';
  const hasChanged = newAccessLevel !== member.accessLevel;

  const handleConfirm = async () => {
    if (isDowngrade && !showDowngradeWarning) {
      setShowDowngradeWarning(true);
      return;
    }

    await onConfirm(newAccessLevel);
  };

  const getChangeDescription = () => {
    if (isDowngrade) {
      return {
        title: 'Downgrading Access Level',
        description: `${memberName} will lose the ability to create, edit, or delete appointments. They will only be able to view appointments and claim transportation responsibilities.`,
        color: 'amber'
      };
    }
    if (isUpgrade) {
      return {
        title: 'Upgrading Access Level',
        description: `${memberName} will gain full control over appointments, including the ability to create, edit, and delete them.`,
        color: 'blue'
      };
    }
    return {
      title: 'No Changes',
      description: 'The access level remains the same.',
      color: 'gray'
    };
  };

  const changeInfo = getChangeDescription();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Change Access Level</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Member Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Changing access for:</p>
            <p className="font-semibold text-gray-900">{memberName}</p>
            <p className="text-sm text-gray-600">{member.familyMemberEmail}</p>
            
            <div className="mt-3 flex items-center space-x-2">
              <span className="text-sm text-gray-600">Current Access:</span>
              {member.accessLevel === 'full' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Full Access
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Eye className="w-3 h-3 mr-1" />
                  View Only
                </span>
              )}
            </div>
          </div>

          {/* Access Level Selector */}
          <div>
            <AccessLevelSelector
              selectedLevel={newAccessLevel}
              onChange={setNewAccessLevel}
              disabled={loading}
            />
          </div>

          {/* Change Summary */}
          {hasChanged && (
            <div className={`rounded-lg p-4 ${
              changeInfo.color === 'amber' ? 'bg-amber-50 border border-amber-200' :
              changeInfo.color === 'blue' ? 'bg-blue-50 border border-blue-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-start">
                {isDowngrade && <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${
                    changeInfo.color === 'amber' ? 'text-amber-900' :
                    changeInfo.color === 'blue' ? 'text-blue-900' :
                    'text-gray-900'
                  }`}>
                    {changeInfo.title}
                  </h3>
                  <p className={`text-sm ${
                    changeInfo.color === 'amber' ? 'text-amber-800' :
                    changeInfo.color === 'blue' ? 'text-blue-800' :
                    'text-gray-600'
                  }`}>
                    {changeInfo.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Downgrade Confirmation */}
          {showDowngradeWarning && isDowngrade && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-1">Confirm Downgrade</h3>
                  <p className="text-sm text-red-800 mb-3">
                    Are you sure you want to downgrade {memberName}'s access? They will immediately lose the ability to:
                  </p>
                  <ul className="text-sm text-red-800 space-y-1 ml-4">
                    <li>• Create new appointments</li>
                    <li>• Edit existing appointments</li>
                    <li>• Delete appointments</li>
                    <li>• Manage other family members</li>
                    <li>• View detailed medical information</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !hasChanged}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
              showDowngradeWarning && isDowngrade
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Updating...</span>
              </>
            ) : (
              <>
                {showDowngradeWarning && isDowngrade ? 'Confirm Downgrade' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}