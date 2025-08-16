import { adminAuth } from '../firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
  clickAction?: string;
  badge?: number;
  sound?: string;
  priority?: 'normal' | 'high';
  timeToLive?: number;
}

export interface PushNotificationTarget {
  token?: string;
  tokens?: string[];
  topic?: string;
  condition?: string;
}

export interface PushNotificationOptions {
  android?: {
    priority?: 'normal' | 'high';
    ttl?: number;
    collapseKey?: string;
    restrictedPackageName?: string;
    notification?: {
      title?: string;
      body?: string;
      icon?: string;
      color?: string;
      sound?: string;
      tag?: string;
      clickAction?: string;
      bodyLocKey?: string;
      bodyLocArgs?: string[];
      titleLocKey?: string;
      titleLocArgs?: string[];
      channelId?: string;
      ticker?: string;
      sticky?: boolean;
      eventTime?: Date;
      localOnly?: boolean;
      notificationPriority?: 'PRIORITY_UNSPECIFIED' | 'PRIORITY_MIN' | 'PRIORITY_LOW' | 'PRIORITY_DEFAULT' | 'PRIORITY_HIGH' | 'PRIORITY_MAX';
      defaultSound?: boolean;
      defaultVibrateTimings?: boolean;
      defaultLightSettings?: boolean;
      vibrateTimings?: string[];
      visibility?: 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'PUBLIC' | 'SECRET';
      notificationCount?: number;
    };
    fcmOptions?: {
      analyticsLabel?: string;
    };
  };
  apns?: {
    headers?: { [key: string]: string };
    payload?: {
      aps?: {
        alert?: string | {
          title?: string;
          subtitle?: string;
          body?: string;
          locKey?: string;
          locArgs?: string[];
          titleLocKey?: string;
          titleLocArgs?: string[];
          subtitleLocKey?: string;
          subtitleLocArgs?: string[];
          actionLocKey?: string;
          launchImage?: string;
        };
        badge?: number;
        sound?: string | {
          critical?: boolean;
          name?: string;
          volume?: number;
        };
        contentAvailable?: boolean;
        mutableContent?: boolean;
        category?: string;
        threadId?: string;
        targetContentId?: string;
        interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
        relevanceScore?: number;
        filterCriteria?: string;
        staleDate?: number;
        contentState?: { [key: string]: any };
        timestamp?: number;
        event?: 'update' | 'end';
        dismissalDate?: number;
        attributesType?: string;
        attributes?: { [key: string]: any };
      };
      [key: string]: any;
    };
    fcmOptions?: {
      analyticsLabel?: string;
      image?: string;
    };
  };
  webpush?: {
    headers?: { [key: string]: string };
    data?: { [key: string]: string };
    notification?: {
      title?: string;
      body?: string;
      icon?: string;
      badge?: string;
      image?: string;
      lang?: string;
      tag?: string;
      dir?: 'auto' | 'ltr' | 'rtl';
      renotify?: boolean;
      requireInteraction?: boolean;
      silent?: boolean;
      timestamp?: number;
      vibrate?: number[];
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
      data?: any;
    };
    fcmOptions?: {
      link?: string;
      analyticsLabel?: string;
    };
  };
  fcmOptions?: {
    analyticsLabel?: string;
  };
}

export class PushNotificationService {
  private messaging = getMessaging();

  /**
   * Send a push notification to a single device token
   */
  async sendToToken(
    token: string,
    payload: PushNotificationPayload,
    options?: PushNotificationOptions
  ): Promise<string> {
    try {
      const message = this.buildMessage(payload, { token }, options);
      const response = await this.messaging.send(message);
      console.log('✅ Push notification sent successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      throw error;
    }
  }

  /**
   * Send push notifications to multiple device tokens
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
    options?: PushNotificationOptions
  ): Promise<{ successCount: number; failureCount: number; responses: any[] }> {
    try {
      const message = this.buildMessage(payload, {}, options);
      const response = await this.messaging.sendMulticast({
        ...message,
        tokens
      });
      
      console.log('✅ Push notifications sent:', {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`❌ Failed to send to token ${tokens[idx]}:`, resp.error);
          }
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Error sending push notifications to multiple tokens:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
    options?: PushNotificationOptions
  ): Promise<string> {
    try {
      const message = this.buildMessage(payload, { topic }, options);
      const response = await this.messaging.send(message);
      console.log('✅ Push notification sent to topic:', response);
      return response;
    } catch (error) {
      console.error('❌ Error sending push notification to topic:', error);
      throw error;
    }
  }

  /**
   * Send push notification based on condition
   */
  async sendToCondition(
    condition: string,
    payload: PushNotificationPayload,
    options?: PushNotificationOptions
  ): Promise<string> {
    try {
      const message = this.buildMessage(payload, { condition }, options);
      const response = await this.messaging.send(message);
      console.log('✅ Push notification sent to condition:', response);
      return response;
    } catch (error) {
      console.error('❌ Error sending push notification to condition:', error);
      throw error;
    }
  }

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await this.messaging.subscribeToTopic(tokens, topic);
      console.log(`✅ Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      console.error('❌ Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await this.messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`✅ Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      console.error('❌ Error unsubscribing from topic:', error);
      throw error;
    }
  }

  /**
   * Build FCM message object
   */
  private buildMessage(
    payload: PushNotificationPayload,
    target: PushNotificationTarget,
    options?: PushNotificationOptions
  ): any {
    const message: any = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl })
      },
      data: payload.data || {},
      ...target
    };

    // Add platform-specific options
    if (options?.android) {
      message.android = options.android;
    }

    if (options?.apns) {
      message.apns = options.apns;
    }

    if (options?.webpush) {
      message.webpush = options.webpush;
    }

    if (options?.fcmOptions) {
      message.fcmOptions = options.fcmOptions;
    }

    return message;
  }

  /**
   * Medical appointment reminder notification
   */
  async sendAppointmentReminder(
    tokens: string[],
    appointmentData: {
      patientName: string;
      doctorName: string;
      appointmentTime: Date;
      location: string;
      appointmentType: string;
    }
  ): Promise<void> {
    const timeString = appointmentData.appointmentTime.toLocaleString();
    
    await this.sendToTokens(tokens, {
      title: '🏥 Appointment Reminder',
      body: `${appointmentData.patientName} has an appointment with Dr. ${appointmentData.doctorName} at ${timeString}`,
      data: {
        type: 'appointment_reminder',
        appointmentId: `${appointmentData.patientName}_${appointmentData.appointmentTime.getTime()}`,
        patientName: appointmentData.patientName,
        doctorName: appointmentData.doctorName,
        location: appointmentData.location,
        appointmentType: appointmentData.appointmentType,
        appointmentTime: appointmentData.appointmentTime.toISOString()
      },
      clickAction: '/calendar',
      priority: 'high'
    }, {
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_medical',
          color: '#4CAF50',
          channelId: 'medical_appointments',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'APPOINTMENT_REMINDER',
            interruptionLevel: 'timeSensitive'
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icons/medical-icon.png',
          badge: '/icons/badge-icon.png',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Details'
            },
            {
              action: 'snooze',
              title: 'Remind Later'
            }
          ]
        },
        fcmOptions: {
          link: '/calendar'
        }
      }
    });
  }

  /**
   * Transportation coordination notification
   */
  async sendTransportationNotification(
    tokens: string[],
    transportData: {
      patientName: string;
      appointmentTime: Date;
      pickupLocation: string;
      destination: string;
      driverName?: string;
      isRequest: boolean;
    }
  ): Promise<void> {
    const timeString = transportData.appointmentTime.toLocaleString();
    const title = transportData.isRequest 
      ? '🚗 Transportation Needed' 
      : '✅ Transportation Confirmed';
    
    const body = transportData.isRequest
      ? `${transportData.patientName} needs transportation to appointment at ${timeString}`
      : `${transportData.driverName} will provide transportation for ${transportData.patientName}`;

    await this.sendToTokens(tokens, {
      title,
      body,
      data: {
        type: 'transportation',
        subType: transportData.isRequest ? 'request' : 'confirmation',
        patientName: transportData.patientName,
        appointmentTime: transportData.appointmentTime.toISOString(),
        pickupLocation: transportData.pickupLocation,
        destination: transportData.destination,
        ...(transportData.driverName && { driverName: transportData.driverName })
      },
      clickAction: '/transportation',
      priority: 'high'
    }, {
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_car',
          color: '#2196F3',
          channelId: 'transportation',
          defaultSound: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'TRANSPORTATION',
            interruptionLevel: 'active'
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icons/car-icon.png',
          actions: transportData.isRequest ? [
            {
              action: 'accept',
              title: 'I Can Drive'
            },
            {
              action: 'view',
              title: 'View Details'
            }
          ] : [
            {
              action: 'view',
              title: 'View Details'
            }
          ]
        },
        fcmOptions: {
          link: '/transportation'
        }
      }
    });
  }

  /**
   * Emergency notification
   */
  async sendEmergencyNotification(
    tokens: string[],
    emergencyData: {
      patientName: string;
      emergencyType: string;
      location: string;
      contactNumber: string;
      additionalInfo?: string;
    }
  ): Promise<void> {
    await this.sendToTokens(tokens, {
      title: '🚨 EMERGENCY ALERT',
      body: `${emergencyData.emergencyType} - ${emergencyData.patientName} at ${emergencyData.location}`,
      data: {
        type: 'emergency',
        patientName: emergencyData.patientName,
        emergencyType: emergencyData.emergencyType,
        location: emergencyData.location,
        contactNumber: emergencyData.contactNumber,
        ...(emergencyData.additionalInfo && { additionalInfo: emergencyData.additionalInfo }),
        timestamp: new Date().toISOString()
      },
      clickAction: '/emergency',
      priority: 'high'
    }, {
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_emergency',
          color: '#F44336',
          channelId: 'emergency_alerts',
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationPriority: 'PRIORITY_MAX'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: {
              critical: true,
              name: 'emergency.wav',
              volume: 1.0
            },
            badge: 1,
            category: 'EMERGENCY',
            interruptionLevel: 'critical'
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icons/emergency-icon.png',
          requireInteraction: true,
          silent: false,
          actions: [
            {
              action: 'call',
              title: 'Call Now'
            },
            {
              action: 'navigate',
              title: 'Get Directions'
            }
          ]
        }
      }
    });
  }

  /**
   * Family coordination notification
   */
  async sendFamilyCoordinationNotification(
    tokens: string[],
    coordinationData: {
      senderName: string;
      message: string;
      actionRequired?: boolean;
      relatedAppointment?: {
        patientName: string;
        appointmentTime: Date;
      };
    }
  ): Promise<void> {
    const title = coordinationData.actionRequired 
      ? '👨‍👩‍👧‍👦 Action Required' 
      : '👨‍👩‍👧‍👦 Family Update';

    await this.sendToTokens(tokens, {
      title,
      body: `${coordinationData.senderName}: ${coordinationData.message}`,
      data: {
        type: 'family_coordination',
        senderName: coordinationData.senderName,
        message: coordinationData.message,
        actionRequired: coordinationData.actionRequired?.toString() || 'false',
        ...(coordinationData.relatedAppointment && {
          relatedPatient: coordinationData.relatedAppointment.patientName,
          relatedAppointmentTime: coordinationData.relatedAppointment.appointmentTime.toISOString()
        })
      },
      clickAction: '/family',
      priority: coordinationData.actionRequired ? 'high' : 'normal'
    }, {
      android: {
        priority: coordinationData.actionRequired ? 'high' : 'normal',
        notification: {
          icon: 'ic_family',
          color: '#9C27B0',
          channelId: 'family_coordination'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'FAMILY_COORDINATION',
            interruptionLevel: coordinationData.actionRequired ? 'active' : 'passive'
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icons/family-icon.png',
          actions: [
            {
              action: 'reply',
              title: 'Reply'
            },
            {
              action: 'view',
              title: 'View Details'
            }
          ]
        },
        fcmOptions: {
          link: '/family'
        }
      }
    });
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();