import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { InsuranceInformation, NewInsuranceInformation } from '@shared/types';
import InsuranceCardUploader from './InsuranceCardUploader';
import { showSuccess, showError } from '@/utils/toast';

interface InsuranceFormModalProps {
  patientId: string;
  insurance?: InsuranceInformation | null;
  onSave: (insurance: NewInsuranceInformation | Partial<InsuranceInformation>) => Promise<void>;
  onClose: () => void;
}

export default function InsuranceFormModal({
  patientId,
  insurance,
  onSave,
  onClose
}: InsuranceFormModalProps) {
  const [formData, setFormData] = useState({
    insuranceType: insurance?.insuranceType || 'primary' as 'primary' | 'secondary' | 'tertiary',
    providerName: insurance?.providerName || '',
    policyNumber: insurance?.policyNumber || '',
    groupNumber: insurance?.groupNumber || '',
    subscriberName: insurance?.subscriberName || '',
    subscriberRelationship: insurance?.subscriberRelationship || 'self' as 'self' | 'spouse' | 'parent' | 'child' | 'other',
    subscriberId: insurance?.subscriberId || '',
    customerServicePhone: insurance?.customerServicePhone || '',
    claimsAddress: insurance?.claimsAddress || '',
    rxBin: insurance?.rxBin || '',
    rxPcn: insurance?.rxPcn || '',
    rxGroup: insurance?.rxGroup || '',
    notes: insurance?.notes || '',
    isPrimary: insurance?.isPrimary || false,
    isActive: insurance?.isActive ?? true,
    cardFrontUrl: insurance?.cardFrontUrl || '',
    cardBackUrl: insurance?.cardBackUrl || '',
    cardFrontStoragePath: insurance?.cardFrontStoragePath || '',
    cardBackStoragePath: insurance?.cardBackStoragePath || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [tempInsuranceId] = useState(() => insurance?.id || `temp_${Date.now()}`);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCardUploadComplete = (side: 'front' | 'back', url: string, storagePath: string) => {
    setFormData(prev => ({
      ...prev,
      ...(side === 'front' 
        ? { cardFrontUrl: url, cardFrontStoragePath: storagePath }
        : { cardBackUrl: url, cardBackStoragePath: storagePath }
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.providerName || !formData.policyNumber) {
      showError('Please fill in required fields: Provider Name and Policy Number');
      return;
    }

    setIsSaving(true);
    try {
      if (insurance) {
        // Update existing insurance
        await onSave({
          ...formData,
          updatedBy: patientId
        });
      } else {
        // Create new insurance
        const newInsurance: NewInsuranceInformation = {
          patientId,
          insuranceType: formData.insuranceType,
          providerName: formData.providerName,
          policyNumber: formData.policyNumber,
          groupNumber: formData.groupNumber || undefined,
          subscriberName: formData.subscriberName || undefined,
          subscriberRelationship: formData.subscriberRelationship,
          subscriberId: formData.subscriberId || undefined,
          customerServicePhone: formData.customerServicePhone || undefined,
          claimsAddress: formData.claimsAddress || undefined,
          rxBin: formData.rxBin || undefined,
          rxPcn: formData.rxPcn || undefined,
          rxGroup: formData.rxGroup || undefined,
          isActive: formData.isActive,
          isPrimary: formData.isPrimary,
          notes: formData.notes || undefined,
          createdBy: patientId
        };
        await onSave(newInsurance);
      }
      showSuccess(insurance ? 'Insurance updated successfully!' : 'Insurance added successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving insurance:', error);
      showError('Failed to save insurance information. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {insurance ? 'Edit Insurance' : 'Add Insurance'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Insurance Type */}
          <div>
            <label className="label">Insurance Type *</label>
            <select
              value={formData.insuranceType}
              onChange={(e) => handleInputChange('insuranceType', e.target.value)}
              className="input"
              required
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="tertiary">Tertiary</option>
            </select>
          </div>

          {/* Provider Name */}
          <div>
            <label className="label">Insurance Provider *</label>
            <input
              type="text"
              value={formData.providerName}
              onChange={(e) => handleInputChange('providerName', e.target.value)}
              className="input"
              placeholder="e.g., Blue Cross Blue Shield"
              required
            />
          </div>

          {/* Policy and Group Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Policy Number *</label>
              <input
                type="text"
                value={formData.policyNumber}
                onChange={(e) => handleInputChange('policyNumber', e.target.value)}
                className="input"
                placeholder="Policy #"
                required
              />
            </div>
            <div>
              <label className="label">Group Number</label>
              <input
                type="text"
                value={formData.groupNumber}
                onChange={(e) => handleInputChange('groupNumber', e.target.value)}
                className="input"
                placeholder="Group #"
              />
            </div>
          </div>

          {/* Subscriber Information */}
          <div className="space-y-4 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Subscriber Information</h3>
            
            <div>
              <label className="label">Subscriber Name</label>
              <input
                type="text"
                value={formData.subscriberName}
                onChange={(e) => handleInputChange('subscriberName', e.target.value)}
                className="input"
                placeholder="Name on insurance"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Relationship to Subscriber</label>
                <select
                  value={formData.subscriberRelationship}
                  onChange={(e) => handleInputChange('subscriberRelationship', e.target.value)}
                  className="input"
                >
                  <option value="self">Self</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Subscriber ID</label>
                <input
                  type="text"
                  value={formData.subscriberId}
                  onChange={(e) => handleInputChange('subscriberId', e.target.value)}
                  className="input"
                  placeholder="Subscriber ID"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Contact Information</h3>
            
            <div>
              <label className="label">Customer Service Phone</label>
              <input
                type="tel"
                value={formData.customerServicePhone}
                onChange={(e) => handleInputChange('customerServicePhone', e.target.value)}
                className="input"
                placeholder="1-800-XXX-XXXX"
              />
            </div>

            <div>
              <label className="label">Claims Address</label>
              <input
                type="text"
                value={formData.claimsAddress}
                onChange={(e) => handleInputChange('claimsAddress', e.target.value)}
                className="input"
                placeholder="Claims mailing address"
              />
            </div>
          </div>

          {/* Prescription Information */}
          <div className="space-y-4 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Prescription Information</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">RX BIN</label>
                <input
                  type="text"
                  value={formData.rxBin}
                  onChange={(e) => handleInputChange('rxBin', e.target.value)}
                  className="input"
                  placeholder="BIN"
                />
              </div>
              <div>
                <label className="label">RX PCN</label>
                <input
                  type="text"
                  value={formData.rxPcn}
                  onChange={(e) => handleInputChange('rxPcn', e.target.value)}
                  className="input"
                  placeholder="PCN"
                />
              </div>
              <div>
                <label className="label">RX Group</label>
                <input
                  type="text"
                  value={formData.rxGroup}
                  onChange={(e) => handleInputChange('rxGroup', e.target.value)}
                  className="input"
                  placeholder="Group"
                />
              </div>
            </div>
          </div>

          {/* Insurance Card Images */}
          <div className="space-y-4 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Insurance Card Images</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InsuranceCardUploader
                patientId={patientId}
                insuranceId={tempInsuranceId}
                side="front"
                existingImageUrl={formData.cardFrontUrl}
                onUploadComplete={(url, storagePath) => handleCardUploadComplete('front', url, storagePath)}
                onRemove={() => handleInputChange('cardFrontUrl', '')}
              />
              <InsuranceCardUploader
                patientId={patientId}
                insuranceId={tempInsuranceId}
                side="back"
                existingImageUrl={formData.cardBackUrl}
                onUploadComplete={(url, storagePath) => handleCardUploadComplete('back', url, storagePath)}
                onRemove={() => handleInputChange('cardBackUrl', '')}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="input"
              rows={3}
              placeholder="Additional notes about this insurance..."
            />
          </div>

          {/* Status Toggles */}
          <div className="flex items-center space-x-6 pt-2 border-t border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPrimary}
                onChange={(e) => handleInputChange('isPrimary', e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Primary Insurance</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{insurance ? 'Update' : 'Add'} Insurance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}