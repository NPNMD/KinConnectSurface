import { GooglePlaceResult, GooglePlaceSearchRequest } from '@shared/types';

class GooglePlacesApiService {
  private isLoaded = false;
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  }

  async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    
    if (!this.apiKey) {
      console.warn('🏥 Google Maps API key not found. Healthcare provider search will not be available.');
      return false;
    }

    try {
      // Load Google Maps API with the new Places library
      if (!window.google?.maps?.places) {
        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({
          apiKey: this.apiKey,
          version: 'weekly',
          libraries: ['places', 'marker'] // Include marker library for new Places API
        });
        await loader.load();
      }
      
      this.isLoaded = true;
      console.log('🏥 Google Places API (New) initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Places API:', error);
      return false;
    }
  }

  async searchHealthcareProviders(request: GooglePlaceSearchRequest): Promise<GooglePlaceResult[]> {
    // Try the new Places API first, with fallback to legacy API
    try {
      return await this.searchHealthcareProvidersNew(request);
    } catch (error) {
      console.warn('🏥 New Places API failed, falling back to legacy API:', error);
      return await this.searchHealthcareProvidersLegacy(request);
    }
  }

  private async searchHealthcareProvidersNew(request: GooglePlaceSearchRequest): Promise<GooglePlaceResult[]> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    // Use the new Places API (Text Search)
    let query = request.query;
    if (request.type === 'doctor') {
      query += ' doctor physician medical clinic';
    } else if (request.type === 'hospital') {
      query += ' hospital medical center';
    } else if (request.type === 'pharmacy') {
      query += ' pharmacy drugstore';
    } else if (request.type === 'health') {
      query += ' medical health clinic';
    }

    // Build the request for the new Places API
    const searchRequest = {
      textQuery: query,
      maxResultCount: 20,
      ...(request.location && {
        locationBias: {
          circle: {
            center: {
              latitude: request.location.lat,
              longitude: request.location.lng
            },
            radius: request.radius || 25000
          }
        }
      })
    };

    // Correct field mask format for new Places API
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.nationalPhoneNumber',
      'places.websiteUri',
      'places.rating',
      'places.userRatingCount',
      'places.businessStatus',
      'places.types',
      'places.location',
      'places.addressComponents',
      'places.currentOpeningHours'
    ].join(',');

    // Use fetch API to call the new Places API
    const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey!,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(searchRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🏥 New Places API error:', response.status, errorText);
      throw new Error(`Places API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.places) {
      return [];
    }

    const formattedResults: GooglePlaceResult[] = data.places
      .filter((place: any) => this.isHealthcareRelatedNew(place))
      .map((place: any) => this.formatPlaceResultNew(place))
      .slice(0, 20);
    
    return formattedResults;
  }

  async getPlaceDetails(placeId: string): Promise<GooglePlaceResult | null> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    try {
      // Use the new Places API for place details
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.apiKey!,
          'X-Goog-FieldMask': [
            'id',
            'displayName',
            'formattedAddress',
            'nationalPhoneNumber',
            'websiteUri',
            'rating',
            'userRatingCount',
            'businessStatus',
            'types',
            'location',
            'addressComponents',
            'currentOpeningHours'
          ].join(',')
        }
      });

      if (!response.ok) {
        console.error('Place details request failed:', response.status);
        return null;
      }

      const place = await response.json();
      return this.formatPlaceResultNew(place);
    } catch (error) {
      console.error('Place details request failed:', error);
      return null;
    }
  }

  async searchNearbyHealthcare(
    location: { lat: number; lng: number },
    type: 'doctor' | 'hospital' | 'pharmacy' = 'doctor',
    radius: number = 10000
  ): Promise<GooglePlaceResult[]> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    try {
      // Use the new Places API for nearby search
      const keyword = type === 'doctor' ? 'doctor physician clinic' :
                     type === 'hospital' ? 'hospital medical center' :
                     'pharmacy drugstore';

      const searchRequest = {
        textQuery: keyword,
        maxResultCount: 15,
        locationBias: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng
            },
            radius: radius
          }
        }
      };

      // Correct field mask format for new Places API
      const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.rating',
        'places.userRatingCount',
        'places.businessStatus',
        'places.types',
        'places.location',
        'places.addressComponents',
        'places.currentOpeningHours'
      ].join(',');

      const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey!,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(searchRequest)
      });

      if (!response.ok) {
        throw new Error(`Places API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.places) {
        return [];
      }

      const formattedResults: GooglePlaceResult[] = data.places
        .filter((place: any) => this.isHealthcareRelatedNew(place))
        .map((place: any) => this.formatPlaceResultNew(place))
        .slice(0, 15);
      
      return formattedResults;
    } catch (error) {
      console.error('Nearby search failed:', error);
      throw new Error(`Nearby search failed: ${error}`);
    }
  }

  private isHealthcareRelated(place: google.maps.places.PlaceResult): boolean {
    const healthcareTypes = [
      'doctor',
      'hospital',
      'pharmacy',
      'health',
      'dentist',
      'physiotherapist',
      'veterinary_care'
    ];

    const healthcareKeywords = [
      'medical',
      'clinic',
      'hospital',
      'doctor',
      'physician',
      'pharmacy',
      'health',
      'dental',
      'therapy',
      'care'
    ];

    // Check if place types include healthcare-related types
    const hasHealthcareType = place.types?.some(type =>
      healthcareTypes.includes(type)
    );

    // Check if place name includes healthcare keywords
    const hasHealthcareKeyword = healthcareKeywords.some(keyword =>
      place.name?.toLowerCase().includes(keyword)
    );

    return hasHealthcareType || hasHealthcareKeyword;
  }

  // New method for the new Places API format
  private isHealthcareRelatedNew(place: any): boolean {
    const healthcareTypes = [
      'doctor',
      'hospital',
      'pharmacy',
      'health',
      'dentist',
      'physiotherapist',
      'veterinary_care'
    ];

    const healthcareKeywords = [
      'medical',
      'clinic',
      'hospital',
      'doctor',
      'physician',
      'pharmacy',
      'health',
      'dental',
      'therapy',
      'care'
    ];

    // Check if place types include healthcare-related types
    const hasHealthcareType = place.types?.some((type: string) =>
      healthcareTypes.includes(type.toLowerCase())
    );

    // Check if place name includes healthcare keywords
    const hasHealthcareKeyword = healthcareKeywords.some(keyword =>
      place.displayName?.text?.toLowerCase().includes(keyword)
    );

    return hasHealthcareType || hasHealthcareKeyword;
  }

  private formatPlaceResult(place: google.maps.places.PlaceResult): GooglePlaceResult {
    return {
      place_id: place.place_id!,
      name: place.name!,
      formatted_address: place.formatted_address!,
      formatted_phone_number: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      business_status: place.business_status as any,
      types: place.types || [],
      geometry: {
        location: {
          lat: place.geometry!.location!.lat(),
          lng: place.geometry!.location!.lng()
        }
      },
      address_components: place.address_components?.map(component => ({
        long_name: component.long_name,
        short_name: component.short_name,
        types: component.types
      })) || [],
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now || false,
        weekday_text: place.opening_hours.weekday_text || []
      } : undefined
    };
  }

  // New method for the new Places API format
  private formatPlaceResultNew(place: any): GooglePlaceResult {
    return {
      place_id: place.id,
      name: place.displayName?.text || '',
      formatted_address: place.formattedAddress || '',
      formatted_phone_number: place.nationalPhoneNumber,
      website: place.websiteUri,
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      business_status: place.businessStatus,
      types: place.types || [],
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0
        }
      },
      address_components: place.addressComponents?.map((component: any) => ({
        long_name: component.longText,
        short_name: component.shortText,
        types: component.types
      })) || [],
      opening_hours: place.currentOpeningHours ? {
        open_now: place.currentOpeningHours.openNow || false,
        weekday_text: place.currentOpeningHours.weekdayDescriptions || []
      } : undefined
    };
  }

  // Utility method to extract address components
  extractAddressComponents(addressComponents: GooglePlaceResult['address_components']) {
    const components = {
      streetNumber: '',
      route: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    };

    addressComponents.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        components.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        components.route = component.long_name;
      } else if (types.includes('locality')) {
        components.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.state = component.short_name;
      } else if (types.includes('postal_code')) {
        components.zipCode = component.long_name;
      } else if (types.includes('country')) {
        components.country = component.long_name;
      }
    });

    return components;
  }

  // Method to determine likely medical specialty from place data
  inferMedicalSpecialty(place: GooglePlaceResult): string {
    const name = place.name.toLowerCase();
    const types = place.types.map(t => t.toLowerCase());

    // Specialty keywords mapping
    const specialtyKeywords: Record<string, string[]> = {
      'Cardiology': ['cardio', 'heart', 'cardiac'],
      'Dermatology': ['dermat', 'skin'],
      'Orthopedics': ['orthop', 'bone', 'joint', 'sports medicine'],
      'Pediatrics': ['pediatr', 'children', 'kids'],
      'Obstetrics/Gynecology': ['obgyn', 'ob/gyn', 'women', 'gynec'],
      'Ophthalmology': ['eye', 'vision', 'ophthal'],
      'Dentistry': ['dental', 'dentist', 'teeth'],
      'Physical Therapy': ['physical therapy', 'pt ', 'rehab'],
      'Psychiatry': ['psychiatr', 'mental health', 'behavioral'],
      'Radiology': ['imaging', 'radiology', 'mri', 'ct scan'],
      'Emergency Medicine': ['emergency', 'urgent care', 'er '],
      'Internal Medicine': ['internal medicine', 'internist'],
      'Family Medicine': ['family medicine', 'family practice']
    };

    // Check for specialty keywords in name
    for (const [specialty, keywords] of Object.entries(specialtyKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return specialty;
      }
    }

    // Check types for specific healthcare categories
    if (types.includes('dentist')) return 'Dentistry';
    if (types.includes('pharmacy')) return 'Pharmacy';
    if (types.includes('hospital')) return 'Hospital';

    // Default based on common healthcare types
    if (types.includes('doctor') || name.includes('clinic')) {
      return 'Primary Care';
    }

    return 'Other';
  }

  // Legacy method as fallback
  private async searchHealthcareProvidersLegacy(request: GooglePlaceSearchRequest): Promise<GooglePlaceResult[]> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      // Build search query with healthcare-specific terms
      let query = request.query;
      if (request.type === 'doctor') {
        query += ' doctor physician medical clinic';
      } else if (request.type === 'hospital') {
        query += ' hospital medical center';
      } else if (request.type === 'pharmacy') {
        query += ' pharmacy drugstore';
      } else if (request.type === 'health') {
        query += ' medical health clinic';
      }

      const searchRequest: google.maps.places.TextSearchRequest = {
        query: query,
        type: 'health' as any, // Force health-related results
        ...(request.location && {
          location: new google.maps.LatLng(request.location.lat, request.location.lng),
          radius: request.radius || 25000 // 25km default radius
        })
      };

      service.textSearch(searchRequest, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const formattedResults: GooglePlaceResult[] = results
            .filter(place => this.isHealthcareRelated(place))
            .map(place => this.formatPlaceResult(place))
            .slice(0, 20); // Limit to 20 results
          
          resolve(formattedResults);
        } else {
          console.error('Places search failed:', status);
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }
}

export const googlePlacesApi = new GooglePlacesApiService();