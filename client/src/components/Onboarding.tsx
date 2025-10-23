import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Pill, Calendar, Users, FileText, Heart } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Welcome to FamMedicalCare',
      description: 'Your personal health companion',
      icon: <Heart className="w-12 h-12 text-rose-600" />,
      content: (
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-rose-100 p-6 rounded-full">
              <Heart className="w-16 h-16 text-rose-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">Welcome to FamMedicalCare!</h3>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            We're here to help you manage your health and medications with ease. Let's take a quick tour of the key features.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> You can skip this tour anytime, but we recommend completing it to get the most out of FamMedicalCare.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Medication Tracking',
      description: 'Never miss a dose again',
      icon: <Pill className="w-12 h-12 text-blue-600" />,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-6 rounded-full">
              <Pill className="w-16 h-16 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 text-center">Medication Tracking & Reminders</h3>
          <p className="text-gray-600 text-center max-w-md mx-auto">
            Keep track of all your medications in one place with smart reminders.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 mt-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Smart Reminders</h4>
                <p className="text-sm text-gray-600">Get notified when it's time to take your medications</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Time Buckets</h4>
                <p className="text-sm text-gray-600">Medications organized by morning, noon, evening, and bedtime</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Adherence Tracking</h4>
                <p className="text-sm text-gray-600">Monitor your medication adherence with detailed insights</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Calendar & Appointments',
      description: 'Stay on top of your health schedule',
      icon: <Calendar className="w-12 h-12 text-purple-600" />,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-purple-100 p-6 rounded-full">
              <Calendar className="w-16 h-16 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 text-center">Appointment Scheduling</h3>
          <p className="text-gray-600 text-center max-w-md mx-auto">
            Manage all your medical appointments and never miss an important visit.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 mt-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Unified Calendar</h4>
                <p className="text-sm text-gray-600">See all appointments and medication schedules in one view</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Appointment Reminders</h4>
                <p className="text-sm text-gray-600">Get notified before upcoming appointments</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Provider Information</h4>
                <p className="text-sm text-gray-600">Store contact details and notes for all your healthcare providers</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Family Access',
      description: 'Coordinate care with loved ones',
      icon: <Users className="w-12 h-12 text-amber-600" />,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-amber-100 p-6 rounded-full">
              <Users className="w-16 h-16 text-amber-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 text-center">Family Coordination</h3>
          <p className="text-gray-600 text-center max-w-md mx-auto">
            Share your health information with family members and coordinate care together.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 mt-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Invite Family Members</h4>
                <p className="text-sm text-gray-600">Grant access to trusted family members to help manage your care</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Flexible Permissions</h4>
                <p className="text-sm text-gray-600">Control what information each family member can see and edit</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Appointment Coordination</h4>
                <p className="text-sm text-gray-600">Family members can help schedule and manage appointments</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Visit Summaries',
      description: 'Record and track doctor visits',
      icon: <FileText className="w-12 h-12 text-green-600" />,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-6 rounded-full">
              <FileText className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 text-center">Visit Summaries</h3>
          <p className="text-gray-600 text-center max-w-md mx-auto">
            Keep detailed records of your doctor visits with AI-powered summaries.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 mt-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Voice Recording</h4>
                <p className="text-sm text-gray-600">Record visit notes using your voice for quick capture</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">AI-Powered Insights</h4>
                <p className="text-sm text-gray-600">Get key points and action items automatically extracted</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Medication Tracking</h4>
                <p className="text-sm text-gray-600">Automatically detect medication changes from visit notes</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-green-800 text-center">
              <strong>You're all set!</strong> Click "Get Started" to begin using FamMedicalCare.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (window.confirm('Are you sure you want to skip the tour? You can always access help from the settings menu.')) {
      onSkip();
    }
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10001]">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {currentStepData.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{currentStepData.title}</h2>
              <p className="text-sm text-gray-600">{currentStepData.description}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Skip tour"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-rose-500 to-rose-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSkip}
            className="text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Skip Tour
          </button>
          
          <div className="flex items-center space-x-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg hover:from-rose-600 hover:to-rose-700 transition-all shadow-md hover:shadow-lg"
            >
              <span>{isLastStep ? 'Get Started' : 'Next'}</span>
              {isLastStep ? (
                <Check className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}