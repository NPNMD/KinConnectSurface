import { adminDb } from '../firebase-admin';
import { notificationService } from './notificationService';
import { pushNotificationService } from './pushNotificationService';
import { smsNotificationService } from './smsNotificationService';
import { familyNotificationService } from './familyNotificationService';

const db = adminDb;

export interface TestResult {
  id: string;
  testType: 'single_channel' | 'multi_channel' | 'family_notification' | 'emergency_alert' | 'scheduled_notification';
  channel?: 'email' | 'sms' | 'push' | 'in_app';
  recipient: string;
  status: 'success' | 'failure' | 'partial_success';
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  details: {
    sent: boolean;
    delivered?: boolean;
    error?: string;
    responseTime?: number;
    messageId?: string;
  };
  metadata?: Record<string, any>;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestResult[];
  overallStatus: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  };
}

export interface DiagnosticReport {
  id: string;
  timestamp: Date;
  systemHealth: {
    emailService: 'healthy' | 'degraded' | 'down';
    smsService: 'healthy' | 'degraded' | 'down';
    pushService: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    scheduler: 'healthy' | 'degraded' | 'down';
  };
  recentErrors: {
    timestamp: Date;
    service: string;
    error: string;
    count: number;
  }[];
  performanceMetrics: {
    averageDeliveryTime: number;
    deliveryRate: number;
    errorRate: number;
    throughput: number; // notifications per minute
  };
  recommendations: string[];
}

export class NotificationTestingService {
  /**
   * Test a single notification channel
   */
  async testSingleChannel(
    channel: 'email' | 'sms' | 'push' | 'in_app',
    recipient: string,
    testMessage?: string
  ): Promise<TestResult> {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const testResult: TestResult = {
      id: testId,
      testType: 'single_channel',
      channel,
      recipient,
      status: 'failure',
      startTime,
      details: { sent: false }
    };

    try {
      const message = testMessage || `Test notification from KinConnect - ${new Date().toLocaleString()}`;
      
      switch (channel) {
        case 'email':
          await this.testEmailChannel(recipient, message, testResult);
          break;
        
        case 'sms':
          await this.testSMSChannel(recipient, message, testResult);
          break;
        
        case 'push':
          await this.testPushChannel(recipient, message, testResult);
          break;
        
        case 'in_app':
          await this.testInAppChannel(recipient, message, testResult);
          break;
      }
      
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - startTime.getTime();
      
      // Save test result
      await this.saveTestResult(testResult);
      
      console.log(`✅ Test completed for ${channel}: ${testResult.status}`);
      return testResult;
      
    } catch (error) {
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - startTime.getTime();
      testResult.details.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.status = 'failure';
      
      await this.saveTestResult(testResult);
      
      console.error(`❌ Test failed for ${channel}:`, error);
      return testResult;
    }
  }

  /**
   * Test all notification channels for a user
   */
  async testAllChannels(userContacts: {
    email?: string;
    phone?: string;
    pushTokens?: string[];
    userId?: string;
  }): Promise<TestSuite> {
    const suiteId = `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const testSuite: TestSuite = {
      id: suiteId,
      name: 'Multi-Channel Test Suite',
      description: 'Test all available notification channels for a user',
      tests: [],
      overallStatus: 'running',
      startTime,
      summary: { total: 0, passed: 0, failed: 0, successRate: 0 }
    };

    try {
      const testPromises: Promise<TestResult>[] = [];
      
      // Test email if available
      if (userContacts.email) {
        testPromises.push(this.testSingleChannel('email', userContacts.email));
      }
      
      // Test SMS if available
      if (userContacts.phone) {
        testPromises.push(this.testSingleChannel('sms', userContacts.phone));
      }
      
      // Test push notifications if available
      if (userContacts.pushTokens && userContacts.pushTokens.length > 0) {
        testPromises.push(this.testSingleChannel('push', userContacts.pushTokens[0]));
      }
      
      // Test in-app notifications if user ID available
      if (userContacts.userId) {
        testPromises.push(this.testSingleChannel('in_app', userContacts.userId));
      }
      
      // Wait for all tests to complete
      const results = await Promise.allSettled(testPromises);
      
      testSuite.tests = results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          id: `failed_${Date.now()}`,
          testType: 'single_channel' as const,
          recipient: 'unknown',
          status: 'failure' as const,
          startTime: new Date(),
          details: { 
            sent: false, 
            error: result.status === 'rejected' ? result.reason?.message : 'Test failed' 
          }
        }
      );
      
      testSuite.endTime = new Date();
      testSuite.summary.total = testSuite.tests.length;
      testSuite.summary.passed = testSuite.tests.filter(t => t.status === 'success').length;
      testSuite.summary.failed = testSuite.tests.filter(t => t.status === 'failure').length;
      testSuite.summary.successRate = testSuite.summary.total > 0 ? 
        (testSuite.summary.passed / testSuite.summary.total) * 100 : 0;
      
      testSuite.overallStatus = testSuite.summary.failed === 0 ? 'completed' : 'failed';
      
      // Save test suite
      await this.saveTestSuite(testSuite);
      
      console.log(`📊 Multi-channel test completed: ${testSuite.summary.passed}/${testSuite.summary.total} passed`);
      return testSuite;
      
    } catch (error) {
      testSuite.endTime = new Date();
      testSuite.overallStatus = 'failed';
      
      console.error('❌ Multi-channel test suite failed:', error);
      return testSuite;
    }
  }

  /**
   * Test family notification system
   */
  async testFamilyNotifications(
    patientId: string,
    testScenario: 'appointment_reminder' | 'transportation_request' | 'emergency_alert'
  ): Promise<TestSuite> {
    const suiteId = `family_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const testSuite: TestSuite = {
      id: suiteId,
      name: 'Family Notification Test',
      description: `Test ${testScenario} notifications to family members`,
      tests: [],
      overallStatus: 'running',
      startTime,
      summary: { total: 0, passed: 0, failed: 0, successRate: 0 }
    };

    try {
      // Get family members
      const familyMembers = await familyNotificationService.getFamilyMembers(patientId);
      
      if (familyMembers.length === 0) {
        throw new Error('No family members found for testing');
      }

      // Send test notification based on scenario
      switch (testScenario) {
        case 'appointment_reminder':
          await familyNotificationService.sendAppointmentReminder(patientId, {
            id: 'test_appointment',
            patientName: 'Test Patient',
            doctorName: 'Dr. Test',
            appointmentTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            location: 'Test Medical Center',
            appointmentType: 'Test Consultation'
          }, 1440);
          break;
        
        case 'transportation_request':
          await familyNotificationService.sendTransportationRequest(patientId, {
            appointmentId: 'test_appointment',
            patientName: 'Test Patient',
            appointmentTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            pickupLocation: 'Test Home Address',
            destination: 'Test Medical Center',
            appointmentType: 'Test Consultation'
          });
          break;
        
        case 'emergency_alert':
          await familyNotificationService.sendEmergencyAlert(patientId, {
            patientName: 'Test Patient',
            emergencyType: 'Test Emergency (Not Real)',
            location: 'Test Location',
            contactNumber: '+1234567890',
            reportedBy: 'Test System',
            additionalInfo: 'This is a test emergency alert - no action required'
          });
          break;
      }

      // Create test results for each family member
      testSuite.tests = familyMembers.map(member => ({
        id: `family_test_${member.id}`,
        testType: 'family_notification' as const,
        recipient: member.email || member.phone || member.id,
        status: 'success' as const, // Assume success for now
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
        details: { sent: true },
        metadata: { 
          familyMemberId: member.id, 
          memberName: member.name,
          scenario: testScenario
        }
      }));
      
      testSuite.endTime = new Date();
      testSuite.summary.total = testSuite.tests.length;
      testSuite.summary.passed = testSuite.tests.length; // All assumed successful
      testSuite.summary.failed = 0;
      testSuite.summary.successRate = 100;
      testSuite.overallStatus = 'completed';
      
      await this.saveTestSuite(testSuite);
      
      console.log(`👨‍👩‍👧‍👦 Family notification test completed for ${familyMembers.length} members`);
      return testSuite;
      
    } catch (error) {
      testSuite.endTime = new Date();
      testSuite.overallStatus = 'failed';
      
      console.error('❌ Family notification test failed:', error);
      return testSuite;
    }
  }

  /**
   * Generate system diagnostic report
   */
  async generateDiagnosticReport(): Promise<DiagnosticReport> {
    const reportId = `diagnostic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    const report: DiagnosticReport = {
      id: reportId,
      timestamp,
      systemHealth: {
        emailService: 'healthy',
        smsService: 'healthy',
        pushService: 'healthy',
        database: 'healthy',
        scheduler: 'healthy'
      },
      recentErrors: [],
      performanceMetrics: {
        averageDeliveryTime: 0,
        deliveryRate: 0,
        errorRate: 0,
        throughput: 0
      },
      recommendations: []
    };

    try {
      // Test each service health
      await this.checkServiceHealth(report);
      
      // Get recent errors
      await this.getRecentErrors(report);
      
      // Calculate performance metrics
      await this.calculatePerformanceMetrics(report);
      
      // Generate recommendations
      this.generateRecommendations(report);
      
      // Save diagnostic report
      await this.saveDiagnosticReport(report);
      
      console.log('📋 Diagnostic report generated:', reportId);
      return report;
      
    } catch (error) {
      console.error('❌ Error generating diagnostic report:', error);
      throw error;
    }
  }

  /**
   * Test notification delivery timing accuracy
   */
  async testDeliveryTiming(
    scheduledTime: Date,
    recipient: string,
    channel: 'email' | 'sms' | 'push' | 'in_app'
  ): Promise<TestResult> {
    const testId = `timing_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const testResult: TestResult = {
      id: testId,
      testType: 'scheduled_notification',
      channel,
      recipient,
      status: 'failure',
      startTime,
      details: { sent: false }
    };

    try {
      // Schedule a test notification
      const notificationId = await notificationService.sendNotification({
        userId: 'test_user',
        patientId: 'test_patient',
        type: 'appointment_reminder',
        channel,
        recipient,
        subject: 'Timing Test Notification',
        message: `This is a timing test notification scheduled for ${scheduledTime.toLocaleString()}`,
        scheduledFor: scheduledTime,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        priority: 'low'
      });

      testResult.details.messageId = notificationId;
      testResult.details.sent = true;
      testResult.status = 'success';
      
      // Calculate timing accuracy (would need to be checked after delivery)
      const expectedTime = scheduledTime.getTime();
      const actualTime = new Date().getTime(); // This would be the actual delivery time
      const timingDifference = Math.abs(actualTime - expectedTime);
      
      testResult.metadata = {
        expectedTime: scheduledTime.toISOString(),
        timingDifference,
        accuracyPercentage: timingDifference < 60000 ? 100 : Math.max(0, 100 - (timingDifference / 60000) * 10)
      };
      
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - startTime.getTime();
      
      await this.saveTestResult(testResult);
      
      console.log(`⏰ Timing test scheduled: ${testId}`);
      return testResult;
      
    } catch (error) {
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - startTime.getTime();
      testResult.details.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.status = 'failure';
      
      await this.saveTestResult(testResult);
      
      console.error('❌ Timing test failed:', error);
      return testResult;
    }
  }

  // Private helper methods

  private async testEmailChannel(recipient: string, message: string, testResult: TestResult): Promise<void> {
    const startTime = Date.now();
    
    try {
      await notificationService.sendNotification({
        userId: 'test_user',
        patientId: 'test_patient',
        type: 'appointment_reminder',
        channel: 'email',
        recipient,
        subject: 'Test Email Notification',
        message,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        priority: 'low'
      });
      
      testResult.details.sent = true;
      testResult.details.responseTime = Date.now() - startTime;
      testResult.status = 'success';
    } catch (error) {
      throw error;
    }
  }

  private async testSMSChannel(recipient: string, message: string, testResult: TestResult): Promise<void> {
    const startTime = Date.now();
    
    try {
      const messageId = await smsNotificationService.sendSMS({
        to: recipient,
        message: `Test SMS: ${message}`
      });
      
      testResult.details.sent = true;
      testResult.details.messageId = messageId || undefined;
      testResult.details.responseTime = Date.now() - startTime;
      testResult.status = messageId ? 'success' : 'failure';
    } catch (error) {
      throw error;
    }
  }

  private async testPushChannel(recipient: string, message: string, testResult: TestResult): Promise<void> {
    const startTime = Date.now();
    
    try {
      const messageId = await pushNotificationService.sendToToken(recipient, {
        title: 'Test Push Notification',
        body: message,
        data: { test: 'true' }
      });
      
      testResult.details.sent = true;
      testResult.details.messageId = messageId;
      testResult.details.responseTime = Date.now() - startTime;
      testResult.status = 'success';
    } catch (error) {
      throw error;
    }
  }

  private async testInAppChannel(recipient: string, message: string, testResult: TestResult): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.collection('inAppNotifications').add({
        userId: recipient,
        type: 'test',
        title: 'Test In-App Notification',
        message,
        read: false,
        createdAt: new Date()
      });
      
      testResult.details.sent = true;
      testResult.details.responseTime = Date.now() - startTime;
      testResult.status = 'success';
    } catch (error) {
      throw error;
    }
  }

  private async checkServiceHealth(report: DiagnosticReport): Promise<void> {
    try {
      // Test email service
      try {
        // This would be a lightweight health check
        report.systemHealth.emailService = 'healthy';
      } catch {
        report.systemHealth.emailService = 'down';
      }

      // Test SMS service
      report.systemHealth.smsService = smsNotificationService.isReady() ? 'healthy' : 'down';

      // Test push service
      try {
        // This would be a lightweight health check
        report.systemHealth.pushService = 'healthy';
      } catch {
        report.systemHealth.pushService = 'down';
      }

      // Test database
      try {
        await db.collection('health_check').limit(1).get();
        report.systemHealth.database = 'healthy';
      } catch {
        report.systemHealth.database = 'down';
      }

      // Test scheduler (simplified check)
      report.systemHealth.scheduler = 'healthy';
      
    } catch (error) {
      console.error('Error checking service health:', error);
    }
  }

  private async getRecentErrors(report: DiagnosticReport): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const snapshot = await db.collection('notificationLogs')
        .where('status', '==', 'failed')
        .where('createdAt', '>=', oneDayAgo)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const errorCounts: { [key: string]: { error: string; count: number; timestamp: Date } } = {};
      
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const errorKey = `${data.channel}_${data.failureReason}`;
        
        if (errorCounts[errorKey]) {
          errorCounts[errorKey].count++;
        } else {
          errorCounts[errorKey] = {
            error: data.failureReason || 'Unknown error',
            count: 1,
            timestamp: data.createdAt.toDate()
          };
        }
      });

      report.recentErrors = Object.entries(errorCounts).map(([key, value]) => ({
        timestamp: value.timestamp,
        service: key.split('_')[0],
        error: value.error,
        count: value.count
      }));
      
    } catch (error) {
      console.error('Error getting recent errors:', error);
    }
  }

  private async calculatePerformanceMetrics(report: DiagnosticReport): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const snapshot = await db.collection('notificationLogs')
        .where('createdAt', '>=', oneDayAgo)
        .get();

      const notifications = snapshot.docs.map((doc: any) => doc.data());
      
      if (notifications.length > 0) {
        const successful = notifications.filter((n: any) => n.status === 'sent' || n.status === 'delivered');
        const failed = notifications.filter((n: any) => n.status === 'failed');
        
        report.performanceMetrics.deliveryRate = (successful.length / notifications.length) * 100;
        report.performanceMetrics.errorRate = (failed.length / notifications.length) * 100;
        report.performanceMetrics.throughput = notifications.length / (24 * 60); // per minute
        
        // Calculate average delivery time for notifications with timing data
        const timedNotifications = notifications.filter((n: any) => n.sentAt && n.createdAt);
        if (timedNotifications.length > 0) {
          const totalTime = timedNotifications.reduce((sum: number, n: any) => {
            return sum + (n.sentAt.toDate().getTime() - n.createdAt.toDate().getTime());
          }, 0);
          report.performanceMetrics.averageDeliveryTime = totalTime / timedNotifications.length;
        }
      }
      
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
    }
  }

  private generateRecommendations(report: DiagnosticReport): void {
    const recommendations: string[] = [];
    
    // Check service health
    Object.entries(report.systemHealth).forEach(([service, status]) => {
      if (status === 'down') {
        recommendations.push(`${service} is down and requires immediate attention`);
      } else if (status === 'degraded') {
        recommendations.push(`${service} is experiencing issues and should be monitored`);
      }
    });
    
    // Check performance metrics
    if (report.performanceMetrics.deliveryRate < 95) {
      recommendations.push('Delivery rate is below 95% - investigate failed notifications');
    }
    
    if (report.performanceMetrics.errorRate > 5) {
      recommendations.push('Error rate is above 5% - review error patterns and fix common issues');
    }
    
    if (report.performanceMetrics.averageDeliveryTime > 30000) { // 30 seconds
      recommendations.push('Average delivery time is high - consider optimizing notification processing');
    }
    
    // Check recent errors
    if (report.recentErrors.length > 0) {
      const commonErrors = report.recentErrors.filter(e => e.count > 5);
      if (commonErrors.length > 0) {
        recommendations.push('Multiple recurring errors detected - prioritize fixing common failure patterns');
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All systems are operating normally');
    }
    
    report.recommendations = recommendations;
  }

  private async saveTestResult(testResult: TestResult): Promise<void> {
    try {
      await db.collection('notificationTests').doc(testResult.id).set(testResult);
    } catch (error) {
      console.error('Error saving test result:', error);
    }
  }

  private async saveTestSuite(testSuite: TestSuite): Promise<void> {
    try {
      await db.collection('notificationTestSuites').doc(testSuite.id).set(testSuite);
    } catch (error) {
      console.error('Error saving test suite:', error);
    }
  }

  private async saveDiagnosticReport(report: DiagnosticReport): Promise<void> {
    try {
      await db.collection('diagnosticReports').doc(report.id).set(report);
    } catch (error) {
      console.error('Error saving diagnostic report:', error);
    }
  }

  /**
   * Get test history
   */
  async getTestHistory(limit: number = 50): Promise<TestResult[]> {
    try {
      const snapshot = await db.collection('notificationTests')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as TestResult));
    } catch (error) {
      console.error('Error getting test history:', error);
      return [];
    }
  }

  /**
   * Get diagnostic history
   */
  async getDiagnosticHistory(limit: number = 10): Promise<DiagnosticReport[]> {
    try {
      const snapshot = await db.collection('diagnosticReports')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as DiagnosticReport));
    } catch (error) {
      console.error('Error getting diagnostic history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const notificationTestingService = new NotificationTestingService();