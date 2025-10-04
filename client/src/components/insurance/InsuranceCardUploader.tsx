import React, { useState, useRef } from 'react';
import { Upload, X, Camera } from 'lucide-react';
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