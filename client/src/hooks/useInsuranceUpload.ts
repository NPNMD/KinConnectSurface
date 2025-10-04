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

      // Compress image if needed
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