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
      // Load Google Maps API if not already loaded
      if (!window.google?.maps?.places) {
        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({
          apiKey: this.apiKey,
          version: 'weekly',
          libraries: ['places']
        });
        await loader.load();
      }
      
      this.isLoaded = true;
      console.log('🏥 Google Places API initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Places API:', error);
      return false;
    }
  }

  async searchHealthcareProviders(request: GooglePlaceSearchRequest): Promise<GooglePlaceResult[]> {
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

  async getPlaceDetails(placeId: string): Promise<GooglePlaceResult | null> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'formatted_phone_number',
          'website',
          'rating',
          'user_ratings_total',
          'business_status',
          'types',
          'geometry',
          'address_components',
          'opening_hours'
        ]
      };

      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(this.formatPlaceResult(place));
        } else {
          console.error('Place details request failed:', status);
          resolve(null);
        }
      });
    });
  }

  async searchNearbyHealthcare(
    location: { lat: number; lng: number },
    type: 'doctor' | 'hospital' | 'pharmacy' = 'doctor',
    radius: number = 10000
  ): Promise<GooglePlaceResult[]> {
    if (!await this.initialize()) {
      throw new Error('Google Places API not available');
    }

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        type: 'health' as any,
        keyword: type === 'doctor' ? 'doctor physician clinic' : 
                type === 'hospital' ? 'hospital medical center' : 
                'pharmacy drugstore'
      };

      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const formattedResults: GooglePlaceResult[] = results
            .filter(place => this.isHealthcareRelated(place))
            .map(place => this.formatPlaceResult(place))
            .slice(0, 15);
          
          resolve(formattedResults);
        } else {
          console.error('Nearby search failed:', status);
          reject(new Error(`Nearby search failed: ${status}`));
        }
      });
    });
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
}

export const googlePlacesApi = new GooglePlacesApiService();