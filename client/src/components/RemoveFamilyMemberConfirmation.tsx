import React from 'react';
import { X, AlertTriangle, Shield, Eye } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface FamilyMember {
  id: string;
  familyMemberName: string;
  familyMemberEmail: string;
  accessLevel: 'full' | 'view_only';
  status: 'active' | 'pending' | 'revoked';
  familyMemberDetails?: {
    name: string;
    email: string;
  };
}

interface RemoveFamilyMemberConfirmationProps {
  member: FamilyMember;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export default function RemoveFamilyMemberConfirmation({
  member,
  onClose,
  onConfirm,
  loading = false
}: RemoveFamilyMemberConfirmationProps) {
  const memberName = member.familyMemberDetails?.name || member.familyMemberName;
  const isPending = member.status === 'pending';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isPending ? 'Cancel Invitation' : 'Remove Family Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Banner */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">
                  {isPending ? 'This will cancel the invitation' : 'This action cannot be undone'}
                </h3>
                <p className="text-sm text-red-800">
                  {isPending 
                    ? `The invitation to ${memberName} will be cancelled and they will not be able to accept it.`
                    : `${memberName} will immediately lose all access to your medical information and appointments.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Member Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">
              {isPending ? 'Cancelling invitation for:' : 'Removing access for:'}
            </p>
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

          {/* What Happens Next */}
          {!isPending && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">What happens when you remove access:</p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• {memberName} will no longer see your appointments</li>
                <li>• They will lose access to your medical calendar</li>
                <li>• They will not receive any notifications</li>
                <li>• They will be notified about the removal</li>
                <li>• You can re-invite them later if needed</li>
              </ul>
            </div>
          )}

          {isPending && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">What happens when you cancel:</p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• The invitation link will become invalid</li>
                <li>• {memberName} will not be able to accept the invitation</li>
                <li>• You can send a new invitation later if needed</li>
              </ul>
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
            Keep Access
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">{isPending ? 'Cancelling...' : 'Removing...'}</span>
              </>
            ) : (
              <>{isPending ? 'Cancel Invitation' : 'Remove Access'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}