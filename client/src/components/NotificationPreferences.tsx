import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Clock, 
  Volume2, 
  VolumeX, 
  Settings,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface NotificationPreferences {
  userId: string;
  patientId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  reminderTiming: number[]; // minutes before appointment
  emergencyNotifications: boolean;
  familyNotifications: boolean;
  transportationNotifications: boolean;
  medicationReminders: boolean;
  appointmentConfirmations: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationChannel {
  id: 'email' | 'sms' | 'push' | 'in_app';
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  enabled: boolean;
  testable: boolean;
}

interface NotificationType {
  id: keyof Pick<NotificationPreferences, 
    'emergencyNotifications' | 'familyNotifications' | 'transportationNotifications' | 
    'medicationReminders' | 'appointmentConfirmations'>;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
}

interface ReminderTime {
  value: number;
  label: string;
  description: string;
}

const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: '',
    patientId: '',
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    inAppNotifications: true,
    reminderTiming: [1440, 60, 15], // 24h, 1h, 15min
    emergencyNotifications: true,
    familyNotifications: true,
    transportationNotifications: true,
    medicationReminders: true,
    appointmentConfirmations: true,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00'
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: 'success' | 'error' | null }>({});
  const [activeTab, setActiveTab] = useState<'channels' | 'types' | 'timing' | 'quiet'>('channels');

  const channels: NotificationChannel[] = [
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      description: 'Receive notifications via email',
      enabled: preferences.emailNotifications,
      testable: true
    },
    {
      id: 'sms',
      name: 'SMS',
      icon: MessageSquare,
      description: 'Receive text message notifications',
      enabled: preferences.smsNotifications,
      testable: true
    },
    {
      id: 'push',
      name: 'Push Notifications',
      icon: Smartphone,
      description: 'Receive push notifications on your device',
      enabled: preferences.pushNotifications,
      testable: true
    },
    {
      id: 'in_app',
      name: 'In-App',
      icon: Bell,
      description: 'Show notifications within the application',
      enabled: preferences.inAppNotifications,
      testable: false
    }
  ];

  const notificationTypes: NotificationType[] = [
    {
      id: 'emergencyNotifications',
      name: 'Emergency Alerts',
      description: 'Critical medical emergencies and urgent situations',
      priority: 'critical',
      enabled: preferences.emergencyNotifications,
      channels: ['email', 'sms', 'push', 'in_app']
    },
    {
      id: 'appointmentConfirmations',
      name: 'Appointment Reminders',
      description: 'Upcoming medical appointments and confirmations',
      priority: 'high',
      enabled: preferences.appointmentConfirmations,
      channels: ['email', 'push', 'in_app']
    },
    {
      id: 'transportationNotifications',
      name: 'Transportation Coordination',
      description: 'Transportation needs and driver assignments',
      priority: 'medium',
      enabled: preferences.transportationNotifications,
      channels: ['email', 'sms', 'push', 'in_app']
    },
    {
      id: 'medicationReminders',
      name: 'Medication Reminders',
      description: 'Medication schedules and refill notifications',
      priority: 'medium',
      enabled: preferences.medicationReminders,
      channels: ['push', 'in_app']
    },
    {
      id: 'familyNotifications',
      name: 'Family Updates',
      description: 'Family coordination and general updates',
      priority: 'low',
      enabled: preferences.familyNotifications,
      channels: ['email', 'in_app']
    }
  ];

  const reminderTimes: ReminderTime[] = [
    { value: 10080, label: '1 week', description: 'One week before appointment' },
    { value: 2880, label: '2 days', description: 'Two days before appointment' },
    { value: 1440, label: '1 day', description: 'One day before appointment' },
    { value: 720, label: '12 hours', description: 'Twelve hours before appointment' },
    { value: 120, label: '2 hours', description: 'Two hours before appointment' },
    { value: 60, label: '1 hour', description: 'One hour before appointment' },
    { value: 30, label: '30 minutes', description: 'Thirty minutes before appointment' },
    { value: 15, label: '15 minutes', description: 'Fifteen minutes before appointment' }
  ];

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // In a real app, this would fetch from the API
      // const response = await fetch('/api/notification-preferences');
      // const data = await response.json();
      // setPreferences(data);
      
      // For now, use default preferences
      console.log('Loading notification preferences...');
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      // In a real app, this would save to the API
      // await fetch('/api/notification-preferences', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(preferences)
      // });
      
      console.log('Saving preferences:', preferences);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPreferences(prev => ({ ...prev, updatedAt: new Date() }));
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const testNotificationChannel = async (channelId: string) => {
    setTestingChannel(channelId);
    setTestResults(prev => ({ ...prev, [channelId]: null }));
    
    try {
      // In a real app, this would call the test API
      // await fetch(`/api/test-notification/${channelId}`, { method: 'POST' });
      
      console.log(`Testing ${channelId} notification...`);
      
      // Simulate test delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate random success/failure for demo
      const success = Math.random() > 0.2;
      setTestResults(prev => ({ ...prev, [channelId]: success ? 'success' : 'error' }));
    } catch (error) {
      console.error(`Error testing ${channelId}:`, error);
      setTestResults(prev => ({ ...prev, [channelId]: 'error' }));
    } finally {
      setTestingChannel(null);
    }
  };

  const updateChannelPreference = (channelId: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [`${channelId}Notifications`]: enabled
    }));
  };

  const updateNotificationType = (typeId: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [typeId]: enabled
    }));
  };

  const updateReminderTiming = (times: number[]) => {
    setPreferences(prev => ({
      ...prev,
      reminderTiming: times
    }));
  };

  const updateQuietHours = (quietHours: NotificationPreferences['quietHours']) => {
    setPreferences(prev => ({
      ...prev,
      quietHours
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderChannelsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Channels</h3>
        <p className="text-sm text-gray-600 mb-6">
          Choose how you want to receive notifications. You can enable multiple channels for redundancy.
        </p>
      </div>

      <div className="grid gap-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const testResult = testResults[channel.id];
          
          return (
            <div key={channel.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{channel.name}</h4>
                    <p className="text-sm text-gray-500">{channel.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {channel.testable && (
                    <button
                      onClick={() => testNotificationChannel(channel.id)}
                      disabled={testingChannel === channel.id || !channel.enabled}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingChannel === channel.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-3 w-3 mr-1" />
                          Test
                        </>
                      )}
                    </button>
                  )}
                  
                  {testResult && (
                    <div className="flex items-center">
                      {testResult === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={(e) => updateChannelPreference(channel.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTypesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
        <p className="text-sm text-gray-600 mb-6">
          Control which types of notifications you want to receive. Emergency notifications are always enabled for safety.
        </p>
      </div>

      <div className="grid gap-4">
        {notificationTypes.map((type) => (
          <div key={type.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{type.name}</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(type.priority)}`}>
                    {type.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{type.description}</p>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Channels:</span>
                  {type.channels.map((channelId) => {
                    const channel = channels.find(c => c.id === channelId);
                    if (!channel) return null;
                    const Icon = channel.icon;
                    return (
                      <Icon key={channelId} className="h-3 w-3 text-gray-400" />
                    );
                  })}
                </div>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={type.enabled}
                  onChange={(e) => updateNotificationType(type.id, e.target.checked)}
                  disabled={type.priority === 'critical'}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTimingTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Reminder Timing</h3>
        <p className="text-sm text-gray-600 mb-6">
          Choose when you want to receive appointment reminders. You can select multiple times for redundancy.
        </p>
      </div>

      <div className="grid gap-3">
        {reminderTimes.map((time) => (
          <label key={time.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.reminderTiming.includes(time.value)}
              onChange={(e) => {
                if (e.target.checked) {
                  updateReminderTiming([...preferences.reminderTiming, time.value].sort((a, b) => b - a));
                } else {
                  updateReminderTiming(preferences.reminderTiming.filter(t => t !== time.value));
                }
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{time.label}</div>
              <div className="text-sm text-gray-500">{time.description}</div>
            </div>
          </label>
        ))}
      </div>

      {preferences.reminderTiming.length === 0 && (
        <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-800">
            No reminder times selected. You won't receive appointment reminders.
          </span>
        </div>
      )}
    </div>
  );

  const renderQuietHoursTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quiet Hours</h3>
        <p className="text-sm text-gray-600 mb-6">
          Set quiet hours to avoid non-urgent notifications during specific times. Emergency notifications will still be delivered.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={preferences.quietHours.enabled}
            onChange={(e) => updateQuietHours({ ...preferences.quietHours, enabled: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-900">Enable quiet hours</span>
        </label>

        {preferences.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={preferences.quietHours.startTime}
                onChange={(e) => updateQuietHours({ ...preferences.quietHours, startTime: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={preferences.quietHours.endTime}
                onChange={(e) => updateQuietHours({ ...preferences.quietHours, endTime: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Quiet Hours Information:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Emergency notifications will always be delivered</li>
              <li>Other notifications will be delayed until quiet hours end</li>
              <li>Times are based on your local timezone: {preferences.timezone}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h1>
        <p className="text-gray-600">
          Customize how and when you receive notifications about medical appointments and family coordination.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'channels', name: 'Channels', icon: Bell },
            { id: 'types', name: 'Types', icon: Settings },
            { id: 'timing', name: 'Timing', icon: Clock },
            { id: 'quiet', name: 'Quiet Hours', icon: VolumeX }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mb-8">
        {activeTab === 'channels' && renderChannelsTab()}
        {activeTab === 'types' && renderTypesTab()}
        {activeTab === 'timing' && renderTimingTab()}
        {activeTab === 'quiet' && renderQuietHoursTab()}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Last updated: {preferences.updatedAt.toLocaleString()}
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferences;