import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import MedicalConditionSelect from '@/components/MedicalConditionSelect';
import AllergySelect from '@/components/AllergySelect';

export default function DropdownTest() {
  const [medicalCondition, setMedicalCondition] = useState('');
  const [allergy, setAllergy] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <Heart className="w-8 h-8 text-primary-600" />
                <span className="text-2xl font-bold text-gray-900">KinConnect</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Dropdown Components Test
          </h1>
          
          <div className="space-y-8">
            {/* Medical Condition Dropdown */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Medical Condition Dropdown
              </h2>
              <p className="text-gray-600 mb-4">
                Select from 50+ common chronic medical conditions or enter a custom one:
              </p>
              <div className="max-w-md">
                <MedicalConditionSelect
                  value={medicalCondition}
                  onChange={setMedicalCondition}
                  placeholder="Select or enter medical condition"
                />
              </div>
              {medicalCondition && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Selected:</strong> {medicalCondition}
                  </p>
                </div>
              )}
            </div>

            {/* Allergy Dropdown */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Allergy Dropdown
              </h2>
              <p className="text-gray-600 mb-4">
                Select from common food, drug, and environmental allergies or enter a custom one:
              </p>
              <div className="max-w-md">
                <AllergySelect
                  value={allergy}
                  onChange={setAllergy}
                  placeholder="Select or enter allergy"
                />
              </div>
              {allergy && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Selected:</strong> {allergy}
                  </p>
                </div>
              )}
            </div>

            {/* Features List */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Features:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• <strong>Medical Conditions:</strong> 50+ common chronic conditions</li>
                <li>• <strong>Allergies:</strong> Food, drug, and environmental allergies</li>
                <li>• <strong>Search:</strong> Type to filter options</li>
                <li>• <strong>Custom Entry:</strong> Add conditions/allergies not in the list</li>
                <li>• <strong>User-Friendly:</strong> Easy selection with dropdown interface</li>
                <li>• <strong>Responsive:</strong> Works on all device sizes</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}