import React from 'react';
import { Shield, Eye, CheckCircle } from 'lucide-react';

interface AccessLevelSelectorProps {
  selectedLevel: 'full' | 'view_only';
  onChange: (level: 'full' | 'view_only') => void;
  disabled?: boolean;
}

export default function AccessLevelSelector({ 
  selectedLevel, 
  onChange, 
  disabled = false 
}: AccessLevelSelectorProps) {
  
  const accessLevels = [
    {
      value: 'full' as const,
      label: 'Full Access',
      icon: Shield,
      description: 'Complete control over appointments and medical information',
      permissions: [
        'View all appointments and events',
        'Create new appointments',
        'Edit existing appointments',
        'Delete appointments',
        'Claim transportation responsibilities',
        'Manage other family members',
        'View detailed medical information',
        'Receive notifications'
      ],
      color: 'blue'
    },
    {
      value: 'view_only' as const,
      label: 'View Only',
      icon: Eye,
      description: 'Read-only access with limited interaction',
      permissions: [
        'View appointments and events',
        'Claim transportation responsibilities',
        'Receive notifications'
      ],
      restrictions: [
        'Cannot create appointments',
        'Cannot edit appointments',
        'Cannot delete appointments',
        'Cannot manage family members',
        'Cannot view detailed medical information'
      ],
      color: 'green'
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Access Level
        </label>
        <p className="text-sm text-gray-600 mb-4">
          Choose what level of access this family member will have to your medical information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accessLevels.map((level) => {
          const Icon = level.icon;
          const isSelected = selectedLevel === level.value;
          const colorClasses = {
            blue: {
              border: 'border-blue-500',
              bg: 'bg-blue-50',
              icon: 'text-blue-600',
              check: 'text-blue-600'
            },
            green: {
              border: 'border-green-500',
              bg: 'bg-green-50',
              icon: 'text-green-600',
              check: 'text-green-600'
            }
          };
          const colors = colorClasses[level.color as keyof typeof colorClasses];

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => !disabled && onChange(level.value)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${isSelected 
                  ? `${colors.border} ${colors.bg}` 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className={`w-5 h-5 ${colors.check}`} />
                </div>
              )}

              {/* Icon and Title */}
              <div className="flex items-start space-x-3 mb-3">
                <div className={`p-2 rounded-lg ${isSelected ? colors.bg : 'bg-gray-100'}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? colors.icon : 'text-gray-600'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{level.label}</h3>
                  <p className="text-sm text-gray-600 mt-1">{level.description}</p>
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Permissions:
                </p>
                <ul className="space-y-1">
                  {level.permissions.map((permission, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-600">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>

                {/* Restrictions (for view_only) */}
                {level.restrictions && level.restrictions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                      Restrictions:
                    </p>
                    <ul className="space-y-1 mt-1">
                      {level.restrictions.map((restriction, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-500">
                          <span className="text-gray-400 mr-2">✗</span>
                          <span>{restriction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> You can change access levels later from the Family Members management page.
          Start with "View Only" if you're unsure, and upgrade to "Full Access" when needed.
        </p>
      </div>
    </div>
  );
}