import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Phone, Star, Check } from 'lucide-react';
import { googlePlacesApi } from '@/lib/googlePlacesApi';
import { GooglePlaceResult } from '@shared/types';

interface PharmacyAutocompleteProps {
  value?: string;
  onSelect: (pharmacy: GooglePlaceResult) => void;
  selectedPharmacyId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function PharmacyAutocomplete({
  value = '',
  onSelect,
  selectedPharmacyId,
  placeholder = 'Search for pharmacy...',
  disabled = false
}: PharmacyAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Could not get user location:', error);
        }
      );
    }
  }, []);

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const searchPharmacies = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await googlePlacesApi.searchHealthcareProviders({
        query: query + ' pharmacy',
        type: 'pharmacy',
        location: userLocation || undefined,
        radius: 25000 // 25km radius
      });

      // Filter to only pharmacies
      const pharmacies = searchResults.filter(result =>
        result.types.some(type =>
          type.toLowerCase().includes('pharmacy') ||
          type.toLowerCase().includes('drugstore')
        )
      );

      setResults(pharmacies);
      setShowResults(true);
    } catch (error) {
      console.error('Pharmacy search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      searchPharmacies(searchQuery);
    }, 500);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, searchPharmacies]);

  const handleSelect = (pharmacy: GooglePlaceResult) => {
    setSearchQuery(pharmacy.name);
    setShowResults(false);
    onSelect(pharmacy);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="input pl-10 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((pharmacy) => (
            <button
              key={pharmacy.place_id}
              onClick={() => handleSelect(pharmacy)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-gray-900">{pharmacy.name}</h4>
                    {selectedPharmacyId === pharmacy.place_id && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{pharmacy.formatted_address}</span>
                    </div>
                    
                    {pharmacy.formatted_phone_number && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{pharmacy.formatted_phone_number}</span>
                      </div>
                    )}
                    
                    {pharmacy.rating && (
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{pharmacy.rating}/5</span>
                        {pharmacy.user_ratings_total && (
                          <span className="text-gray-500">({pharmacy.user_ratings_total} reviews)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && !isSearching && searchQuery.length >= 2 && results.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No pharmacies found. Try a different search term.
        </div>
      )}
    </div>
  );
}