# KinConnect Notification System Documentation

## Overview

The KinConnect notification system is a comprehensive, multi-channel communication platform designed specifically for medical appointment coordination and family care management. It provides reliable, timely, and contextual notifications across email, SMS, push notifications, and in-app messaging.

## Architecture

### Core Components

#### 1. Notification Service (`server/services/notificationService.ts`)
- **Purpose**: Central orchestration of all notification activities
- **Features**:
  - Template-based messaging with Handlebars-style variables
  - Multi-channel delivery coordination
  - User preference management
  - Notification scheduling and retry logic
  - Comprehensive logging and analytics

#### 2. Push Notification Service (`server/services/pushNotificationService.ts`)
- **Purpose**: Firebase Cloud Messaging (FCM) integration
- **Features**:
  - Cross-platform push notifications (iOS, Android, Web)
  - Rich notification payloads with actions
  - Topic-based and targeted messaging
  - Device token management
  - Platform-specific customization (APNs, FCM, WebPush)

#### 3. SMS Notification Service (`server/services/smsNotificationService.ts`)
- **Purpose**: Twilio-based SMS delivery
- **Features**:
  - International SMS support
  - Batch messaging capabilities
  - Phone number validation and formatting
  - Delivery status tracking
  - Cost optimization features

#### 4. Family Notification Service (`server/services/familyNotificationService.ts`)
- **Purpose**: Family-specific notification logic
- **Features**:
  - Permission-based notification routing
  - Quiet hours respect
  - Emergency contact prioritization
  - Transportation coordination workflows
  - Medication reminder management

#### 5. Notification Scheduler (`server/services/notificationScheduler.ts`)
- **Purpose**: Time-based notification management
- **Features**:
  - Appointment reminder scheduling
  - Recurring notification support
  - Timezone-aware scheduling
  - Retry mechanisms with exponential backoff
  - Bulk scheduling operations

#### 6. Testing & Troubleshooting Service (`server/services/notificationTestingService.ts`)
- **Purpose**: System health monitoring and testing
- **Features**:
  - Multi-channel testing capabilities
  - Performance metrics collection
  - Diagnostic report generation
  - Error pattern analysis
  - Automated health checks

### Frontend Components

#### 1. Notification Preferences (`client/src/components/NotificationPreferences.tsx`)
- **Purpose**: User preference management interface
- **Features**:
  - Channel-specific settings
  - Notification type controls
  - Reminder timing configuration
  - Quiet hours management
  - Real-time testing capabilities

#### 2. Notification History (`client/src/components/NotificationHistory.tsx`)
- **Purpose**: Historical notification tracking and analytics
- **Features**:
  - Comprehensive notification logs
  - Advanced filtering and search
  - Performance analytics dashboard
  - Delivery rate monitoring
  - Export capabilities

#### 3. Notification Troubleshooting (`client/src/components/NotificationTroubleshooting.tsx`)
- **Purpose**: System monitoring and diagnostic interface
- **Features**:
  - Real-time system health monitoring
  - Interactive testing tools
  - Diagnostic report generation
  - Performance metrics visualization
  - Error analysis and recommendations

## Notification Types

### 1. Appointment Reminders
- **Triggers**: Scheduled based on user preferences (24h, 2h, 15min before)
- **Recipients**: Patient and authorized family members
- **Channels**: Email, SMS, Push, In-App
- **Content**: Appointment details, preparation instructions, transportation needs

### 2. Transportation Coordination
- **Triggers**: 72 hours before appointment (if transportation required)
- **Recipients**: Family members with driving permissions
- **Channels**: Email, SMS, Push
- **Content**: Pickup details, destination, contact information

### 3. Emergency Alerts
- **Triggers**: Manual activation or automated detection
- **Recipients**: All emergency contacts + family members
- **Channels**: All available channels (overrides quiet hours)
- **Content**: Emergency type, location, contact information, instructions

### 4. Family Coordination
- **Triggers**: Manual messages or system events
- **Recipients**: Family members with appropriate permissions
- **Channels**: Based on message priority and user preferences
- **Content**: Coordination messages, status updates, action requests

### 5. Medication Reminders
- **Triggers**: Scheduled medication times
- **Recipients**: Patient and medication managers
- **Channels**: Push, In-App (primarily)
- **Content**: Medication name, dosage, instructions

## Configuration

### Environment Variables

```bash
# Email Service (using existing emailService)
EMAIL_SERVICE_ENABLED=true

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Push Notifications (Firebase)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your_project_id

# Application URLs
CLIENT_URL=https://your-app.com
API_URL=https://api.your-app.com
```

### Firebase Configuration

1. **Setup Firebase Project**:
   - Create project in Firebase Console
   - Enable Cloud Messaging
   - Generate service account key
   - Configure client apps (iOS, Android, Web)

2. **Client Configuration**:
   ```javascript
   // Firebase config in client app
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     messagingSenderId: "123456789"
   };
   ```

### Twilio Configuration

1. **Account Setup**:
   - Create Twilio account
   - Purchase phone number
   - Configure webhooks for delivery status

2. **Webhook Endpoints**:
   ```
   POST /api/webhooks/sms-status
   POST /api/webhooks/sms-reply
   ```

## Usage Examples

### Basic Notification Sending

```typescript
import { notificationService } from './services/notificationService';

// Send simple notification
await notificationService.sendNotification({
  userId: 'user123',
  patientId: 'patient456',
  type: 'appointment_reminder',
  channel: 'email',
  recipient: 'user@example.com',
  subject: 'Appointment Tomorrow',
  message: 'You have an appointment with Dr. Smith tomorrow at 2 PM.',
  status: 'pending',
  retryCount: 0,
  maxRetries: 3,
  priority: 'medium'
});
```

### Family Notification

```typescript
import { familyNotificationService } from './services/familyNotificationService';

// Send appointment reminder to family
await familyNotificationService.sendAppointmentReminder('patient123', {
  id: 'appt456',
  patientName: 'John Doe',
  doctorName: 'Dr. Smith',
  appointmentTime: new Date('2024-01-20T14:00:00'),
  location: 'Medical Center',
  appointmentType: 'Cardiology Consultation',
  requiresTransportation: true
}, 1440); // 24 hours before
```

### Scheduled Notifications

```typescript
import { notificationScheduler } from './services/notificationScheduler';

// Schedule appointment reminders
await notificationScheduler.scheduleAppointmentReminders('appt123', {
  patientId: 'patient456',
  patientName: 'John Doe',
  doctorName: 'Dr. Smith',
  appointmentTime: new Date('2024-01-20T14:00:00'),
  location: 'Medical Center',
  appointmentType: 'Consultation',
  familyMembers: [
    {
      userId: 'family1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      pushTokens: ['token123'],
      notificationPreferences: {
        email: true,
        push: true,
        sms: false,
        reminderTimes: [1440, 60, 15]
      }
    }
  ]
});
```

### Testing Notifications

```typescript
import { notificationTestingService } from './services/notificationTestingService';

// Test single channel
const result = await notificationTestingService.testSingleChannel(
  'email',
  'test@example.com',
  'Test message'
);

// Test all channels for user
const suite = await notificationTestingService.testAllChannels({
  email: 'user@example.com',
  phone: '+1234567890',
  pushTokens: ['token123'],
  userId: 'user123'
});

// Generate diagnostic report
const report = await notificationTestingService.generateDiagnosticReport();
```

## Database Schema

### Notification Logs
```typescript
interface NotificationLog {
  id: string;
  userId: string;
  patientId: string;
  eventId?: string;
  type: 'appointment_reminder' | 'transportation_needed' | 'emergency' | 'medication';
  channel: 'email' | 'sms' | 'push' | 'in_app';
  recipient: string;
  subject?: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  createdAt: Date;
  updatedAt: Date;
}
```

### Scheduled Notifications
```typescript
interface ScheduledNotification {
  id: string;
  userId: string;
  type: 'appointment_reminder' | 'transportation_request';
  scheduledTime: Date;
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification Preferences
```typescript
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
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
  };
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### Notification Management
```
POST   /api/notifications/send              # Send immediate notification
GET    /api/notifications/history           # Get notification history
POST   /api/notifications/schedule          # Schedule notification
DELETE /api/notifications/cancel/:id        # Cancel scheduled notification
```

### Preferences
```
GET    /api/notifications/preferences       # Get user preferences
PUT    /api/notifications/preferences       # Update preferences
POST   /api/notifications/test-channel      # Test notification channel
```

### Family Notifications
```
POST   /api/notifications/family/appointment    # Send appointment reminder
POST   /api/notifications/family/transportation # Send transportation request
POST   /api/notifications/family/emergency      # Send emergency alert
POST   /api/notifications/family/coordination   # Send coordination message
```

### Testing & Diagnostics
```
POST   /api/notifications/test/single       # Test single channel
POST   /api/notifications/test/multi        # Test all channels
POST   /api/notifications/test/family       # Test family notifications
GET    /api/notifications/diagnostics       # Get diagnostic report
POST   /api/notifications/diagnostics/run   # Run diagnostics
```

## Error Handling

### Common Error Types

1. **Configuration Errors**:
   - Missing API keys
   - Invalid service configuration
   - Network connectivity issues

2. **Delivery Failures**:
   - Invalid recipient addresses
   - Service rate limits
   - Temporary service outages

3. **Permission Errors**:
   - Insufficient user permissions
   - Blocked recipients
   - Expired authentication tokens

### Error Recovery

1. **Automatic Retry**: Failed notifications are automatically retried with exponential backoff
2. **Fallback Channels**: If primary channel fails, system attempts alternative channels
3. **Manual Retry**: Administrators can manually retry failed notifications
4. **Error Reporting**: All errors are logged with detailed context for troubleshooting

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Group similar notifications for efficient delivery
2. **Rate Limiting**: Respect service provider rate limits
3. **Caching**: Cache user preferences and templates
4. **Queue Management**: Use message queues for high-volume scenarios
5. **Database Indexing**: Optimize queries with proper indexing

### Monitoring Metrics

1. **Delivery Rate**: Percentage of successfully delivered notifications
2. **Response Time**: Average time from trigger to delivery
3. **Error Rate**: Percentage of failed notifications
4. **Throughput**: Notifications processed per minute
5. **Cost Tracking**: Monitor SMS and push notification costs

## Security

### Data Protection

1. **Encryption**: All sensitive data encrypted in transit and at rest
2. **Access Control**: Role-based permissions for notification access
3. **Audit Logging**: Complete audit trail of all notification activities
4. **Data Retention**: Configurable retention policies for notification logs

### Privacy Compliance

1. **HIPAA Compliance**: Medical information handling follows HIPAA guidelines
2. **Consent Management**: Users can opt-out of non-essential notifications
3. **Data Minimization**: Only necessary data included in notifications
4. **Anonymization**: Personal data anonymized in analytics

## Troubleshooting

### Common Issues

1. **Notifications Not Delivered**:
   - Check service configuration
   - Verify recipient addresses
   - Review error logs
   - Test individual channels

2. **Delayed Notifications**:
   - Check scheduler status
   - Review system load
   - Verify timezone settings
   - Check rate limiting

3. **High Error Rates**:
   - Review error patterns
   - Check service status
   - Validate configuration
   - Monitor rate limits

### Diagnostic Tools

1. **Health Dashboard**: Real-time system health monitoring
2. **Test Suite**: Comprehensive testing tools
3. **Error Analysis**: Pattern recognition and recommendations
4. **Performance Metrics**: Detailed performance analytics

## Future Enhancements

### Planned Features

1. **AI-Powered Optimization**: Machine learning for optimal delivery timing
2. **Advanced Templates**: Rich media templates with dynamic content
3. **Integration Expansion**: Additional service providers and channels
4. **Predictive Analytics**: Proactive issue detection and resolution
5. **Voice Notifications**: Integration with voice calling services

### Scalability Improvements

1. **Microservices Architecture**: Break down into smaller, focused services
2. **Event-Driven Architecture**: Implement event sourcing for better scalability
3. **Multi-Region Deployment**: Global distribution for reduced latency
4. **Auto-Scaling**: Dynamic resource allocation based on load

## Support

### Documentation
- API Reference: `/docs/api`
- Integration Guide: `/docs/integration`
- Troubleshooting: `/docs/troubleshooting`

### Contact
- Technical Support: support@kinconnect.com
- Emergency Issues: emergency@kinconnect.com
- Documentation Updates: docs@kinconnect.com

---

*Last Updated: January 2024*
*Version: 1.0.0*