import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter your address",
  className = ""
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAutocomplete = async () => {
      try {
        // Check if Google Maps API key is available
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          console.warn('🗺️ Google Maps API key not found. Address autocomplete will not be available.');
          console.log('Environment variables available:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
          setError('Google Maps API key not configured');
          return;
        }
        
        console.log('🗺️ Google Maps API key found, initializing autocomplete...');

        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        setIsLoaded(true);

        if (inputRef.current && !autocompleteRef.current) {
          // Create autocomplete instance
          autocompleteRef.current = new google.maps.places.Autocomplete(
            inputRef.current,
            {
              types: ['address'],
              componentRestrictions: { country: ['us', 'ca'] }, // Restrict to US and Canada
              fields: ['formatted_address', 'address_components', 'geometry']
            }
          );

          // Add place changed listener
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
              onChange(place.formatted_address);
            }
          });
        }
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
        setError('Failed to load Google Maps API');
      }
    };

    if (!disabled) {
      initializeAutocomplete();
    }

    return () => {
      // Cleanup autocomplete instance
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [disabled, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent form submission when Enter is pressed in autocomplete
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${className} ${error ? 'border-yellow-300' : ''}`}
        placeholder={error ? 'Enter your address manually' : placeholder}
        title={error ? error : undefined}
      />
      {error && !disabled && (
        <div className="mt-1 text-xs text-yellow-600">
          ⚠️ Address autocomplete unavailable. Please enter address manually.
        </div>
      )}
      {isLoaded && !error && !disabled && (
        <div className="mt-1 text-xs text-gray-500">
          💡 Start typing to see address suggestions
        </div>
      )}
    </div>
  );
}