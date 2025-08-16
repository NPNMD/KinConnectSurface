import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Filter,
  Download,
  Search,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  RefreshCw
} from 'lucide-react';

interface NotificationLog {
  id: string;
  userId: string;
  patientId: string;
  eventId?: string;
  type: 'appointment_reminder' | 'transportation_needed' | 'family_responsibility' | 'emergency' | 'medication' | 'confirmation' | 'status_change';
  channel: 'email' | 'sms' | 'push' | 'in_app';
  recipient: string;
  subject?: string;
  message: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationAnalytics {
  total: number;
  sent: number;
  failed: number;
  deliveryRate: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  recentTrends: {
    date: string;
    sent: number;
    failed: number;
  }[];
}

interface FilterOptions {
  type: string;
  channel: string;
  status: string;
  priority: string;
  dateRange: {
    start: string;
    end: string;
  };
  searchTerm: string;
}

const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'analytics'>('history');
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    channel: 'all',
    status: 'all',
    priority: 'all',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Mock data for demonstration
  const mockNotifications: NotificationLog[] = [
    {
      id: '1',
      userId: 'user1',
      patientId: 'patient1',
      eventId: 'event1',
      type: 'appointment_reminder',
      channel: 'email',
      recipient: 'user@example.com',
      subject: 'Appointment Reminder: Dr. Smith Tomorrow',
      message: 'You have an appointment with Dr. Smith tomorrow at 2:00 PM.',
      status: 'delivered',
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000),
      retryCount: 0,
      maxRetries: 3,
      priority: 'medium',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000)
    },
    {
      id: '2',
      userId: 'user2',
      patientId: 'patient1',
      type: 'transportation_needed',
      channel: 'sms',
      recipient: '+1234567890',
      message: 'Transportation needed for appointment tomorrow. Can you help?',
      status: 'sent',
      sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      retryCount: 0,
      maxRetries: 3,
      priority: 'high',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
    },
    {
      id: '3',
      userId: 'user3',
      patientId: 'patient1',
      type: 'emergency',
      channel: 'push',
      recipient: 'user3',
      subject: 'Emergency Alert',
      message: 'Emergency situation requires immediate attention.',
      status: 'failed',
      sentAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      failureReason: 'Device token invalid',
      retryCount: 2,
      maxRetries: 3,
      priority: 'emergency',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000 + 60000)
    }
  ];

  const mockAnalytics: NotificationAnalytics = {
    total: 156,
    sent: 142,
    failed: 14,
    deliveryRate: 91.0,
    byType: {
      'appointment_reminder': 89,
      'transportation_needed': 34,
      'family_responsibility': 18,
      'emergency': 3,
      'medication': 12
    },
    byChannel: {
      'email': 78,
      'sms': 45,
      'push': 28,
      'in_app': 5
    },
    byPriority: {
      'low': 23,
      'medium': 89,
      'high': 34,
      'urgent': 7,
      'emergency': 3
    },
    byStatus: {
      'sent': 89,
      'delivered': 53,
      'failed': 14
    },
    recentTrends: [
      { date: '2024-01-15', sent: 12, failed: 1 },
      { date: '2024-01-16', sent: 15, failed: 2 },
      { date: '2024-01-17', sent: 18, failed: 0 },
      { date: '2024-01-18', sent: 14, failed: 3 },
      { date: '2024-01-19', sent: 16, failed: 1 },
      { date: '2024-01-20', sent: 20, failed: 2 },
      { date: '2024-01-21', sent: 22, failed: 1 }
    ]
  };

  useEffect(() => {
    loadNotificationHistory();
    loadAnalytics();
  }, [filters]);

  const loadNotificationHistory = async () => {
    setLoading(true);
    try {
      // In a real app, this would fetch from the API with filters
      // const response = await fetch('/api/notifications/history?' + new URLSearchParams(filters));
      // const data = await response.json();
      
      // For now, use mock data with filtering
      let filteredNotifications = mockNotifications;
      
      if (filters.type !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.type === filters.type);
      }
      if (filters.channel !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.channel === filters.channel);
      }
      if (filters.status !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.status === filters.status);
      }
      if (filters.priority !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.priority === filters.priority);
      }
      if (filters.searchTerm) {
        filteredNotifications = filteredNotifications.filter(n => 
          n.message.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          n.subject?.toLowerCase().includes(filters.searchTerm.toLowerCase())
        );
      }
      
      setNotifications(filteredNotifications);
    } catch (error) {
      console.error('Error loading notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      // In a real app, this would fetch analytics from the API
      // const response = await fetch('/api/notifications/analytics');
      // const data = await response.json();
      
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadNotificationHistory(), loadAnalytics()]);
    setRefreshing(false);
  };

  const exportData = () => {
    // In a real app, this would generate and download a CSV/Excel file
    const csvContent = [
      ['ID', 'Type', 'Channel', 'Status', 'Recipient', 'Sent At', 'Priority'],
      ...notifications.map(n => [
        n.id,
        n.type,
        n.channel,
        n.status,
        n.recipient,
        n.sentAt?.toISOString() || '',
        n.priority
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'push':
        return <Smartphone className="h-4 w-4" />;
      case 'in_app':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return 'bg-red-100 text-red-800';
      case 'urgent':
        return 'bg-orange-100 text-orange-800';
      case 'high':
        return 'bg-yellow-100 text-yellow-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderFilters = () => (
    <div className={`bg-gray-50 border-b border-gray-200 p-4 ${showFilters ? 'block' : 'hidden'}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Types</option>
            <option value="appointment_reminder">Appointment Reminders</option>
            <option value="transportation_needed">Transportation</option>
            <option value="family_responsibility">Family Coordination</option>
            <option value="emergency">Emergency</option>
            <option value="medication">Medication</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
          <select
            value={filters.channel}
            onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="in_app">In-App</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Priorities</option>
            <option value="emergency">Emergency</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              dateRange: { ...prev.dateRange, start: e.target.value }
            }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              dateRange: { ...prev.dateRange, end: e.target.value }
            }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <button
          onClick={exportData}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {renderFilters()}

      {/* Notification List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or date range.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <li key={notification.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex items-center space-x-2">
                      {getChannelIcon(notification.channel)}
                      {getStatusIcon(notification.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.subject || notification.type.replace('_', ' ')}
                        </p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {notification.message}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>To: {notification.recipient}</span>
                        <span>•</span>
                        <span>{notification.sentAt?.toLocaleString() || 'Not sent'}</span>
                        {notification.retryCount > 0 && (
                          <>
                            <span>•</span>
                            <span>Retries: {notification.retryCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      notification.status === 'delivered' || notification.status === 'sent' 
                        ? 'bg-green-100 text-green-800'
                        : notification.status === 'failed' || notification.status === 'bounced'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {notification.status}
                    </span>
                  </div>
                </div>
                
                {notification.failureReason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Failure reason:</strong> {notification.failureReason}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderAnalyticsTab = () => {
    if (!analytics) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Notifications</dt>
                    <dd className="text-lg font-medium text-gray-900">{analytics.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Successfully Sent</dt>
                    <dd className="text-lg font-medium text-gray-900">{analytics.sent}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Failed</dt>
                    <dd className="text-lg font-medium text-gray-900">{analytics.failed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Delivery Rate</dt>
                    <dd className="text-lg font-medium text-gray-900">{analytics.deliveryRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Type */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">By Type</h3>
              <div className="space-y-3">
                {Object.entries(analytics.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(count / analytics.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By Channel */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">By Channel</h3>
              <div className="space-y-3">
                {Object.entries(analytics.byChannel).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getChannelIcon(channel)}
                      <span className="text-sm text-gray-600 capitalize">{channel}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${(count / analytics.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trends */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Trends (Last 7 Days)</h3>
            <div className="mt-4">
              <div className="flex items-end space-x-2 h-32">
                {analytics.recentTrends.map((day, index) => (
                  <div key={day.date} className="flex flex-col items-center flex-1">
                    <div className="flex flex-col items-center space-y-1 mb-2">
                      <div 
                        className="w-full bg-green-500 rounded-t"
                        style={{ height: `${(day.sent / 25) * 80}px` }}
                        title={`${day.sent} sent`}
                      ></div>
                      <div 
                        className="w-full bg-red-500 rounded-b"
                        style={{ height: `${(day.failed / 25) * 80}px` }}
                        title={`${day.failed} failed`}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Sent</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Failed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Center</h1>
        <p className="text-gray-600">
          View notification history and analytics to monitor communication effectiveness.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'history', name: 'History', icon: Clock },
            { id: 'analytics', name: 'Analytics', icon: BarChart3 }
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
      <div>
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>
    </div>
  );
};

export default NotificationHistory;
                