import React, { useState } from 'react';
import { Plus, Copy, Edit, Trash2, Calendar, Clock, User, MapPin } from 'lucide-react';
import type { MedicalEventType, MedicalEventPriority } from '@shared/types';

interface AppointmentTemplate {
  id: string;
  name: string;
  description: string;
  eventType: MedicalEventType;
  priority: MedicalEventPriority;
  duration: number;
  providerId?: string;
  providerName?: string;
  facilityId?: string;
  facilityName?: string;
  location?: string;
  specialInstructions?: string;
  preparationInstructions?: string;
  requiresTransportation: boolean;
  insuranceRequired: boolean;
  copayAmount?: number;
  preAuthRequired: boolean;
  tags: string[];
  createdAt: Date;
  usageCount: number;
}

interface AppointmentTemplatesProps {
  patientId: string;
  onUseTemplate: (template: AppointmentTemplate) => void;
  onClose: () => void;
}

const MEDICAL_EVENT_TYPES_ARRAY = [
  'appointment',
  'consultation',
  'follow_up',
  'lab_test',
  'imaging',
  'procedure',
  'surgery',
  'therapy_session',
  'vaccination',
  'wellness_check',
  'specialist_referral'
] as const;

const MEDICAL_EVENT_PRIORITIES_ARRAY = ['low', 'medium', 'high', 'urgent'] as const;

export default function AppointmentTemplates({ patientId, onUseTemplate, onClose }: AppointmentTemplatesProps) {
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([
    {
      id: '1',
      name: 'Annual Physical',
      description: 'Yearly comprehensive physical examination',
      eventType: 'wellness_check',
      priority: 'medium',
      duration: 60,
      providerName: 'Dr. Sarah Johnson',
      facilityName: 'Family Health Center',
      location: '123 Health St, Medical City',
      specialInstructions: 'Bring insurance card and medication list',
      preparationInstructions: 'Fast for 12 hours before appointment for blood work',
      requiresTransportation: false,
      insuranceRequired: true,
      copayAmount: 25,
      preAuthRequired: false,
      tags: ['routine', 'preventive'],
      createdAt: new Date('2024-01-15'),
      usageCount: 3
    },
    {
      id: '2',
      name: 'Cardiology Follow-up',
      description: 'Regular cardiology check-up',
      eventType: 'follow_up',
      priority: 'high',
      duration: 45,
      providerName: 'Dr. Michael Chen',
      facilityName: 'Heart Specialists Clinic',
      location: '456 Cardiac Ave, Medical City',
      specialInstructions: 'Bring recent EKG results and medication list',
      preparationInstructions: 'Take medications as usual, bring blood pressure log',
      requiresTransportation: false,
      insuranceRequired: true,
      copayAmount: 40,
      preAuthRequired: true,
      tags: ['cardiology', 'follow-up'],
      createdAt: new Date('2024-02-01'),
      usageCount: 5
    },
    {
      id: '3',
      name: 'Physical Therapy Session',
      description: 'Standard physical therapy appointment',
      eventType: 'therapy_session',
      priority: 'medium',
      duration: 60,
      providerName: 'Lisa Rodriguez, PT',
      facilityName: 'Rehabilitation Center',
      location: '789 Recovery Rd, Medical City',
      specialInstructions: 'Wear comfortable exercise clothing',
      preparationInstructions: 'Complete home exercises, bring exercise log',
      requiresTransportation: false,
      insuranceRequired: true,
      copayAmount: 30,
      preAuthRequired: false,
      tags: ['therapy', 'rehabilitation'],
      createdAt: new Date('2024-02-15'),
      usageCount: 8
    }
  ]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AppointmentTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    eventType: 'appointment' as MedicalEventType,
    priority: 'medium' as MedicalEventPriority,
    duration: 60,
    providerName: '',
    facilityName: '',
    location: '',
    specialInstructions: '',
    preparationInstructions: '',
    requiresTransportation: false,
    insuranceRequired: false,
    copayAmount: 0,
    preAuthRequired: false,
    tags: [] as string[]
  });

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const template: AppointmentTemplate = {
      id: Date.now().toString(),
      ...newTemplate,
      createdAt: new Date(),
      usageCount: 0
    };

    setTemplates(prev => [...prev, template]);
    resetForm();
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !newTemplate.name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const updatedTemplate: AppointmentTemplate = {
      ...editingTemplate,
      ...newTemplate
    };

    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTemplate : t));
    resetForm();
  };

  const handleEditTemplate = (template: AppointmentTemplate) => {
    setNewTemplate({
      name: template.name,
      description: template.description,
      eventType: template.eventType,
      priority: template.priority,
      duration: template.duration,
      providerName: template.providerName || '',
      facilityName: template.facilityName || '',
      location: template.location || '',
      specialInstructions: template.specialInstructions || '',
      preparationInstructions: template.preparationInstructions || '',
      requiresTransportation: template.requiresTransportation,
      insuranceRequired: template.insuranceRequired,
      copayAmount: template.copayAmount || 0,
      preAuthRequired: template.preAuthRequired,
      tags: template.tags
    });
    setEditingTemplate(template);
    setShowCreateForm(true);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const handleUseTemplate = (template: AppointmentTemplate) => {
    // Increment usage count
    setTemplates(prev => prev.map(t => 
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    ));
    
    onUseTemplate(template);
    onClose();
  };

  const resetForm = () => {
    setNewTemplate({
      name: '',
      description: '',
      eventType: 'appointment',
      priority: 'medium',
      duration: 60,
      providerName: '',
      facilityName: '',
      location: '',
      specialInstructions: '',
      preparationInstructions: '',
      requiresTransportation: false,
      insuranceRequired: false,
      copayAmount: 0,
      preAuthRequired: false,
      tags: []
    });
    setEditingTemplate(null);
    setShowCreateForm(false);
  };

  const getEventTypeColor = (eventType: MedicalEventType) => {
    switch (eventType) {
      case 'appointment':
      case 'consultation':
        return 'bg-blue-100 text-blue-800';
      case 'follow_up':
        return 'bg-green-100 text-green-800';
      case 'therapy_session':
        return 'bg-purple-100 text-purple-800';
      case 'wellness_check':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Appointment Templates</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Template Name *</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="e.g., Annual Physical, Cardiology Follow-up"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                rows={2}
                placeholder="Brief description of this appointment type"
              />
            </div>

            <div>
              <label className="label">Event Type</label>
              <select
                value={newTemplate.eventType}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, eventType: e.target.value as MedicalEventType }))}
                className="input"
              >
                {MEDICAL_EVENT_TYPES_ARRAY.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                value={newTemplate.priority}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, priority: e.target.value as MedicalEventPriority }))}
                className="input"
              >
                {MEDICAL_EVENT_PRIORITIES_ARRAY.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Duration (minutes)</label>
              <select
                value={newTemplate.duration}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                className="input"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div>
              <label className="label">Provider</label>
              <input
                type="text"
                value={newTemplate.providerName}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, providerName: e.target.value }))}
                className="input"
                placeholder="Dr. Smith, Cardiologist"
              />
            </div>

            <div>
              <label className="label">Facility</label>
              <input
                type="text"
                value={newTemplate.facilityName}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, facilityName: e.target.value }))}
                className="input"
                placeholder="Medical Center Name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Location</label>
              <input
                type="text"
                value={newTemplate.location}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, location: e.target.value }))}
                className="input"
                placeholder="123 Medical Center Dr, City, State"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Special Instructions</label>
              <textarea
                value={newTemplate.specialInstructions}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, specialInstructions: e.target.value }))}
                className="input"
                rows={2}
                placeholder="Special instructions for this appointment"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Preparation Instructions</label>
              <textarea
                value={newTemplate.preparationInstructions}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, preparationInstructions: e.target.value }))}
                className="input"
                rows={2}
                placeholder="How to prepare for this appointment"
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requiresTransportation"
                  checked={newTemplate.requiresTransportation}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, requiresTransportation: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="requiresTransportation" className="text-sm text-gray-700">
                  Requires transportation
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="insuranceRequired"
                  checked={newTemplate.insuranceRequired}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, insuranceRequired: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="insuranceRequired" className="text-sm text-gray-700">
                  Insurance required
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="preAuthRequired"
                  checked={newTemplate.preAuthRequired}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, preAuthRequired: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="preAuthRequired" className="text-sm text-gray-700">
                  Pre-authorization required
                </label>
              </div>
            </div>

            {newTemplate.insuranceRequired && (
              <div>
                <label className="label">Typical Copay ($)</label>
                <input
                  type="number"
                  value={newTemplate.copayAmount}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, copayAmount: parseFloat(e.target.value) || 0 }))}
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
              className="btn-primary"
            >
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
              </div>
              <div className="flex items-center space-x-1 ml-2">
                <button
                  onClick={() => handleEditTemplate(template)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Edit template"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(template.eventType)}`}>
                  {template.eventType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-500">Used {template.usageCount} times</span>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{template.duration} minutes</span>
              </div>

              {template.providerName && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span className="truncate">{template.providerName}</span>
                </div>
              )}

              {template.location && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{template.location}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => handleUseTemplate(template)}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Use Template</span>
            </button>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-500 mb-4">Create your first appointment template to save time scheduling recurring visits.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      )}
    </div>
  );
}