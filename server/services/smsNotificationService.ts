import twilio from 'twilio';

export interface SMSNotificationPayload {
  to: string;
  message: string;
  mediaUrl?: string[];
  from?: string;
  statusCallback?: string;
  maxPrice?: string;
  provideFeedback?: boolean;
  attempt?: number;
  validityPeriod?: number;
  forceDelivery?: boolean;
  contentRetention?: 'retain' | 'discard';
  addressRetention?: 'retain' | 'discard';
  smartEncoded?: boolean;
  persistentAction?: string[];
  shortenUrls?: boolean;
  scheduleType?: 'fixed';
  sendAt?: Date;
  sendAsMms?: boolean;
  contentVariables?: string;
}

export interface SMSBatchPayload {
  recipients: string[];
  message: string;
  mediaUrl?: string[];
  personalizations?: { [phoneNumber: string]: { [key: string]: string } };
}

export interface SMSTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: 'appointment' | 'transportation' | 'emergency' | 'family' | 'reminder';
}

export class SMSNotificationService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private isConfigured: boolean = false;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (accountSid && authToken && this.fromNumber) {
      this.client = twilio(accountSid, authToken);
      this.isConfigured = true;
      console.log('✅ SMS Service initialized with Twilio');
    } else {
      console.log('⚠️  SMS Service not configured - missing Twilio credentials');
      console.log('💡 Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables');
      this.isConfigured = false;
    }
  }

  /**
   * Check if SMS service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a single SMS message
   */
  async sendSMS(payload: SMSNotificationPayload): Promise<string | null> {
    if (!this.isConfigured) {
      console.log('⚠️  SMS Service not configured, skipping SMS send');
      return null;
    }

    try {
      const messageOptions: any = {
        body: payload.message,
        from: payload.from || this.fromNumber,
        to: payload.to
      };

      // Add optional parameters
      if (payload.mediaUrl && payload.mediaUrl.length > 0) {
        messageOptions.mediaUrl = payload.mediaUrl;
      }
      if (payload.statusCallback) {
        messageOptions.statusCallback = payload.statusCallback;
      }
      if (payload.maxPrice) {
        messageOptions.maxPrice = payload.maxPrice;
      }
      if (payload.provideFeedback !== undefined) {
        messageOptions.provideFeedback = payload.provideFeedback;
      }
      if (payload.attempt) {
        messageOptions.attempt = payload.attempt;
      }
      if (payload.validityPeriod) {
        messageOptions.validityPeriod = payload.validityPeriod;
      }
      if (payload.sendAt) {
        messageOptions.scheduleType = 'fixed';
        messageOptions.sendAt = payload.sendAt;
      }

      if (!this.client) {
        throw new Error('SMS client not initialized');
      }
      const message = await this.client.messages.create(messageOptions);
      console.log('✅ SMS sent successfully:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendBatchSMS(payload: SMSBatchPayload): Promise<{ 
    successCount: number; 
    failureCount: number; 
    results: Array<{ phone: string; success: boolean; messageId?: string; error?: string }> 
  }> {
    if (!this.isConfigured) {
      console.log('⚠️  SMS Service not configured, skipping batch SMS send');
      return { successCount: 0, failureCount: payload.recipients.length, results: [] };
    }

    const results: Array<{ phone: string; success: boolean; messageId?: string; error?: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    for (const recipient of payload.recipients) {
      try {
        let message = payload.message;
        
        // Apply personalizations if available
        if (payload.personalizations && payload.personalizations[recipient]) {
          const personalizations = payload.personalizations[recipient];
          Object.keys(personalizations).forEach(key => {
            message = message.replace(new RegExp(`{{${key}}}`, 'g'), personalizations[key]);
          });
        }

        const messageId = await this.sendSMS({
          to: recipient,
          message,
          mediaUrl: payload.mediaUrl
        });

        if (messageId) {
          results.push({ phone: recipient, success: true, messageId });
          successCount++;
        } else {
          results.push({ phone: recipient, success: false, error: 'SMS service not configured' });
          failureCount++;
        }
      } catch (error) {
        results.push({ 
          phone: recipient, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        failureCount++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📱 Batch SMS completed: ${successCount} success, ${failureCount} failures`);
    return { successCount, failureCount, results };
  }

  /**
   * Send appointment reminder SMS
   */
  async sendAppointmentReminderSMS(
    phoneNumbers: string[],
    appointmentData: {
      patientName: string;
      doctorName: string;
      appointmentTime: Date;
      location: string;
      appointmentType: string;
      confirmationUrl?: string;
    }
  ): Promise<void> {
    const timeString = appointmentData.appointmentTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    let message = `🏥 APPOINTMENT REMINDER\n\n`;
    message += `Patient: ${appointmentData.patientName}\n`;
    message += `Doctor: Dr. ${appointmentData.doctorName}\n`;
    message += `Time: ${timeString}\n`;
    message += `Location: ${appointmentData.location}\n`;
    message += `Type: ${appointmentData.appointmentType}\n\n`;
    
    if (appointmentData.confirmationUrl) {
      message += `Confirm: ${appointmentData.confirmationUrl}\n\n`;
    }
    
    message += `Please arrive 15 minutes early. Reply STOP to opt out.`;

    await this.sendBatchSMS({
      recipients: phoneNumbers,
      message
    });
  }

  /**
   * Send transportation coordination SMS
   */
  async sendTransportationSMS(
    phoneNumbers: string[],
    transportData: {
      patientName: string;
      appointmentTime: Date;
      pickupLocation: string;
      destination: string;
      driverName?: string;
      isRequest: boolean;
      contactNumber?: string;
    }
  ): Promise<void> {
    const timeString = transportData.appointmentTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    let message: string;

    if (transportData.isRequest) {
      message = `🚗 TRANSPORTATION NEEDED\n\n`;
      message += `${transportData.patientName} needs a ride to their appointment.\n\n`;
      message += `📅 When: ${timeString}\n`;
      message += `📍 Pickup: ${transportData.pickupLocation}\n`;
      message += `🏥 Destination: ${transportData.destination}\n\n`;
      if (transportData.contactNumber) {
        message += `📞 Contact: ${transportData.contactNumber}\n\n`;
      }
      message += `Can you help? Reply YES if available.`;
    } else {
      message = `✅ TRANSPORTATION CONFIRMED\n\n`;
      message += `${transportData.driverName} will drive ${transportData.patientName}\n\n`;
      message += `📅 When: ${timeString}\n`;
      message += `📍 Pickup: ${transportData.pickupLocation}\n`;
      message += `🏥 Destination: ${transportData.destination}\n\n`;
      if (transportData.contactNumber) {
        message += `📞 Driver contact: ${transportData.contactNumber}\n\n`;
      }
      message += `Thank you for coordinating!`;
    }

    await this.sendBatchSMS({
      recipients: phoneNumbers,
      message
    });
  }

  /**
   * Send emergency SMS alert
   */
  async sendEmergencySMS(
    phoneNumbers: string[],
    emergencyData: {
      patientName: string;
      emergencyType: string;
      location: string;
      contactNumber: string;
      additionalInfo?: string;
      emergencyContactName?: string;
    }
  ): Promise<void> {
    let message = `🚨 EMERGENCY ALERT 🚨\n\n`;
    message += `${emergencyData.emergencyType.toUpperCase()}\n\n`;
    message += `Patient: ${emergencyData.patientName}\n`;
    message += `Location: ${emergencyData.location}\n`;
    message += `Contact: ${emergencyData.contactNumber}\n`;
    
    if (emergencyData.emergencyContactName) {
      message += `Reported by: ${emergencyData.emergencyContactName}\n`;
    }
    
    if (emergencyData.additionalInfo) {
      message += `\nDetails: ${emergencyData.additionalInfo}\n`;
    }
    
    message += `\nTime: ${new Date().toLocaleString()}\n\n`;
    message += `This is an automated emergency alert.`;

    // Send with high priority (immediate delivery)
    for (const phoneNumber of phoneNumbers) {
      await this.sendSMS({
        to: phoneNumber,
        message,
        validityPeriod: 14400, // 4 hours validity
        attempt: 1
      });
    }
  }

  /**
   * Send family coordination SMS
   */
  async sendFamilyCoordinationSMS(
    phoneNumbers: string[],
    coordinationData: {
      senderName: string;
      message: string;
      actionRequired?: boolean;
      relatedAppointment?: {
        patientName: string;
        appointmentTime: Date;
      };
      urgency?: 'low' | 'medium' | 'high';
    }
  ): Promise<void> {
    let smsMessage = `👨‍👩‍👧‍👦 FAMILY UPDATE\n\n`;
    
    if (coordinationData.actionRequired) {
      smsMessage += `⚠️  ACTION REQUIRED\n\n`;
    }
    
    smsMessage += `From: ${coordinationData.senderName}\n\n`;
    smsMessage += `${coordinationData.message}\n\n`;
    
    if (coordinationData.relatedAppointment) {
      const timeString = coordinationData.relatedAppointment.appointmentTime.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      smsMessage += `Related to: ${coordinationData.relatedAppointment.patientName}'s appointment on ${timeString}\n\n`;
    }
    
    smsMessage += `Sent: ${new Date().toLocaleString()}`;

    const validityPeriod = coordinationData.urgency === 'high' ? 3600 : // 1 hour
                          coordinationData.urgency === 'medium' ? 7200 : // 2 hours
                          14400; // 4 hours for low urgency

    await this.sendBatchSMS({
      recipients: phoneNumbers,
      message: smsMessage
    });
  }

  /**
   * Send medication reminder SMS
   */
  async sendMedicationReminderSMS(
    phoneNumbers: string[],
    medicationData: {
      patientName: string;
      medicationName: string;
      dosage: string;
      timeToTake: string;
      instructions?: string;
      refillReminder?: boolean;
      pillsRemaining?: number;
    }
  ): Promise<void> {
    let message = `💊 MEDICATION REMINDER\n\n`;
    message += `Patient: ${medicationData.patientName}\n`;
    message += `Medication: ${medicationData.medicationName}\n`;
    message += `Dosage: ${medicationData.dosage}\n`;
    message += `Time: ${medicationData.timeToTake}\n\n`;
    
    if (medicationData.instructions) {
      message += `Instructions: ${medicationData.instructions}\n\n`;
    }
    
    if (medicationData.refillReminder && medicationData.pillsRemaining !== undefined) {
      message += `⚠️  Refill needed: ${medicationData.pillsRemaining} pills remaining\n\n`;
    }
    
    message += `Reply TAKEN when medication is taken.`;

    await this.sendBatchSMS({
      recipients: phoneNumbers,
      message
    });
  }

  /**
   * Send test SMS to verify service is working
   */
  async sendTestSMS(phoneNumber: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('⚠️  SMS Service not configured for testing');
      return false;
    }

    try {
      const message = `🧪 KinConnect SMS Test\n\nThis is a test message to verify SMS notifications are working properly.\n\nTime: ${new Date().toLocaleString()}\n\nIf you received this, SMS notifications are configured correctly!`;
      
      const messageId = await this.sendSMS({
        to: phoneNumber,
        message
      });

      return !!messageId;
    } catch (error) {
      console.error('❌ SMS test failed:', error);
      return false;
    }
  }

  /**
   * Get SMS delivery status
   */
  async getMessageStatus(messageId: string): Promise<any> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      if (!this.client) {
        return null;
      }
      const message = await this.client.messages(messageId).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        direction: message.direction,
        from: message.from,
        to: message.to,
        price: message.price,
        priceUnit: message.priceUnit
      };
    } catch (error) {
      console.error('❌ Error fetching message status:', error);
      return null;
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber: string, countryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it's a US number without country code, add +1
    if (digits.length === 10 && countryCode === '+1') {
      return `+1${digits}`;
    }
    
    // If it already has country code
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // Return as-is if already formatted or unknown format
    return phoneNumber.startsWith('+') ? phoneNumber : `${countryCode}${digits}`;
  }
}

// Export singleton instance
export const smsNotificationService = new SMSNotificationService();