import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, type ApiResponse } from '@/lib/api';

interface PatientInvitationProps {
  onInvitationSent?: () => void;
}

export const PatientInvitation: React.FC<PatientInvitationProps> = ({ onInvitationSent }) => {
  const { firebaseUser, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    patientName: '',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Check authentication first
      if (!isAuthenticated || !firebaseUser) {
        throw new Error('Please sign in to send invitations');
      }

      console.log('🚀 Sending invitation request:', formData);
      const result = await apiClient.post<ApiResponse<any>>('/invitations/send', formData);
      console.log('📨 Invitation response:', result);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send invitation';
        console.error('❌ Invitation failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('✅ Invitation sent successfully!');
      setSuccess('Invitation sent successfully! The patient will receive an email shortly.');
      setFormData({ email: '', patientName: '', message: '' });
      onInvitationSent?.();

    } catch (err: any) {
      console.error('❌ Invitation error:', err);
      const errorMessage = err?.message || err?.details || 'Failed to send invitation';
      setError(`Failed to send invitation: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite Family Member to KinConnect</h2>
      
      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md mb-4">
          <p className="text-sm">Please sign in to send invitations to family members.</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Family Member Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="family.member@example.com"
          />
        </div>

        <div>
          <label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-1">
            Family Member Name *
          </label>
          <input
            type="text"
            id="patientName"
            name="patientName"
            value={formData.patientName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Personal Message (Optional)
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add a personal message to the invitation..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !formData.email || !formData.patientName || !isAuthenticated}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span className="ml-2">Sending Invitation...</span>
            </>
          ) : (
            'Send Invitation'
          )}
        </button>
      </form>

      <div className="mt-6 text-sm text-gray-600">
        <p>Your family member will receive an email invitation to help manage your medical care on KinConnect.</p>
      </div>
    </div>
  );
};