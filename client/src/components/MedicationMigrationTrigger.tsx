import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { migrateMedications, getUnifiedMedications } from '@/lib/api';
import { isUnifiedMedication } from '@/types/medication';

interface MedicationMigrationTriggerProps {
  patientId?: string;
  onMigrationComplete?: () => void;
}

export default function MedicationMigrationTrigger({
  patientId,
  onMigrationComplete
}: MedicationMigrationTriggerProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [shouldShowBanner, setShouldShowBanner] = useState(true);

  // Check if migration is already complete
  useEffect(() => {
    const checkMigrationStatus = async () => {
      // Check localStorage first
      const migrationComplete = localStorage.getItem('medications_migrated');
      if (migrationComplete === 'true') {
        setShouldShowBanner(false);
        return;
      }

      // Check if all medications are unified
      try {
        const response = await getUnifiedMedications({ patientId });
        if (response.success && response.data) {
          const allUnified = response.data.every(med => isUnifiedMedication(med));
          if (allUnified && response.data.length > 0) {
            localStorage.setItem('medications_migrated', 'true');
            setShouldShowBanner(false);
          }
        }
      } catch (error) {
        console.error('Error checking migration status:', error);
      }
    };

    checkMigrationStatus();
  }, [patientId]);

  const handleMigrate = async (dryRun: boolean = false) => {
    try {
      setIsMigrating(true);
      setMigrationResult(null);

      const result = await migrateMedications({
        patientId,
        dryRun
      });

      setMigrationResult({
        success: result.success,
        message: result.message || (result.success ? 'Migration completed successfully' : 'Migration failed'),
        data: result.data
      });

      if (result.success && !dryRun) {
        // Check if all medications are now unified
        const response = await getUnifiedMedications({ patientId });
        if (response.success && response.data) {
          const allUnified = response.data.every(med => isUnifiedMedication(med));
          if (allUnified) {
            localStorage.setItem('medications_migrated', 'true');
            setShouldShowBanner(false);
          }
        }
        
        if (onMigrationComplete) {
          onMigrationComplete();
        }
      }
    } catch (error) {
      setMigrationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Migration failed'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Don't show banner if migration is complete
  if (!shouldShowBanner) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Unified Medication System
          </h4>
          <p className="text-sm text-blue-800 mb-3">
            Migrate your medications to the new unified system for improved performance and features.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleMigrate(true)}
              disabled={isMigrating}
              className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm flex items-center space-x-2"
            >
              {isMigrating ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Info className="w-4 h-4" />
                  <span>Preview Migration</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleMigrate(false)}
              disabled={isMigrating}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm flex items-center space-x-2"
            >
              {isMigrating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Migrating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Migrate Now</span>
                </>
              )}
            </button>
          </div>

          {migrationResult && (
            <div className={`mt-3 p-3 rounded-md ${
              migrationResult.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-2">
                {migrationResult.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    migrationResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {migrationResult.message}
                  </p>

                  {migrationResult.data && (
                    <>
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                      >
                        {showDetails ? 'Hide' : 'Show'} details
                      </button>

                      {showDetails && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                            {JSON.stringify(migrationResult.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}