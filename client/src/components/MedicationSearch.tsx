import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, AlertCircle, Pill } from 'lucide-react';
import { drugApiService, DrugConcept, formatDrugName, extractDosageFromName } from '@/lib/drugApi';

interface MedicationSearchProps {
  onSelect: (medication: DrugConcept) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function MedicationSearch({ 
  onSelect, 
  placeholder = "Search for medications...", 
  className = "",
  disabled = false 
}: MedicationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugConcept[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for medications with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const searchResults = await drugApiService.searchDrugs(query, 10);
        
        if (searchResults.length === 0) {
          // Try approximate search if exact search returns no results
          const approximateResults = await drugApiService.searchDrugsApproximate(query, 10);
          setResults(approximateResults);
        } else {
          setResults(searchResults);
        }
        
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Error searching medications:', err);
        setError('Failed to search medications. Please try again.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (medication: DrugConcept) => {
    onSelect(medication);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const getMedicationDisplayInfo = (medication: DrugConcept) => {
    const name = formatDrugName(medication);
    const dosage = extractDosageFromName(name);
    
    return {
      name: name,
      dosage: dosage,
      type: medication.tty || 'Unknown',
      rxcui: medication.rxcui
    };
  };

  const getTypeDisplayName = (tty: string) => {
    const typeMap: Record<string, string> = {
      'SBD': 'Brand',
      'SCD': 'Generic',
      'GPCK': 'Generic Pack',
      'BPCK': 'Brand Pack',
      'IN': 'Ingredient',
      'PIN': 'Precise Ingredient',
      'MIN': 'Multiple Ingredient',
      'SCDC': 'Generic Component',
      'SBDC': 'Brand Component'
    };
    
    return typeMap[tty] || tty;
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          className={`
            input pl-10 pr-4
            ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
          `}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-center space-x-2 z-50">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto z-50">
          {results.map((medication, index) => {
            const info = getMedicationDisplayInfo(medication);
            const isSelected = index === selectedIndex;
            
            return (
              <button
                key={`${medication.rxcui}-${index}`}
                onClick={() => handleSelect(medication)}
                className={`
                  w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
                  border-b border-gray-100 last:border-b-0 transition-colors
                  ${isSelected ? 'bg-primary-50 border-primary-200' : ''}
                `}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Pill className="h-4 w-4 text-primary-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {info.name}
                      </p>
                      {info.dosage && (
                        <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                          {info.dosage}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {getTypeDisplayName(info.type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        RXCUI: {info.rxcui}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && query.trim().length >= 2 && results.length === 0 && !error && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500 z-50">
          <Pill className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No medications found for "{query}"</p>
          <p className="text-xs text-gray-400 mt-1">
            Try a different spelling or generic name
          </p>
        </div>
      )}
    </div>
  );
}