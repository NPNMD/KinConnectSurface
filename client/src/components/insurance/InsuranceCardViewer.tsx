import React, { useState } from 'react';
import { CreditCard, X, ZoomIn, Edit, Trash2 } from 'lucide-react';
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
          
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                title="Edit insurance"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete insurance"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
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
          {insurance.rxBin && (
            <div>
              <span className="text-gray-500">RX BIN:</span>
              <p className="font-medium">{insurance.rxBin}</p>
            </div>
          )}
          {insurance.rxPcn && (
            <div>
              <span className="text-gray-500">RX PCN:</span>
              <p className="font-medium">{insurance.rxPcn}</p>
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

        {insurance.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">Notes:</span>
            <p className="text-sm text-gray-700 mt-1">{insurance.notes}</p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
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
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}