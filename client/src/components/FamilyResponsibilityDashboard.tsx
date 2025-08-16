import React, { useState } from 'react';
import { Calendar, Clock, MapPin, User, Car, AlertCircle, CheckCircle, Users, Bell, Phone, Mail } from 'lucide-react';
import type { MedicalEvent, FamilyMember } from '@shared/types';

interface FamilyResponsibilityDashboardProps {
  patientId: string;
  currentUserId?: string; // If viewing as a family member
  onClose?: () => void;
}

// Mock data for demonstration
const mockUpcomingEvents: MedicalEvent[] = [
  {
    id: 'event1',
    patientId: 'patient1',
    title: 'Cardiology Appointment - Dr. Smith',
    description: 'Annual heart checkup',
    eventType: 'appointment',
    priority: 'medium',
    status: 'scheduled',
    startDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    endDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
    duration: 60,
    isAllDay: false,
    location: '123 Medical Center Dr, City, State',
    providerName: 'Dr. Smith',
    providerSpecialty: 'Cardiology',
    requiresTransportation: true,
    responsiblePersonId: '',
    responsiblePersonName: '',
    responsibilityStatus: 'unassigned',
    transportationNotes: 'Patient cannot drive due to medication side effects',
    accompanimentRequired: true,
    isRecurring: false,
    reminders: [],
    createdBy: 'patient1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1
  },
  {
    id: 'event2',
    patientId: 'patient1',
    title: 'Physical Therapy Session',
    description: 'Weekly PT for knee rehabilitation',
    eventType: 'therapy_session',
    priority: 'medium',
    status: 'scheduled',
    startDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    endDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
    duration: 45,
    isAllDay: false,
    location: '456 Therapy Center Ave, City, State',
    providerName: 'Sarah Johnson, PT',
    providerSpecialty: 'Physical Therapy',
    requiresTransportation: true,
    responsiblePersonId: 'family1',
    responsiblePersonName: 'Sarah Johnson',
    responsibilityStatus: 'claimed',
    transportationNotes: '',
    accompanimentRequired: false,
    isRecurring: true,
    reminders: [],
    createdBy: 'patient1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1
  },
  {
    id: 'event3',
    patientId: 'patient1',
    title: 'Lab Work - Fasting Blood Test',
    description: 'Quarterly blood work for diabetes monitoring',
    eventType: 'lab_test',
    priority: 'high',
    status: 'scheduled',
    startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
    duration: 30,
    isAllDay: false,
    location: '789 Lab Services Blvd, City, State',
    providerName: 'City Lab Services',
    requiresTransportation: true,
    responsiblePersonId: '',
    responsiblePersonName: '',
    responsibilityStatus: 'unassigned',
    transportationNotes: 'Must fast for 12 hours before appointment',
    accompanimentRequired: false,
    isRecurring: false,
    reminders: [],
    preparationInstructions: 'No food or drink (except water) for 12 hours before test',
    createdBy: 'patient1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1
  }
];

const mockFamilyMembers: FamilyMember[] = [
  {
    id: 'family1',
    patientId: 'patient1',
    userId: 'user1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '+1-555-0123',
    relationship: 'spouse',
    accessLevel: 'full',
    permissions: ['view_appointments', 'create_appointments', 'edit_appointments'],
    isEmergencyContact: true,
    canReceiveNotifications: true,
    preferredContactMethod: 'email',
    invitationStatus: 'accepted',
    invitedAt: new Date('2024-01-15'),
    acceptedAt: new Date('2024-01-16'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-16')
  },
  {
    id: 'family2',
    patientId: 'patient1',
    userId: 'user2',
    name: 'Mike Johnson',
    email: 'mike.johnson@email.com',
    phone: '+1-555-0124',
    relationship: 'child',
    accessLevel: 'limited',
    permissions: ['view_appointments'],
    isEmergencyContact: false,
    canReceiveNotifications: true,
    preferredContactMethod: 'phone',
    invitationStatus: 'accepted',
    invitedAt: new Date('2024-01-20'),
    acceptedAt: new Date('2024-01-21'),
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-21')
  }
];

export default function FamilyResponsibilityDashboard({ patientId, currentUserId, onClose }: FamilyResponsibilityDashboardProps) {
  const [events, setEvents] = useState<MedicalEvent[]>(mockUpcomingEvents);
  const [familyMembers] = useState<FamilyMember[]>(mockFamilyMembers);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unassigned' | 'my_responsibilities'>('all');

  const formatEventDate = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatEventTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getResponsibilityStatusColor = (status: string) => {
    switch (status) {
      case 'unassigned': return 'bg-red-100 text-red-800 border-red-200';
      case 'claimed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'appointment':
      case 'consultation':
        return <User className="w-4 h-4" />;
      case 'therapy_session':
        return <Users className="w-4 h-4" />;
      case 'lab_test':
      case 'imaging':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const handleClaimResponsibility = (eventId: string) => {
    if (!currentUserId) return;
    
    const currentUser = familyMembers.find(m => m.userId === currentUserId);
    if (!currentUser) return;

    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? {
            ...event,
            responsiblePersonId: currentUser.id,
            responsiblePersonName: currentUser.name,
            responsibilityStatus: 'claimed' as const,
            responsibilityClaimedAt: new Date(),
            updatedAt: new Date()
          }
        : event
    ));
  };

  const handleDeclineResponsibility = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? {
            ...event,
            responsiblePersonId: '',
            responsiblePersonName: '',
            responsibilityStatus: 'unassigned' as const,
            updatedAt: new Date()
          }
        : event
    ));
  };

  const filteredEvents = events.filter(event => {
    if (!event.requiresTransportation) return false;
    
    switch (selectedFilter) {
      case 'unassigned':
        return event.responsibilityStatus === 'unassigned';
      case 'my_responsibilities':
        const currentUser = familyMembers.find(m => m.userId === currentUserId);
        return currentUser && event.responsiblePersonId === currentUser.id;
      default:
        return true;
    }
  });

  const unassignedCount = events.filter(e => e.requiresTransportation && e.responsibilityStatus === 'unassigned').length;
  const myResponsibilitiesCount = currentUserId 
    ? events.filter(e => {
        const currentUser = familyMembers.find(m => m.userId === currentUserId);
        return currentUser && e.responsiblePersonId === currentUser.id;
      }).length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Car className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Family Responsibility Dashboard</h3>
            <p className="text-sm text-gray-600">Coordinate transportation and support for medical appointments</p>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-900">{unassignedCount}</div>
              <div className="text-sm text-red-700">Unassigned Appointments</div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-900">{myResponsibilitiesCount}</div>
              <div className="text-sm text-blue-700">My Responsibilities</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-900">{familyMembers.length}</div>
              <div className="text-sm text-green-700">Active Family Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All Appointments', count: filteredEvents.length },
            { key: 'unassigned', label: 'Need Help', count: unassignedCount },
            { key: 'my_responsibilities', label: 'My Responsibilities', count: myResponsibilitiesCount }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedFilter(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedFilter === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  selectedFilter === tab.key
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex items-center space-x-2">
                      {getEventTypeIcon(event.eventType)}
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getResponsibilityStatusColor(event.responsibilityStatus)}`}>
                      {event.responsibilityStatus === 'unassigned' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {event.responsibilityStatus === 'claimed' && <Clock className="w-3 h-3 mr-1" />}
                      {event.responsibilityStatus === 'confirmed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {event.responsibilityStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatEventDate(event.startDateTime)} at {formatEventTime(event.startDateTime)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      
                      {event.providerName && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4" />
                          <span>{event.providerName}</span>
                          {event.providerSpecialty && <span className="text-gray-400">({event.providerSpecialty})</span>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Car className="w-4 h-4" />
                        <span className="font-medium">Transportation needed</span>
                      </div>
                      
                      {event.accompanimentRequired && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <Users className="w-4 h-4" />
                          <span>Accompaniment required</span>
                        </div>
                      )}
                      
                      {event.responsiblePersonName && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Assigned to: {event.responsiblePersonName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {event.transportationNotes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-yellow-800">Transportation Notes:</div>
                          <div className="text-sm text-yellow-700">{event.transportationNotes}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {event.preparationInstructions && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-blue-800">Preparation Required:</div>
                          <div className="text-sm text-blue-700">{event.preparationInstructions}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {event.responsibilityStatus === 'unassigned' && currentUserId && (
                    <button
                      onClick={() => handleClaimResponsibility(event.id)}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      I'll Help
                    </button>
                  )}
                  
                  {event.responsibilityStatus === 'claimed' && 
                   currentUserId && 
                   familyMembers.find(m => m.userId === currentUserId)?.id === event.responsiblePersonId && (
                    <button
                      onClick={() => handleDeclineResponsibility(event.id)}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      Can't Help
                    </button>
                  )}

                  <div className="flex space-x-1">
                    <button className="p-2 text-gray-400 hover:text-blue-600" title="Send reminder">
                      <Bell className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-green-600" title="Call">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-blue-600" title="Email">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Car className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {selectedFilter === 'unassigned' 
                ? 'No appointments need help right now' 
                : selectedFilter === 'my_responsibilities'
                ? 'You have no upcoming responsibilities'
                : 'No appointments requiring transportation'
              }
            </h4>
            <p className="text-gray-500">
              {selectedFilter === 'unassigned' 
                ? 'All upcoming appointments have transportation arranged.'
                : selectedFilter === 'my_responsibilities'
                ? 'Check back later or help with unassigned appointments.'
                : 'Appointments requiring family assistance will appear here.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}