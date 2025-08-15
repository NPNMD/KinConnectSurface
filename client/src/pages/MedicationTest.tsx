import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TestTube, AlertCircle } from 'lucide-react';
import MedicationSearch from '@/components/MedicationSearch';
import { DrugConcept } from '@/lib/drugApi';
import { apiClient } from '@/lib/api';

export default function MedicationTest() {
  const [selectedMedications, setSelectedMedications] = useState<DrugConcept[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isTestingAPI, setIsTestingAPI] = useState(false);

  const handleMedicationSelect = (medication: DrugConcept) => {
    console.log('Selected medication:', medication);
    setSelectedMedications(prev => [...prev, medication]);
  };

  const testDirectAPI = async () => {
    setIsTestingAPI(true);
    try {
      // Test the API directly without authentication
      const response = await fetch('/api/drugs/test-search?q=metformin&limit=5');
      const data = await response.json();
      setTestResults([data]);
      console.log('Direct API test result:', data);
    } catch (error) {
      console.error('Direct API test failed:', error);
      setTestResults([{ success: false, error: 'Failed to test API directly' }]);
    } finally {
      setIsTestingAPI(false);
    }
  };

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
                <TestTube className="w-8 h-8 text-primary-600" />
                <span className="text-2xl font-bold text-gray-900">Medication Search Test</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Test Medication Search</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search for medications
              </label>
              <MedicationSearch
                onSelect={handleMedicationSelect}
                placeholder="Type medication name (e.g., metformin, aspirin, ibuprofen)"
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                Try searching for common medications like "metformin", "aspirin", or "ibuprofen"
              </p>
            </div>

            {/* Selected Medications */}
            {selectedMedications.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Selected Medications</h2>
                <div className="space-y-3">
                  {selectedMedications.map((med, index) => (
                    <div
                      key={`${med.rxcui}-${index}`}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{med.name}</h3>
                          <p className="text-sm text-gray-600">RXCUI: {med.rxcui}</p>
                          {med.tty && (
                            <p className="text-sm text-gray-600">Type: {med.tty}</p>
                          )}
                          {med.synonym && (
                            <p className="text-sm text-gray-600">Synonym: {med.synonym}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedMedications(prev => 
                            prev.filter((_, i) => i !== index)
                          )}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Information */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Debug Information</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Check browser console for API calls and errors</p>
                <p>• Medication search uses RxNorm API through our backend</p>
                <p>• Authentication is required for API access</p>
                <p>• Selected medications: {selectedMedications.length}</p>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={testDirectAPI}
                  disabled={isTestingAPI}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isTestingAPI ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Testing API...</span>
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4" />
                      <span>Test API Directly (No Auth)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* API Test Results */}
            {testResults.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-medium text-green-900 mb-2 flex items-center space-x-2">
                  <TestTube className="w-4 h-4" />
                  <span>Direct API Test Results</span>
                </h3>
                <pre className="text-xs text-green-800 bg-green-100 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(testResults[0], null, 2)}
                </pre>
                {testResults[0].success && (
                  <p className="text-sm text-green-700 mt-2">
                    ✅ RxNorm API is working! Found {testResults[0].data?.length || 0} medications.
                  </p>
                )}
              </div>
            )}

            {/* Authentication Notice */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h3 className="font-medium text-yellow-900 mb-2 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>Authentication Notice</span>
              </h3>
              <div className="text-sm text-yellow-800 space-y-1">
                <p>• The medication search above requires user authentication</p>
                <p>• When users are logged in, the search will work properly</p>
                <p>• The 401 errors are expected behavior for security</p>
                <p>• Use the "Test API Directly" button to verify RxNorm integration</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}