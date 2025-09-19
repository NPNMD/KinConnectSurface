import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, Mail, ArrowRight, CheckCircle } from 'lucide-react';

export default function TestFamilyInviteFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  const mockInvitationToken = `test_inv_${Date.now()}_abc123`;

  const steps = [
    {
      title: "1. Family Member Receives Email",
      description: "Family member gets invitation email with special link",
      content: (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Email Invitation</span>
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <p className="font-medium mb-2">Subject: Dr. Smith has invited you to access their medical calendar</p>
            <p className="text-gray-600 mb-3">Hi John, Dr. Smith has invited you to access their medical calendar on KinConnect...</p>
            <button 
              onClick={() => setCurrentStep(2)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Accept Invitation →
            </button>
          </div>
        </div>
      )
    },
    {
      title: "2. Special Family Member Auth Page",
      description: "Link takes them to a special page that remembers the invitation",
      content: (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-medium mb-2">Welcome to KinConnect!</h3>
            <p className="text-sm text-gray-600 mb-3">Dr. Smith has invited you to join their family care network.</p>
            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
              <p className="text-blue-800 text-sm">You're being invited to help coordinate care for Dr. Smith</p>
            </div>
            <button 
              onClick={() => setCurrentStep(3)}
              className="bg-white border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              Continue with Google
            </button>
          </div>
        </div>
      )
    },
    {
      title: "3. After Authentication",
      description: "User is automatically redirected back to accept invitation",
      content: (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-medium mb-2">You're Invited to Join KinConnect!</h3>
            <p className="text-sm text-gray-600 mb-3">Dr. Smith has invited you to join their family care network.</p>
            <div className="bg-gray-50 rounded p-3 mb-3 text-left">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Invited by:</span>
                  <span className="font-medium">Dr. Smith</span>
                </div>
                <div className="flex justify-between">
                  <span>Patient:</span>
                  <span className="font-medium">Dr. Smith</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setCurrentStep(4)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Accept Invitation
            </button>
          </div>
        </div>
      )
    },
    {
      title: "4. Success!",
      description: "Family member is now connected and can access the dashboard",
      content: (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-medium mb-2 text-green-800">Welcome to the Family!</h3>
            <p className="text-sm text-gray-600 mb-3">You've successfully joined Dr. Smith's care network.</p>
            <p className="text-sm text-gray-600">Redirecting to Dr. Smith's dashboard...</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Heart className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">KinConnect</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              Back to App
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            New Family Member Invitation Flow
          </h1>
          <p className="text-gray-600">
            Testing the improved invitation system that preserves context
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {steps.map((_, index) => (
              <React.Fragment key={index}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index + 1 <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className={`w-4 h-4 ${
                    index + 1 < currentStep ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Current Step */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-gray-600 mb-4">
              {steps[currentStep - 1].description}
            </p>
            {steps[currentStep - 1].content}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Reset Demo
              </button>
              
              {currentStep < 4 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Next Step
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/family-invite/${mockInvitationToken}`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Test Real Flow
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">Technical Implementation</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p><strong>Problem:</strong> Original flow sent family members to generic login page, losing invitation context</p>
              <p><strong>Solution:</strong> Created special family member auth page at <code>/family-invite/{'{token}'}</code></p>
              <p><strong>Flow:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Email links now go to <code>/family-invite/{'{token}'}</code></li>
                <li>Special auth page shows invitation details before login</li>
                <li>After authentication, auto-redirects to <code>/invitation/{'{token}'}</code></li>
                <li>AcceptInvitation page now redirects unauthenticated users to family auth page</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}