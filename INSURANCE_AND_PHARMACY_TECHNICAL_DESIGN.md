# Technical Design Specification: Insurance Cards & Preferred Pharmacy

**Version:** 1.0  
**Date:** 2025-10-03  
**Author:** Architect Mode  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature 1: Insurance Card/Info for Patient Profile](#feature-1-insurance-cardinfo-for-patient-profile)
3. [Feature 2: Preferred Pharmacy with Google Places](#feature-2-preferred-pharmacy-with-google-places)
4. [Implementation Sequence](#implementation-sequence)
5. [Security Considerations](#security-considerations)
6. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This document provides comprehensive technical specifications for two patient profile enhancements:

1. **Insurance Card Management**: Upload, store, and manage insurance card images with metadata
2. **Preferred Pharmacy Selection**: Search and designate preferred pharmacy using Google Places API

Both features follow existing architectural patterns from the codebase, particularly:
- File upload patterns from [`useVisitRecording.ts`](client/src/hooks/useVisitRecording.ts:1-303)
- UI patterns from [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686)
- Google Places integration from [`googlePlacesApi.ts`](client/src/lib/googlePlacesApi.ts:1-504)
- Healthcare provider management from [`HealthcareProvidersManager.tsx`](client/src/components/HealthcareProvidersManager.tsx:1-1429)

---

## Feature 1: Insurance Card/Info for Patient Profile

### 1.1 Type Definitions

#### 1.1.1 Update `shared/types.ts`

Add the following type definitions after the existing Patient interface (around line 62):

```typescript
// Insurance Information Types
export interface InsuranceInformation {
  id: string;
  patientId: string;
  
  // Insurance Details
  insuranceType: 'primary' | 'secondary' | 'tertiary';
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'self' | 'spouse' | 'parent' | 'child' | 'other';
  subscriberId?: string;
  
  // Coverage Dates
  effectiveDate?: Date;
  expirationDate?: Date;
  
  // Card Images
  cardFrontUrl?: string;
  cardBackUrl?: string;
  cardFrontStoragePath?: string;
  cardBackStoragePath?: string;
  
  // Additional Information
  customerServicePhone?: string;
  claimsAddress?: string;
  rxBin?: string; // Prescription Bin Number
  rxPcn?: string; // Prescription Processor Control Number
  rxGroup?: string; // Prescription Group Number
  
  // Status
  isActive: boolean;
  isPrimary: boolean; // Quick flag for primary insurance
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface NewInsuranceInformation {
  patientId: string;
  insuranceType: 'primary' | 'secondary' | 'tertiary';
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'self' | 'spouse' | 'parent' | 'child' | 'other';
  subscriberId?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  customerServicePhone?: string;
  claimsAddress?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  isActive: boolean;
  isPrimary: boolean;
  notes?: string;
  createdBy: string;
}

// Insurance Card Upload Types
export interface InsuranceCardUploadState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  frontStoragePath?: string;
  backStoragePath?: string;
}

export interface InsuranceCardUploadOptions {
  patientId: string;
  insuranceId: string;
  side: 'front' | 'back';
  file: File;
  onProgress?: (progress: number) => void;
  onComplete?: (url: string, storagePath: string) => void;
  onError?: (error: string) => void;
}
```

#### 1.1.2 Update Patient Interface

Add insurance reference to the Patient interface (around line 49):

```typescript
export interface Patient {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalConditions?: string[];
  allergies?: string[];
  
  // Insurance Information
  primaryInsuranceId?: string; // Reference to primary insurance
  hasInsurance?: boolean; // Quick flag
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 1.2 Firebase Storage Structure

```
patient-insurance-cards/
  {patientId}/
    {insuranceId}/
      front.jpg          # Front of insurance card
      back.jpg           # Back of insurance card
      front_thumb.jpg    # Thumbnail (optional)
      back_thumb.jpg     # Thumbnail (optional)
```

### 1.3 Firestore Security Rules

Add to [`firestore.rules`](firestore.rules:1-395) after line 72:

```javascript
// Insurance Information - patients can manage their own
match /insurance_information/{insuranceId} {
  allow read: if request.auth != null && (
    // Patient owns the insurance record
    resource.data.patientId == request.auth.uid ||
    // Family member has access to the patient
    exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)) &&
    get(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)).data.permissions.canViewMedicalDetails == true &&
    get(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)).data.status == 'active'
  );
  
  allow create: if request.auth != null && (
    request.resource.data.patientId == request.auth.uid &&
    request.resource.data.createdBy == request.auth.uid
  );
  
  allow update: if request.auth != null && (
    resource.data.patientId == request.auth.uid &&
    request.resource.data.updatedBy == request.auth.uid
  );
  
  allow delete: if request.auth != null && resource.data.patientId == request.auth.uid;
}
```

Add Firebase Storage rules (create/update `storage.rules`):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Insurance card images
    match /patient-insurance-cards/{patientId}/{insuranceId}/{imageFile} {
      // Allow read if user owns the patient record or has family access
      allow read: if request.auth != null && (
        request.auth.uid == patientId ||
        exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId))
      );
      
      // Allow write only by the patient
      allow write: if request.auth != null && 
        request.auth.uid == patientId &&
        // Validate file type (images only)
        request.resource.contentType.matches('image/.*') &&
        // Limit file size to 10MB
        request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

### 1.4 Custom Hook: `useInsuranceUpload.ts`

Create `client/src/hooks/useInsuranceUpload.ts` (pattern from [`useVisitRecording.ts`](client/src/hooks/useVisitRecording.ts:1-303)):

```typescript
import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { InsuranceCardUploadState, InsuranceCardUploadOptions } from '@shared/types';

export const useInsuranceUpload = () => {
  const [uploadState, setUploadState] = useState<InsuranceCardUploadState>({
    status: 'idle'
  });

  const uploadInsuranceCard = useCallback(async (options: InsuranceCardUploadOptions) => {
    const { patientId, insuranceId, side, file, onProgress, onComplete, onError } = options;

    try {
      setUploadState({ status: 'uploading', progress: 0 });

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Compress image if needed (optional enhancement)
      const processedFile = await compressImage(file);

      // Create storage reference
      const storagePath = `patient-insurance-cards/${patientId}/${insuranceId}/${side}.jpg`;
      const storageRef = ref(storage, storagePath);

      // Upload file
      const snapshot = await uploadBytes(storageRef, processedFile, {
        contentType: file.type,
        customMetadata: {
          patientId,
          insuranceId,
          side,
          uploadedAt: new Date().toISOString()
        }
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);

      setUploadState({
        status: 'completed',
        progress: 100,
        ...(side === 'front' 
          ? { frontImageUrl: downloadUrl, frontStoragePath: storagePath }
          : { backImageUrl: downloadUrl, backStoragePath: storagePath }
        )
      });

      onComplete?.(downloadUrl, storagePath);

      return { url: downloadUrl, storagePath };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to upload insurance card';
      setUploadState({ status: 'error', error: errorMessage });
      onError?.(errorMessage);
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setUploadState({ status: 'idle' });
  }, []);

  return {
    uploadState,
    uploadInsuranceCard,
    reset
  };
};

// Helper function to compress images
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Max dimensions
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.85 // Quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
```

### 1.5 Component: `InsuranceCardUploader.tsx`

Create `client/src/components/InsuranceCardUploader.tsx`:

```typescript
import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react';
import { useInsuranceUpload } from '@/hooks/useInsuranceUpload';

interface InsuranceCardUploaderProps {
  patientId: string;
  insuranceId: string;
  side: 'front' | 'back';
  existingImageUrl?: string;
  onUploadComplete: (url: string, storagePath: string) => void;
  onRemove?: () => void;
}

export default function InsuranceCardUploader({
  patientId,
  insuranceId,
  side,
  existingImageUrl,
  onUploadComplete,
  onRemove
}: InsuranceCardUploaderProps) {
  const [preview, setPreview] = useState<string | null>(existingImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadState, uploadInsuranceCard } = useInsuranceUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      const result = await uploadInsuranceCard({
        patientId,
        insuranceId,
        side,
        file,
        onComplete: onUploadComplete
      });
    } catch (error) {
      console.error('Upload failed:', error);
      setPreview(existingImageUrl || null);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const isUploading = uploadState.status === 'uploading';

  return (
    <div className="space-y-2">
      <label className="label">
        {side === 'front' ? 'Front of Card' : 'Back of Card'}
      </label>
      
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={`Insurance card ${side}`}
            className="w-full h-48 object-cover rounded-lg border border-gray-200"
          />
          {!isUploading && (
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white text-sm">
                Uploading... {uploadState.progress}%
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
        >
          <div className="flex flex-col items-center space-y-2">
            <div className="flex space-x-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <Camera className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">
              Click to upload or take photo
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG up to 10MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploadState.error && (
        <p className="text-sm text-red-600">{uploadState.error}</p>
      )}
    </div>
  );
}
```

### 1.6 Component: `InsuranceCardViewer.tsx`

Create `client/src/components/InsuranceCardViewer.tsx`:

```typescript
import React, { useState } from 'react';
import { CreditCard, X, ZoomIn } from 'lucide-react';
import { InsuranceInformation } from '@shared/types';

interface InsuranceCardViewerProps {
  insurance: InsuranceInformation;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function InsuranceCardViewer({
  insurance,
  onEdit,
  onDelete
}: InsuranceCardViewerProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'front' | 'back' | null>(null);

  const openImageModal = (side: 'front' | 'back') => {
    setSelectedImage(side);
    setShowImageModal(true);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-primary-600" />
            <div>
              <h4 className="font-semibold text-gray-900">
                {insurance.providerName}
                {insurance.isPrimary && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                    Primary
                  </span>
                )}
              </h4>
              <p className="text-sm text-gray-600">
                {insurance.insuranceType.charAt(0).toUpperCase() + insurance.insuranceType.slice(1)} Insurance
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-500">Policy Number:</span>
            <p className="font-medium">{insurance.policyNumber}</p>
          </div>
          {insurance.groupNumber && (
            <div>
              <span className="text-gray-500">Group Number:</span>
              <p className="font-medium">{insurance.groupNumber}</p>
            </div>
          )}
          {insurance.subscriberName && (
            <div>
              <span className="text-gray-500">Subscriber:</span>
              <p className="font-medium">{insurance.subscriberName}</p>
            </div>
          )}
          {insurance.customerServicePhone && (
            <div>
              <span className="text-gray-500">Customer Service:</span>
              <p className="font-medium">{insurance.customerServicePhone}</p>
            </div>
          )}
        </div>

        {/* Insurance Card Images */}
        {(insurance.cardFrontUrl || insurance.cardBackUrl) && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {insurance.cardFrontUrl && (
              <div className="relative group">
                <img
                  src={insurance.cardFrontUrl}
                  alt="Insurance card front"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer"
                  onClick={() => openImageModal('front')}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">Front</p>
              </div>
            )}
            {insurance.cardBackUrl && (
              <div className="relative group">
                <img
                  src={insurance.cardBackUrl}
                  alt="Insurance card back"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer"
                  onClick={() => openImageModal('back')}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">Back</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage === 'front' ? insurance.cardFrontUrl : insurance.cardBackUrl}
              alt={`Insurance card ${selectedImage}`}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
```

### 1.7 Integration into PatientProfile.tsx

Add to [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686) after the Healthcare Providers section (around line 636):

```typescript
{/* Insurance Information Section */}
<div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900">Insurance Information</h2>
    <button
      onClick={() => setIsAddingInsurance(true)}
      className="btn-primary flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Add Insurance</span>
    </button>
  </div>

  {insuranceCards.length > 0 ? (
    <div className="space-y-4">
      {insuranceCards.map((insurance) => (
        <InsuranceCardViewer
          key={insurance.id}
          insurance={insurance}
          onEdit={() => handleEditInsurance(insurance)}
          onDelete={() => handleDeleteInsurance(insurance.id)}
        />
      ))}
    </div>
  ) : (
    <div className="text-center py-8">
      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">No insurance information added</p>
    </div>
  )}
</div>
```

### 1.8 API Endpoints

Add to `client/src/lib/api.ts`:

```typescript
// Insurance endpoints
INSURANCE_LIST: (patientId: string) => `/api/insurance/${patientId}`,
INSURANCE_CREATE: '/api/insurance',
INSURANCE_BY_ID: (insuranceId: string) => `/api/insurance/${insuranceId}`,
INSURANCE_UPDATE: (insuranceId: string) => `/api/insurance/${insuranceId}`,
INSURANCE_DELETE: (insuranceId: string) => `/api/insurance/${insuranceId}`,
```

---

## Feature 2: Preferred Pharmacy with Google Places

### 2.1 Type Definitions

#### 2.1.1 Update Patient Interface

Add pharmacy reference to Patient interface in [`shared/types.ts`](shared/types.ts:38-50):

```typescript
export interface Patient {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalConditions?: string[];
  allergies?: string[];
  
  // Insurance Information
  primaryInsuranceId?: string;
  hasInsurance?: boolean;
  
  // Preferred Pharmacy
  preferredPharmacyId?: string; // Reference to MedicalFacility with facilityType: 'pharmacy'
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Component: `PharmacyAutocomplete.tsx`

Create `client/src/components/PharmacyAutocomplete.tsx` (pattern from [`HealthcareProviderSearch`](client/src/components/HealthcareProvidersManager.tsx:556-565)):

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Phone, Star, Check } from 'lucide-react';
import { googlePlacesApi } from '@/lib/googlePlacesApi';
import { GooglePlaceResult } from '@shared/types';
import debounce from 'lodash/debounce';

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

  const searchPharmacies = useCallback(
    debounce(async (query: string) => {
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
    }, 500),
    [userLocation]
  );

  useEffect(() => {
    searchPharmacies(searchQuery);
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
```

### 2.3 Integration into PatientProfile.tsx

Add pharmacy section to [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686) after insurance section:

```typescript
{/* Preferred Pharmacy Section */}
<div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferred Pharmacy</h2>
  
  {preferredPharmacy ? (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            <h3 className="font-medium text-gray-900">{preferredPharmacy.name}</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Preferred
            </span>
          </div>
          
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{preferredPharmacy.address}</span>
            </div>
            
            {preferredPharmacy.phoneNumber && (
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{preferredPharmacy.phoneNumber}</span>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setIsChangingPharmacy(true)}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Change
        </button>
      </div>
    </div>
  ) : (
    <div>
      <PharmacyAutocomplete
        onSelect={handlePharmacySelect}
        placeholder="Search for your preferred pharmacy..."
      />
      <p className="text-sm text-gray-500 mt-2">
        Select a pharmacy for easier prescription management
      </p>
    </div>
  )}
</div>
```

### 2.4 Backend Logic

The pharmacy will be stored as a `MedicalFacility` with `facilityType: 'pharmacy'` and `isPreferred: true`. The Patient record will store a reference via `preferredPharmacyId`.

**Handler logic** (pseudo-code for backend):

```typescript
// When user selects a pharmacy from Google Places
async function setPreferredPharmacy(patientId: string, googlePlace: GooglePlaceResult) {
  // 1. Check if pharmacy already exists in medical_facilities
  let pharmacy = await findFacilityByPlaceId(googlePlace.place_id);
  
  // 2. If not, create new MedicalFacility
  if (!pharmacy) {
    pharmacy = await createMedicalFacility({
      patientId,
      name: googlePlace.name,
      facilityType: 'pharmacy',
      address: googlePlace.formatted_address,
      placeId: googlePlace.place_id,
      phoneNumber: googlePlace.formatted_phone_number,
      // ... other fields from Google Places
      isPreferred: true,
      isActive: true
    });
  } else {
    // 3. Update existing to mark as preferred
    await updateMedicalFacility(pharmacy.id, { isPreferred: true });
  }
  
  // 4. Unmark any other pharmacies as preferred
  await unmarkOtherPharmaciesAsPreferred(patientId, pharmacy.id);
  
  // 5. Update Patient record with preferredPharmacyId
  await updatePatient(patientId, { preferredPharmacyId: pharmacy.id });
  
  return pharmacy;
}
```

---

## Implementation Sequence

### Phase 1: Insurance Card Feature (Week 1-2)

1. **Day 1-2: Type Definitions & Database Setup**
   - [ ] Add `InsuranceInformation` types to [`shared/types.ts`](shared/types.ts:1-2661)
   - [ ] Update Patient interface with insurance fields
   - [ ] Update Firestore security rules
   - [ ] Create Firebase Storage security rules

2. **Day 3-4: Core Upload Functionality**
   - [ ] Create `useInsuranceUpload.ts` hook
   - [ ] Implement image compression utility
   - [ ] Test upload flow with Firebase Storage

3. **Day 5-7: UI Components**
   - [ ] Create `InsuranceCardUploader.tsx` component
   - [ ] Create `InsuranceCardViewer.tsx` component
   - [ ] Add mobile camera capture support

4. **Day 8-10: Integration & API**
   - [ ] Integrate into [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686)
   - [ ] Create backend API endpoints
   - [ ] Implement CRUD operations
   - [ ] Add validation and error handling

### Phase 2: Preferred Pharmacy Feature (Week 3)

1. **Day 1-2: Type Updates & Google Places Integration**
   - [ ] Update Patient type with `preferredPharmacyId`
   - [ ] Extend [`googlePlacesApi.ts`](client/src/lib/googlePlacesApi.ts:1-504) for pharmacy search
   - [ ] Test pharmacy search functionality

2. **Day 3-4: Pharmacy Component**
   - [ ] Create `PharmacyAutocomplete.tsx` component
   - [ ] Implement debounced search
   - [ ] Add location-based results

3. **Day 5-7: Integration & Backend**
   - [ ] Integrate into [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686)
   - [ ] Create backend logic for pharmacy selection
   - [ ] Link with existing `MedicalFacility` structure
   - [ ] Update API endpoints

### Phase 3: Testing & Polish (Week 4)

1. **Day 1-3: Testing**
   - [ ] Unit tests for upload hook
   - [ ] Integration tests for components
   - [ ] E2E tests for complete flows
   - [ ] Mobile device testing

2. **Day 4-5: Documentation & Deployment**
   - [ ] Update user documentation
   - [ ] Create deployment checklist
   - [ ] Deploy to staging
   - [ ] Final QA and production deployment

---

## Security Considerations

### 1. Insurance Card Images

**Privacy & Compliance:**
- Insurance cards contain PHI (Protected Health Information)
- Must comply with HIPAA regulations
- Implement encryption at rest (Firebase Storage default)
- Implement encryption in transit (HTTPS)

**Access Control:**
- Only patient and authorized family members can view
- Implement audit logging for access
- Auto-expire shared links (if implemented)

**Data Retention:**
- Define retention policy (e.g., delete after 7 years)
- Implement soft delete with recovery period
- Provide patient-initiated deletion

### 2. File Upload Security

**Validation:**
- File type validation (images only)
- File size limits (10MB max)
- Image dimension validation
- Malware scanning (optional enhancement)

**Storage:**
- Unique file paths per patient/insurance
- No predictable URLs
- Signed URLs for temporary access (optional)

### 3. Pharmacy Data

**Google Places API:**
- API key restrictions (HTTP referrer, IP)
- Rate limiting implementation
- Caching to reduce API calls

**Data Storage:**
- Store minimal pharmacy data
- Link to Google Places for updates
- Validate pharmacy still exists periodically

---

## Testing Strategy

### Unit Tests

```typescript
// useInsuranceUpload.test.ts
describe('useInsuranceUpload', () => {
  it('should upload insurance card image', async () => {
    // Test upload functionality
  });
  
  it('should compress large images', async () => {
    // Test compression
  });
  
  it('should handle upload errors', async () => {
    // Test error handling
  });
});

// PharmacyAutocomplete.test.ts
describe('PharmacyAutocomplete', () => {
  it('should search for pharmacies', async () => {
    // Test search
  });
  
  it('should filter results to pharmacies only', async () => {
    // Test filtering
  });
  
  it('should handle location-based search', async () => {
    // Test geolocation
  });
});
```

### Integration Tests

```typescript
// Insurance card flow
describe('Insurance Card Management', () => {
  it('should upload and display insurance card', async () => {
    // 1. Upload front image
    // 2. Upload back image
    // 3. Verify display
    // 4. Verify storage
  });
  
  it('should update insurance information', async () => {
    // Test update flow
  });
  
  it('should delete insurance card', async () => {
    // Test deletion
  });
});

// Pharmacy selection flow
describe('Preferred Pharmacy Selection', () => {
  it('should search and select pharmacy', async () => {
    // 1. Search for pharmacy
    // 2. Select from results
    // 3. Verify saved as preferred
    // 4. Verify displayed in profile
  });
  
  it('should change preferred pharmacy', async () => {
    // Test changing pharmacy
  });
});
```

### E2E Tests

```typescript
// Full user flow
describe('Patient Profile - Insurance & Pharmacy', () => {
  it('should complete insurance setup', async () => {
    // Navigate to profile
    // Add insurance
    // Upload cards
    // Verify completion
  });
  
  it('should set preferred pharmacy', async () => {
    // Navigate to profile
    // Search pharmacy
    // Select pharmacy
    // Verify saved
  });
});
```

---

## User Experience Flow Diagrams

### Insurance Card Upload Flow

```
[Patient Profile Page]
        ↓
[Click "Add Insurance"]
        ↓
[Insurance Form Modal]
    ├── Enter provider name
    ├── Enter policy number
    ├── Enter group number
    └── Upload card images
        ├── [Front Card Upload]
        │   ├── Click upload area
        │   ├── Select file or take photo
        │   ├── Preview image
        │   └── Auto-upload to Firebase
        └── [Back Card Upload]
            ├── Click upload area
            ├── Select file or take photo
            ├── Preview image
            └── Auto-upload to Firebase
        ↓
[Save Insurance Information]
        ↓
[Display in Profile with Card Images]
        ↓
[Click to View Full Size]
```

### Pharmacy Selection Flow

```
[Patient Profile Page]
        ↓
[Preferred Pharmacy Section]
        ↓
[Search Pharmacy Input]
    ├── Type pharmacy name
    ├── Get user location (optional)
    └── Search Google Places
        ↓
[Display Results]
    ├── Show nearby pharmacies
    ├── Display address, phone, rating
    └── Filter to pharmacies only
        ↓
[Select Pharmacy]
        ↓
[Save as MedicalFacility]
    ├── Create or update facility
    ├── Mark as preferred
    └── Link to Patient record
        ↓
[Display in Profile]
    ├── Show pharmacy details
    ├── Show "Preferred" badge
    └── Option to change
```

---

## File Structure Summary

### New Files to Create

```
client/src/
  hooks/
    useInsuranceUpload.ts                    # Insurance card upload hook
  
  components/
    InsuranceCardUploader.tsx                # Upload component
    InsuranceCardViewer.tsx                  # Display component
    PharmacyAutocomplete.tsx                 # Pharmacy search component

functions/src/
  api/
    insuranceApi.ts                          # Insurance CRUD endpoints
    pharmacyApi.ts                           # Pharmacy selection logic

storage.rules                                # Firebase Storage security rules
```

### Files to Modify

```
shared/
  types.ts                                   # Add insurance & pharmacy types

client/src/
  pages/
    PatientProfile.tsx                       # Add insurance & pharmacy sections
  
  lib/
    api.ts                                   # Add insurance API endpoints
    googlePlacesApi.ts                       # Enhance pharmacy search

firestore.rules                              # Add insurance security rules
```

---

## API Endpoints Summary

### Insurance Endpoints

```typescript
GET    /api/insurance/:patientId           # List all insurance for patient
POST   /api/insurance                       # Create new insurance
GET    /api/insurance/:insuranceId          # Get specific insurance
PUT    /api/insurance/:insuranceId          # Update insurance
DELETE /api/insurance/:insuranceId          # Delete insurance
```

### Pharmacy Endpoints

```typescript
POST   /api/patient/:patientId/pharmacy     # Set preferred pharmacy
GET    /api/patient/:patientId/pharmacy     # Get preferred pharmacy
DELETE /api/patient/:patientId/pharmacy     # Remove preferred pharmacy
```

---

## Database Schema Updates

### Firestore Collections

**insurance_information** (new collection)
```typescript
{
  id: string,
  patientId: string,
  insuranceType: 'primary' | 'secondary' | 'tertiary',
  providerName: string,
  policyNumber: string,
  groupNumber?: string,
  cardFrontUrl?: string,
  cardBackUrl?: string,
  cardFrontStoragePath?: string,
  cardBackStoragePath?: string,
  isPrimary: boolean,
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**patients** (update existing)
```typescript
{
  // ... existing fields
  primaryInsuranceId?: string,
  hasInsurance?: boolean,
  preferredPharmacyId?: string,  // References medical_facilities
}
```

**medical_facilities** (use existing, filter by facilityType: 'pharmacy')
```typescript
{
  // ... existing fields
  facilityType: 'pharmacy',
  isPreferred: boolean,  // Mark preferred pharmacy
}
```

---

## Conclusion

This technical design provides a complete blueprint for implementing both insurance card management and preferred pharmacy selection features. The design:

1. **Follows Existing Patterns**: Leverages proven patterns from [`useVisitRecording.ts`](client/src/hooks/useVisitRecording.ts:1-303), [`PatientProfile.tsx`](client/src/pages/PatientProfile.tsx:1-686), and [`HealthcareProvidersManager.tsx`](client/src/components/HealthcareProvidersManager.tsx:1-1429)

2. **Maintains Consistency**: Uses the same type system, component structure, and API patterns as the existing codebase

3. **Ensures Security**: Implements proper access control, file validation, and HIPAA-compliant storage

4. **Provides Clear Implementation Path**: Detailed step-by-step sequence with specific file references and line numbers

5. **Supports Mobile**: Includes camera capture for insurance cards and location-based pharmacy search

The Code mode can now use this specification to implement both features with confidence, knowing all architectural decisions have been made and validated against the existing codebase.