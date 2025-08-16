import React, { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Globe, Star, Clock, Plus, Check } from 'lucide-react';
import { GooglePlaceResult, MedicalSpecialty, MEDICAL_SPECIALTIES } from '@shared/types';
import { googlePlacesApi } from '@/lib/googlePlacesApi';

interface HealthcareProviderSearchProps {
  onSelect: (provider: GooglePlaceResult, specialty: string) => void;
  selectedProviders?: string[]; // Array of place_ids that are already selected
  searchType?: 'doctor' | 'hospital' | 'pharmacy' | 'health';
  placeholder?: string;
  className?: string;
}

export default function HealthcareProviderSearch({
  onSelect,
  selectedProviders = [],
  searchType = 'doctor',
  placeholder = "Search for healthcare providers...",
  className = ""
}: HealthcareProviderSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GooglePlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const results = await googlePlacesApi.searchHealthcareProviders({
        query: query,
        type: searchType
      });

      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching healthcare providers:', error);
      setError('Failed to search providers. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleProviderSelect = (provider: GooglePlaceResult) => {
    const inferredSpecialty = selectedSpecialty || googlePlacesApi.inferMedicalSpecialty(provider);
    onSelect(provider, inferredSpecialty);
    setSearchQuery('');
    setShowResults(false);
    setSelectedSpecialty('');
  };

  const isProviderSelected = (placeId: string) => {
    return selectedProviders.includes(placeId);
  };

  const renderProviderCard = (provider: GooglePlaceResult) => {
    const isSelected = isProviderSelected(provider.place_id);
    const inferredSpecialty = googlePlacesApi.inferMedicalSpecialty(provider);

    return (
      <div
        key={provider.place_id}
        className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
          isSelected 
            ? 'border-green-300 bg-green-50' 
            : 'border-gray-200 hover:border-primary-300'
        }`}
        onClick={() => !isSelected && handleProviderSelect(provider)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="font-semibold text-gray-900">{provider.name}</h4>
              {isSelected && (
                <Check className="w-5 h-5 text-green-600" />
              )}
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{provider.formatted_address}</span>
              </div>
              
              {provider.formatted_phone_number && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{provider.formatted_phone_number}</span>
                </div>
              )}
              
              {provider.website && (
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <a 
                    href={provider.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-4">
                {provider.rating && (
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium">{provider.rating}</span>
                    {provider.user_ratings_total && (
                      <span className="text-sm text-gray-500">
                        ({provider.user_ratings_total} reviews)
                      </span>
                    )}
                  </div>
                )}
                
                {provider.business_status && (
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    provider.business_status === 'OPERATIONAL' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {provider.business_status === 'OPERATIONAL' ? 'Open' : 'Closed'}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {inferredSpecialty}
              </div>
            </div>

            {provider.opening_hours?.open_now !== undefined && (
              <div className="flex items-center space-x-1 mt-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className={`text-sm ${
                  provider.opening_hours.open_now ? 'text-green-600' : 'text-red-600'
                }`}>
                  {provider.opening_hours.open_now ? 'Open now' : 'Closed now'}
                </span>
              </div>
            )}
          </div>

          {!isSelected && (
            <button
              className="ml-4 p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleProviderSelect(provider);
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          className="input pl-10 pr-4"
          placeholder={placeholder}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Specialty Filter */}
      {searchType === 'doctor' && showResults && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Specialty (Optional)
          </label>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="input"
          >
            <option value="">All Specialties</option>
            {MEDICAL_SPECIALTIES.map(specialty => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {showResults && (
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {searchResults.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  Search Results ({searchResults.length})
                </h3>
                <button
                  onClick={() => setShowResults(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Hide Results
                </button>
              </div>
              
              {searchResults
                .filter(provider => 
                  !selectedSpecialty || 
                  googlePlacesApi.inferMedicalSpecialty(provider) === selectedSpecialty
                )
                .map(renderProviderCard)
              }
            </>
          ) : (
            !isSearching && (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No healthcare providers found.</p>
                <p className="text-sm">Try adjusting your search terms.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Search Tips */}
      {!showResults && !searchQuery && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-1">Search Tips:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Try searching by doctor name, practice name, or specialty</li>
            <li>• Include location (e.g., "Dr. Smith cardiology downtown")</li>
            <li>• Use specific terms like "pediatrician" or "orthopedic surgeon"</li>
          </ul>
        </div>
      )}
    </div>
  );
}