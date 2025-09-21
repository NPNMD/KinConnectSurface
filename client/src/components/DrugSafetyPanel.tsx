import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Shield,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pill,
  Heart,
  Calendar
} from 'lucide-react';
import { Medication, PatientSafetyProfile, DrugInteraction } from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';

interface DrugSafetyAlert {
  id: string;
  type: 'interaction' | 'allergy' | 'contraindication' | 'timing' | 'duplicate';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  title: string;
  description: string;
  medications: string[];
  recommendations: string[];
  source: string;
  learnMoreUrl?: string;
}

interface DrugSafetyPanelProps {
  medications: Medication[];
  patientId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface DrugSafetyData {
  alerts: DrugSafetyAlert[];
  interactions: DrugInteraction[];
  safetyProfile?: PatientSafetyProfile;
  isLoading: boolean;
  lastChecked?: Date;
}

const SEVERITY_CONFIG = {
  minor: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: Info,
    label: 'Minor'
  },
  moderate: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: AlertCircle,
    label: 'Moderate'
  },
  major: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: AlertTriangle,
    label: 'Major'
  },
  critical: {
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: XCircle,
    label: 'Critical'
  }
};

const ALERT_TYPE_CONFIG = {
  interaction: {
    icon: AlertTriangle,
    label: 'Drug Interaction',
    description: 'Potential interaction between medications'
  },
  allergy: {
    icon: Heart,
    label: 'Allergy Warning',
    description: 'Medication may trigger known allergies'
  },
  contraindication: {
    icon: XCircle,
    label: 'Contraindication',
    description: 'Medication is contraindicated'
  },
  timing: {
    icon: Clock,
    label: 'Timing Concern',
    description: 'Medications should be separated in time'
  },
  duplicate: {
    icon: Pill,
    label: 'Duplicate Therapy',
    description: 'Similar medications detected'
  }
};

export default function DrugSafetyPanel({ 
  medications, 
  patientId, 
  isCollapsed = false, 
  onToggleCollapse 
}: DrugSafetyPanelProps) {
  const [safetyData, setSafetyData] = useState<DrugSafetyData>({
    alerts: [],
    interactions: [],
    isLoading: false
  });
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // Memoized safety analysis
  const safetyAnalysis = useMemo(() => {
    const activeMedications = medications.filter(med => med.isActive);
    const alerts: DrugSafetyAlert[] = [];

    // Drug-Drug Interaction Detection
    const drugInteractionAlerts = detectDrugInteractions(activeMedications);
    alerts.push(...drugInteractionAlerts);

    // Duplicate Therapy Detection
    const duplicateAlerts = detectDuplicateTherapy(activeMedications);
    alerts.push(...duplicateAlerts);

    // Timing Separation Alerts
    const timingAlerts = detectTimingSeparationIssues(activeMedications);
    alerts.push(...timingAlerts);

    // Allergy Cross-checking (if safety profile available)
    if (safetyData.safetyProfile) {
      const allergyAlerts = detectAllergyConflicts(activeMedications, safetyData.safetyProfile);
      alerts.push(...allergyAlerts);
    }

    // Contraindication checking
    if (safetyData.safetyProfile) {
      const contraindictionAlerts = detectContraindications(activeMedications, safetyData.safetyProfile);
      alerts.push(...contraindictionAlerts);
    }

    // Sort alerts by severity
    const severityOrder = { critical: 0, major: 1, moderate: 2, minor: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      alerts,
      totalIssues: alerts.length,
      criticalIssues: alerts.filter(a => a.severity === 'critical').length,
      majorIssues: alerts.filter(a => a.severity === 'major').length,
      moderateIssues: alerts.filter(a => a.severity === 'moderate').length,
      minorIssues: alerts.filter(a => a.severity === 'minor').length
    };
  }, [medications, safetyData.safetyProfile]);

  // Load patient safety profile
  useEffect(() => {
    const loadSafetyProfile = async () => {
      if (!patientId) return;

      try {
        setSafetyData(prev => ({ ...prev, isLoading: true }));
        
        // Load patient safety profile (allergies, contraindications, etc.)
        const response = await apiClient.get<{ success: boolean; data: PatientSafetyProfile }>(
          `/patients/${patientId}/safety-profile`
        );

        if (response.success && response.data) {
          setSafetyData(prev => ({
            ...prev,
            safetyProfile: response.data,
            lastChecked: new Date()
          }));
        }
      } catch (error) {
        console.error('Error loading safety profile:', error);
      } finally {
        setSafetyData(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSafetyProfile();
  }, [patientId]);

  // Drug interaction detection logic
  function detectDrugInteractions(medications: Medication[]): DrugSafetyAlert[] {
    const alerts: DrugSafetyAlert[] = [];
    const knownInteractions = getKnownInteractions();

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        const interaction = findInteraction(med1, med2, knownInteractions);
        if (interaction) {
          alerts.push({
            id: `interaction-${med1.id}-${med2.id}`,
            type: 'interaction',
            severity: interaction.severity,
            title: `${med1.name} + ${med2.name}`,
            description: interaction.description,
            medications: [med1.name, med2.name],
            recommendations: [
              interaction.management || 'Consult with healthcare provider',
              'Monitor for increased side effects',
              'Consider timing separation if possible'
            ],
            source: 'Drug Interaction Database',
            learnMoreUrl: `https://www.drugs.com/drug_interactions.php?drug_list=${encodeURIComponent(med1.name)},${encodeURIComponent(med2.name)}`
          });
        }
      }
    }

    return alerts;
  }

  // Duplicate therapy detection
  function detectDuplicateTherapy(medications: Medication[]): DrugSafetyAlert[] {
    const alerts: DrugSafetyAlert[] = [];
    const drugClasses = getDrugClassifications();
    const classGroups: { [key: string]: Medication[] } = {};

    // Group medications by therapeutic class
    medications.forEach(med => {
      const drugClass = getDrugClass(med.name, drugClasses);
      if (drugClass) {
        if (!classGroups[drugClass]) {
          classGroups[drugClass] = [];
        }
        classGroups[drugClass].push(med);
      }
    });

    // Check for duplicates within classes
    Object.entries(classGroups).forEach(([drugClass, meds]) => {
      if (meds.length > 1) {
        alerts.push({
          id: `duplicate-${drugClass}`,
          type: 'duplicate',
          severity: 'moderate',
          title: `Multiple ${drugClass} medications`,
          description: `You are taking multiple medications in the same therapeutic class (${drugClass}). This may increase the risk of side effects.`,
          medications: meds.map(m => m.name),
          recommendations: [
            'Verify with healthcare provider that multiple medications are necessary',
            'Monitor for increased side effects',
            'Ensure proper dosing adjustments if needed'
          ],
          source: 'Therapeutic Class Analysis'
        });
      }
    });

    return alerts;
  }

  // Timing separation detection
  function detectTimingSeparationIssues(medications: Medication[]): DrugSafetyAlert[] {
    const alerts: DrugSafetyAlert[] = [];
    const separationRules = getTimingSeparationRules();

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        const rule = findSeparationRule(med1, med2, separationRules);
        if (rule) {
          alerts.push({
            id: `timing-${med1.id}-${med2.id}`,
            type: 'timing',
            severity: 'moderate',
            title: `Timing separation needed: ${med1.name} and ${med2.name}`,
            description: `These medications should be separated by at least ${rule.minimumHours} hours. ${rule.reason}`,
            medications: [med1.name, med2.name],
            recommendations: [
              `Take ${med1.name} and ${med2.name} at least ${rule.minimumHours} hours apart`,
              'Consider adjusting medication schedule',
              'Set reminders to maintain proper spacing'
            ],
            source: 'Medication Timing Guidelines'
          });
        }
      }
    }

    return alerts;
  }

  // Allergy conflict detection
  function detectAllergyConflicts(medications: Medication[], safetyProfile: PatientSafetyProfile): DrugSafetyAlert[] {
    const alerts: DrugSafetyAlert[] = [];

    medications.forEach(med => {
      safetyProfile.allergies.forEach(allergy => {
        if (isAllergyMatch(med, allergy)) {
          alerts.push({
            id: `allergy-${med.id}-${allergy.id}`,
            type: 'allergy',
            severity: allergy.severity === 'anaphylaxis' ? 'critical' : 
                     allergy.severity === 'severe' ? 'major' : 'moderate',
            title: `Allergy Alert: ${med.name}`,
            description: `You have a known ${allergy.severity} allergy to ${allergy.allergen}. This medication may contain or be related to this allergen.`,
            medications: [med.name],
            recommendations: [
              'DO NOT TAKE this medication',
              'Contact healthcare provider immediately',
              'Consider alternative medications',
              'Update emergency contacts about this allergy'
            ],
            source: 'Patient Allergy Profile'
          });
        }
      });
    });

    return alerts;
  }

  // Contraindication detection
  function detectContraindications(medications: Medication[], safetyProfile: PatientSafetyProfile): DrugSafetyAlert[] {
    const alerts: DrugSafetyAlert[] = [];

    medications.forEach(med => {
      safetyProfile.contraindications.forEach(contraindication => {
        if (med.name.toLowerCase().includes(contraindication.medication.toLowerCase()) ||
            contraindication.medication.toLowerCase().includes(med.name.toLowerCase())) {
          alerts.push({
            id: `contraindication-${med.id}-${contraindication.id}`,
            type: 'contraindication',
            severity: 'major',
            title: `Contraindication: ${med.name}`,
            description: `This medication is contraindicated. Reason: ${contraindication.reason}`,
            medications: [med.name],
            recommendations: [
              'Consult healthcare provider before taking',
              'Discuss alternative medications',
              'Review medical history and current conditions'
            ],
            source: contraindication.source
          });
        }
      });
    });

    return alerts;
  }

  // Helper functions for drug interaction data
  function getKnownInteractions() {
    // This would typically come from a comprehensive drug interaction database
    // For now, implementing common interactions
    return [
      {
        drug1: 'warfarin',
        drug2: 'aspirin',
        severity: 'major' as const,
        description: 'Increased risk of bleeding when warfarin is combined with aspirin.',
        management: 'Monitor INR closely and watch for signs of bleeding.'
      },
      {
        drug1: 'levothyroxine',
        drug2: 'calcium',
        severity: 'moderate' as const,
        description: 'Calcium can reduce the absorption of levothyroxine.',
        management: 'Take levothyroxine at least 4 hours before or after calcium supplements.'
      },
      {
        drug1: 'metformin',
        drug2: 'alcohol',
        severity: 'moderate' as const,
        description: 'Alcohol may increase the risk of lactic acidosis with metformin.',
        management: 'Limit alcohol consumption and monitor for symptoms of lactic acidosis.'
      }
      // Add more interactions as needed
    ];
  }

  function getDrugClassifications() {
    return {
      'ACE Inhibitors': ['lisinopril', 'enalapril', 'captopril'],
      'Beta Blockers': ['metoprolol', 'atenolol', 'propranolol'],
      'Statins': ['atorvastatin', 'simvastatin', 'rosuvastatin'],
      'Proton Pump Inhibitors': ['omeprazole', 'lansoprazole', 'esomeprazole'],
      'NSAIDs': ['ibuprofen', 'naproxen', 'diclofenac']
    };
  }

  function getTimingSeparationRules() {
    return [
      {
        drug1: 'levothyroxine',
        drug2: 'calcium',
        minimumHours: 4,
        reason: 'Calcium interferes with thyroid hormone absorption'
      },
      {
        drug1: 'levothyroxine',
        drug2: 'iron',
        minimumHours: 4,
        reason: 'Iron interferes with thyroid hormone absorption'
      },
      {
        drug1: 'bisphosphonate',
        drug2: 'food',
        minimumHours: 1,
        reason: 'Bisphosphonates require empty stomach for proper absorption'
      }
    ];
  }

  function findInteraction(med1: Medication, med2: Medication, interactions: any[]) {
    return interactions.find(interaction => 
      (med1.name.toLowerCase().includes(interaction.drug1.toLowerCase()) && 
       med2.name.toLowerCase().includes(interaction.drug2.toLowerCase())) ||
      (med1.name.toLowerCase().includes(interaction.drug2.toLowerCase()) && 
       med2.name.toLowerCase().includes(interaction.drug1.toLowerCase()))
    );
  }

  function getDrugClass(medicationName: string, classifications: any) {
    for (const [drugClass, medications] of Object.entries(classifications)) {
      if ((medications as string[]).some(med => 
        medicationName.toLowerCase().includes(med.toLowerCase())
      )) {
        return drugClass;
      }
    }
    return null;
  }

  function findSeparationRule(med1: Medication, med2: Medication, rules: any[]) {
    return rules.find(rule =>
      (med1.name.toLowerCase().includes(rule.drug1.toLowerCase()) && 
       med2.name.toLowerCase().includes(rule.drug2.toLowerCase())) ||
      (med1.name.toLowerCase().includes(rule.drug2.toLowerCase()) && 
       med2.name.toLowerCase().includes(rule.drug1.toLowerCase()))
    );
  }

  function isAllergyMatch(medication: Medication, allergy: any) {
    const medName = medication.name.toLowerCase();
    const allergen = allergy.allergen.toLowerCase();
    
    // Direct name match
    if (medName.includes(allergen) || allergen.includes(medName)) {
      return true;
    }
    
    // Generic/brand name match
    if (medication.genericName && medication.genericName.toLowerCase().includes(allergen)) {
      return true;
    }
    
    if (medication.brandName && medication.brandName.toLowerCase().includes(allergen)) {
      return true;
    }
    
    return false;
  }

  const toggleAlertExpansion = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const getSeverityIcon = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
    const IconComponent = config.icon;
    return <IconComponent className={`w-5 h-5 ${config.color}`} />;
  };

  const getAlertTypeIcon = (type: string) => {
    const config = ALERT_TYPE_CONFIG[type as keyof typeof ALERT_TYPE_CONFIG];
    const IconComponent = config.icon;
    return <IconComponent className="w-4 h-4" />;
  };

  if (medications.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Drug Safety Monitor</h3>
              <p className="text-sm text-gray-600">
                {safetyAnalysis.totalIssues === 0 
                  ? 'No safety issues detected' 
                  : `${safetyAnalysis.totalIssues} safety issue${safetyAnalysis.totalIssues !== 1 ? 's' : ''} detected`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Issue count badges */}
            {safetyAnalysis.criticalIssues > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {safetyAnalysis.criticalIssues} Critical
              </span>
            )}
            {safetyAnalysis.majorIssues > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                {safetyAnalysis.majorIssues} Major
              </span>
            )}
            {safetyAnalysis.moderateIssues > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {safetyAnalysis.moderateIssues} Moderate
              </span>
            )}
            {safetyAnalysis.totalIssues === 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                All Clear
              </span>
            )}
            
            {onToggleCollapse && (
              isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {safetyData.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyzing medication safety...</span>
            </div>
          ) : safetyAnalysis.totalIssues === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Safety Issues Detected</h4>
              <p className="text-gray-600 text-sm">
                Your current medications appear to be safe when taken together. 
                Continue following your prescribed schedule and consult your healthcare provider with any concerns.
              </p>
              {safetyData.lastChecked && (
                <p className="text-xs text-gray-500 mt-2">
                  Last checked: {safetyData.lastChecked.toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Safety alerts */}
              {safetyAnalysis.alerts.map((alert) => {
                const isExpanded = expandedAlerts.has(alert.id);
                const severityConfig = SEVERITY_CONFIG[alert.severity];
                const typeConfig = ALERT_TYPE_CONFIG[alert.type];

                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg ${severityConfig.borderColor} ${severityConfig.bgColor}`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleAlertExpansion(alert.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getSeverityIcon(alert.severity)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {getAlertTypeIcon(alert.type)}
                              <span className={`text-xs font-medium ${severityConfig.color} uppercase tracking-wide`}>
                                {severityConfig.label} {typeConfig.label}
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-1">{alert.title}</h4>
                            <p className="text-sm text-gray-700">{alert.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {alert.medications.map((med, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                                >
                                  <Pill className="w-3 h-3 mr-1" />
                                  {med}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-200">
                        <div className="pt-4 space-y-4">
                          {/* Recommendations */}
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
                            <ul className="space-y-1">
                              {alert.recommendations.map((rec, index) => (
                                <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                                  <span className="text-blue-600 mt-1">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Source and learn more */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500">Source: {alert.source}</span>
                            {alert.learnMoreUrl && (
                              <a
                                href={alert.learnMoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                              >
                                Learn More
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Last updated */}
              {safetyData.lastChecked && (
                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Safety analysis last updated: {safetyData.lastChecked.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}