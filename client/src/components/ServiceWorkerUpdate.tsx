import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { serviceWorkerManager, ServiceWorkerEvent } from '@/utils/serviceWorker';

export default function ServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleServiceWorkerEvent = (event: ServiceWorkerEvent) => {
      if (event.type === 'UPDATE_AVAILABLE') {
        setUpdateAvailable(true);
      } else if (event.type === 'UPDATED') {
        // Reload the page to get the new version
        window.location.reload();
      }
    };

    serviceWorkerManager.addEventListener(handleServiceWorkerEvent);

    return () => {
      serviceWorkerManager.removeEventListener(handleServiceWorkerEvent);
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    serviceWorkerManager.skipWaiting();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[10000] max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">
              App Update Available
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              A new version of KinConnect is available. Update now to get the latest features and fixes.
            </p>
            <div className="flex space-x-2 mt-3">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Now'
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                Later
              </button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}