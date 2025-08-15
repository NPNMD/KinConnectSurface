import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface AllergySelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Common food and drug allergies
const COMMON_ALLERGIES = [
  // Food Allergies
  'Peanuts',
  'Tree Nuts (Almonds, Walnuts, etc.)',
  'Milk/Dairy',
  'Eggs',
  'Wheat/Gluten',
  'Soy',
  'Fish',
  'Shellfish',
  'Sesame',
  'Corn',
  'Strawberries',
  'Tomatoes',
  'Chocolate',
  'Food Additives/Preservatives',
  
  // Drug Allergies
  'Penicillin',
  'Amoxicillin',
  'Sulfa Drugs',
  'Aspirin',
  'Ibuprofen',
  'Codeine',
  'Morphine',
  'Latex',
  'Contrast Dye',
  'Anesthesia',
  
  // Environmental Allergies
  'Pollen',
  'Dust Mites',
  'Pet Dander',
  'Mold',
  'Bee Stings',
  'Wasp Stings',
  'Nickel',
  'Fragrances/Perfumes',
  'Adhesive/Tape'
];

export default function AllergySelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select or enter allergy"
}: AllergySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const filteredAllergies = COMMON_ALLERGIES.filter(allergy =>
    allergy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (allergy: string) => {
    onChange(allergy);
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
            placeholder="Enter custom allergy"
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
                  placeholder="Search allergies..."
                  autoFocus
                />
              </div>
              
              <div className="p-1">
                <button
                  onClick={toggleCustom}
                  className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 rounded-md flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enter custom allergy</span>
                </button>
              </div>

              <div className="border-t border-gray-200">
                {filteredAllergies.length > 0 ? (
                  filteredAllergies.map((allergy, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelect(allergy)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      {allergy}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No allergies found. Try entering a custom allergy.
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