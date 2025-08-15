import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { PatientInvitation } from '@/components/PatientInvitation';

export default function InvitePatient() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                to="/dashboard" 
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <Heart className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">KinConnect</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Invite a Patient
          </h1>
          <p className="text-gray-600">
            Send an invitation to a patient to join your family care network on KinConnect.
          </p>
        </div>

        <div className="flex justify-center">
          <PatientInvitation 
            onInvitationSent={() => {
              // Could redirect or show success message
              console.log('Invitation sent successfully!');
            }}
          />
        </div>

        {/* Information Section */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">How Patient Invitations Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold text-lg">1</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Send Invitation</h3>
                <p className="text-sm text-gray-600">
                  Enter the patient's email and name to send them a secure invitation link.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 font-bold text-lg">2</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Patient Accepts</h3>
                <p className="text-sm text-gray-600">
                  The patient receives an email and clicks the link to join your care network.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 font-bold text-lg">3</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Connected Care</h3>
                <p className="text-sm text-gray-600">
                  You can now coordinate care and share important health information securely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}