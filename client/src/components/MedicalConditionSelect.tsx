import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface MedicalConditionSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// 50 most common chronic medical conditions
const COMMON_MEDICAL_CONDITIONS = [
  'Hypertension (High Blood Pressure)',
  'Type 2 Diabetes',
  'Type 1 Diabetes',
  'High Cholesterol',
  'Asthma',
  'Chronic Obstructive Pulmonary Disease (COPD)',
  'Arthritis',
  'Osteoarthritis',
  'Rheumatoid Arthritis',
  'Depression',
  'Anxiety Disorder',
  'Bipolar Disorder',
  'Heart Disease',
  'Coronary Artery Disease',
  'Atrial Fibrillation',
  'Congestive Heart Failure',
  'Stroke',
  'Chronic Kidney Disease',
  'Kidney Stones',
  'Gastroesophageal Reflux Disease (GERD)',
  'Irritable Bowel Syndrome (IBS)',
  'Inflammatory Bowel Disease (IBD)',
  'Crohn\'s Disease',
  'Ulcerative Colitis',
  'Celiac Disease',
  'Thyroid Disease',
  'Hypothyroidism',
  'Hyperthyroidism',
  'Osteoporosis',
  'Fibromyalgia',
  'Chronic Fatigue Syndrome',
  'Migraine',
  'Epilepsy',
  'Multiple Sclerosis',
  'Parkinson\'s Disease',
  'Alzheimer\'s Disease',
  'Sleep Apnea',
  'Insomnia',
  'Cancer (specify type)',
  'Breast Cancer',
  'Prostate Cancer',
  'Lung Cancer',
  'Colon Cancer',
  'Skin Cancer',
  'Psoriasis',
  'Eczema',
  'Lupus',
  'Chronic Pain',
  'Back Pain',
  'Obesity'
];

export default function MedicalConditionSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select or enter medical condition"
}: MedicalConditionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const filteredConditions = COMMON_MEDICAL_CONDITIONS.filter(condition =>
    condition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (condition: string) => {
    onChange(condition);
    setIsOpen(false);
    setSearchTerm('');
    setIsCustom(false);
  };

  const handleCustomInput = (customValue: string) => {
    onChange(customValue);
    setSearchTerm(customValue);
  };

  const toggleCustom = () => {
    setIsCustom(!isCustom);
    if (!isCustom) {
      setSearchTerm(value);
    }
  };

  if (disabled) {
    return (
      <input
        type="text"
        value={value}
        disabled
        className="input disabled:bg-gray-50 disabled:text-gray-500"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="relative">
      {isCustom ? (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={value}
            onChange={(e) => handleCustomInput(e.target.value)}
            className="input flex-1"
            placeholder="Enter custom medical condition"
            autoFocus
          />
          <button
            onClick={toggleCustom}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
          >
            Select from list
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="input w-full text-left flex items-center justify-between"
            >
              <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                {value || placeholder}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Search conditions..."
                  autoFocus
                />
              </div>
              
              <div className="p-1">
                <button
                  onClick={toggleCustom}
                  className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 rounded-md flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enter custom condition</span>
                </button>
              </div>

              <div className="border-t border-gray-200">
                {filteredConditions.length > 0 ? (
                  filteredConditions.map((condition, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelect(condition)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      {condition}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No conditions found. Try entering a custom condition.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}