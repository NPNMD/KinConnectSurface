import React, { useState, useEffect } from 'react';
import { Bell, X, Clock, Calendar, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { MedicalEvent } from '@shared/types';

interface Notification {
  id: string;
  type: 'reminder' | 'appointment' | 'medication' | 'family' | 'system';
  title: string;
  message: string;
  eventId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  readAt?: Date;
  actionRequired?: boolean;
  actionText?: string;
  actionCallback?: () => void;
}

interface NotificationSystemProps {
  events: MedicalEvent[];
  patientId: string;
}

export default function NotificationSystem({ events, patientId }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Generate notifications based on events
  useEffect(() => {
    const generateNotifications = () => {
      const now = new Date();
      const newNotifications: Notification[] = [];

      events.forEach(event => {
        const eventDate = new Date(event.startDateTime);
        const timeDiff = eventDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const hoursDiff = Math.ceil(timeDiff / (1000 * 3600));

        // 24-hour reminder
        if (daysDiff === 1 && hoursDiff <= 24 && hoursDiff > 23) {
          newNotifications.push({
            id: `${event.id}-24h`,
            type: 'reminder',
            title: 'Appointment Tomorrow',
            message: `${event.title} is scheduled for tomorrow at ${event.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            eventId: event.id,
            priority: event.priority === 'emergency' || event.priority === 'urgent' ? 'urgent' : 'medium',
            createdAt: now,
            actionRequired: event.status === 'scheduled',
            actionText: 'Confirm Appointment',
            actionCallback: () => console.log('Confirm appointment', event.id)
          });
        }

        // 2-hour reminder
        if (hoursDiff <= 2 && hoursDiff > 0) {
          newNotifications.push({
            id: `${event.id}-2h`,
            type: 'reminder',
            title: 'Appointment Soon',
            message: `${event.title} starts in ${hoursDiff} hour${hoursDiff > 1 ? 's' : ''}`,
            eventId: event.id,
            priority: 'high',
            createdAt: now,
            actionRequired: event.requiresTransportation && !event.responsiblePersonId,
            actionText: 'Arrange Transportation',
            actionCallback: () => console.log('Arrange transportation', event.id)
          });
        }

        // Transportation reminders
        if (event.requiresTransportation && !event.responsiblePersonId && daysDiff <= 3) {
          newNotifications.push({
            id: `${event.id}-transport`,
            type: 'family',
            title: 'Transportation Needed',
            message: `${event.title} on ${eventDate.toLocaleDateString()} needs transportation assistance`,
            eventId: event.id,
            priority: 'medium',
            createdAt: now,
            actionRequired: true,
            actionText: 'Assign Family Member',
            actionCallback: () => console.log('Assign family member', event.id)
          });
        }

        // Preparation reminders
        if (event.preparationInstructions && daysDiff === 1) {
          newNotifications.push({
            id: `${event.id}-prep`,
            type: 'reminder',
            title: 'Appointment Preparation',
            message: `Don't forget: ${event.preparationInstructions}`,
            eventId: event.id,
            priority: 'medium',
            createdAt: now
          });
        }

        // Insurance verification reminders
        if (event.insuranceRequired && daysDiff <= 7 && daysDiff > 0) {
          newNotifications.push({
            id: `${event.id}-insurance`,
            type: 'reminder',
            title: 'Insurance Verification',
            message: `Verify insurance coverage for ${event.title}`,
            eventId: event.id,
            priority: 'medium',
            createdAt: now,
            actionRequired: true,
            actionText: 'Verify Insurance',
            actionCallback: () => console.log('Verify insurance', event.id)
          });
        }
      });

      // Remove duplicates and sort by priority and date
      const uniqueNotifications = newNotifications.filter((notification, index, self) =>
        index === self.findIndex(n => n.id === notification.id)
      );

      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      uniqueNotifications.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setNotifications(uniqueNotifications);
      setUnreadCount(uniqueNotifications.filter(n => !n.readAt).length);
    };

    generateNotifications();
    
    // Update notifications every 5 minutes to reduce API calls
    const interval = setInterval(generateNotifications, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [events]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(notification =>
      notification.id === notificationId
        ? { ...notification, readAt: new Date() }
        : notification
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    const now = new Date();
    setNotifications(prev => prev.map(notification => ({
      ...notification,
      readAt: notification.readAt || now
    })));
    setUnreadCount(0);
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === notificationId);
      return notification && !notification.readAt ? Math.max(0, prev - 1) : prev;
    });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'reminder':
        return <Clock className="w-4 h-4" />;
      case 'appointment':
        return <Calendar className="w-4 h-4" />;
      case 'medication':
        return <AlertCircle className="w-4 h-4" />;
      case 'family':
        return <Info className="w-4 h-4" />;
      case 'system':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50';
      case 'low':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${getNotificationColor(notification.priority)} ${
                    !notification.readAt ? 'bg-opacity-100' : 'bg-opacity-50'
                  }`}
                  onClick={() => !notification.readAt && markAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`flex-shrink-0 ${
                        notification.priority === 'urgent' ? 'text-red-600' :
                        notification.priority === 'high' ? 'text-orange-600' :
                        notification.priority === 'medium' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          {!notification.readAt && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notification.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        
                        {/* Action Button */}
                        {notification.actionRequired && notification.actionText && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              notification.actionCallback?.();
                            }}
                            className="mt-2 px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                          >
                            {notification.actionText}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notification.id);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}