import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, MapPin, User } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  attendees?: string[];
}

interface CalendarIntegrationProps {
  patientId: string;
}

export default function CalendarIntegration({ patientId }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    duration: '60',
    location: '',
    description: '',
    provider: ''
  });

  // Initialize Google Calendar API
  useEffect(() => {
    const initializeGoogleCalendar = async () => {
      try {
        // Check if Google Calendar API is available
        const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        
        console.log('📅 Checking Google Calendar API credentials...');
        console.log('📅 API Key available:', !!apiKey);
        console.log('📅 Client ID available:', !!clientId);
        console.log('📅 Environment variables available:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
        
        if (!apiKey || !clientId) {
          console.warn('📅 Google Calendar API credentials not found');
          if (!apiKey) console.warn('📅 Missing: VITE_GOOGLE_CALENDAR_API_KEY');
          if (!clientId) console.warn('📅 Missing: VITE_GOOGLE_CLIENT_ID');
          return;
        }
        
        console.log('📅 Google Calendar API credentials found, initializing...');

        // Load Google API
        if (typeof window !== 'undefined' && (window as any).gapi) {
          await (window as any).gapi.load('auth2', () => {
            (window as any).gapi.auth2.init({
              client_id: clientId,
            });
          });
          
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error initializing Google Calendar:', error);
      }
    };

    initializeGoogleCalendar();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      if ((window as any).gapi && (window as any).gapi.auth2) {
        const authInstance = (window as any).gapi.auth2.getAuthInstance();
        await authInstance.signIn({
          scope: 'https://www.googleapis.com/auth/calendar'
        });
        setIsAuthenticated(true);
        loadCalendarEvents();
      }
    } catch (error) {
      console.error('Error signing in to Google:', error);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would fetch from Google Calendar API
      // For now, we start with an empty array to show the empty state
      const events: CalendarEvent[] = [];
      
      setEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = async () => {
    try {
      if (!newEvent.title || !newEvent.date || !newEvent.time) {
        alert('Please fill in all required fields');
        return;
      }

      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(newEvent.duration) * 60 * 1000);

      const event: CalendarEvent = {
        id: Date.now().toString(),
        title: newEvent.title,
        start: startDateTime,
        end: endDateTime,
        location: newEvent.location,
        description: newEvent.description
      };

      // In a real implementation, this would create the event in Google Calendar
      setEvents(prev => [...prev, event]);
      
      // Reset form
      setNewEvent({
        title: '',
        date: '',
        time: '',
        duration: '60',
        location: '',
        description: '',
        provider: ''
      });
      setShowAddEvent(false);
      
      console.log('Event added:', event);
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const formatEventTime = (start: Date, end: Date) => {
    const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const formatEventDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Appointments</span>
        </h3>
        
        <div className="flex items-center space-x-3">
          {!isAuthenticated ? (
            <button
              onClick={handleGoogleSignIn}
              className="btn-secondary text-sm"
            >
              Connect Google Calendar
            </button>
          ) : (
            <button
              onClick={() => setShowAddEvent(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Event Form */}
      {showAddEvent && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">Schedule New Appointment</h4>
            <button
              onClick={() => setShowAddEvent(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Appointment Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="e.g., Dr. Smith - Annual Checkup"
              />
            </div>

            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="label">Time *</label>
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="label">Duration (minutes)</label>
              <select
                value={newEvent.duration}
                onChange={(e) => setNewEvent(prev => ({ ...prev, duration: e.target.value }))}
                className="input"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <div>
              <label className="label">Healthcare Provider</label>
              <input
                type="text"
                value={newEvent.provider}
                onChange={(e) => setNewEvent(prev => ({ ...prev, provider: e.target.value }))}
                className="input"
                placeholder="Dr. Smith, Cardiologist"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Location</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                className="input"
                placeholder="123 Medical Center Dr, City, State"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                rows={3}
                placeholder="Additional notes about the appointment"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowAddEvent(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddEvent}
              className="btn-primary"
            >
              Schedule Appointment
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      ) : events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">{event.title}</h4>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatEventDate(event.start)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatEventTime(event.start, event.end)}</span>
                    </div>
                    
                    {event.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h4>
          <p className="text-gray-500 mb-4">Schedule your first appointment to get started.</p>
          {isAuthenticated && (
            <button
              onClick={() => setShowAddEvent(true)}
              className="btn-primary flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Appointment</span>
            </button>
          )}
        </div>
      )}

      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Connect Google Calendar</h4>
              <p className="text-sm text-blue-700 mt-1">
                Connect your Google Calendar to sync appointments and get reminders across all your devices.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="mt-3 text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Connect Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}