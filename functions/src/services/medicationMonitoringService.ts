import * as admin from 'firebase-admin';

export interface MonitoringMetrics {
  timestamp: Date;
  functionName: string;
  executionTime: number;
  eventsProcessed: number;
  eventsMarkedMissed: number;
  errorCount: number;
  errors: string[];
  performanceMetrics: {
    averageProcessingTimePerEvent: number;
    batchSize: number;
    totalBatches: number;
    queryTime: number;
    updateTime: number;
  };
}

export class MedicationMonitoringService {
  private firestore = admin.firestore();

  /**
   * Log monitoring metrics for missed medication detection
   */
  async logDetectionMetrics(metrics: MonitoringMetrics): Promise<void> {
    try {
      const metricsData = {
        ...metrics,
        timestamp: admin.firestore.Timestamp.fromDate(metrics.timestamp),
        createdAt: admin.firestore.Timestamp.now()
      };

      await this.firestore.collection('medication_detection_metrics').add(metricsData);
      
      // Also log to console for immediate monitoring
      console.log('📊 Detection Metrics:', {
        function: metrics.functionName,
        duration: `${metrics.executionTime}ms`,
        processed: metrics.eventsProcessed,
        missed: metrics.eventsMarkedMissed,
        errors: metrics.errorCount,
        avgPerEvent: `${metrics.performanceMetrics.averageProcessingTimePerEvent}ms`
      });
      
      // Log warnings for performance issues
      if (metrics.executionTime > 300000) { // 5 minutes
        console.warn('⚠️ Detection function taking longer than 5 minutes');
      }
      
      if (metrics.performanceMetrics.averageProcessingTimePerEvent > 1000) { // 1 second per event
        console.warn('⚠️ Slow processing detected - average >1s per event');
      }
      
      if (metrics.errorCount > metrics.eventsProcessed * 0.05) { // >5% error rate
        console.error('🚨 High error rate detected in missed medication detection');
      }
      
    } catch (error) {
      console.error('❌ Error logging detection metrics:', error);
    }
  }

  /**
   * Log grace period calculation performance
   */
  async logGracePeriodMetrics(
    patientId: string,
    calculationTime: number,
    cacheHit: boolean,
    appliedRules: string[]
  ): Promise<void> {
    try {
      const metricsData = {
        patientId,
        calculationTime,
        cacheHit,
        appliedRules,
        timestamp: admin.firestore.Timestamp.now()
      };

      // Only log to Firestore if calculation took longer than expected
      if (calculationTime > 500) { // 500ms threshold
        await this.firestore.collection('grace_period_metrics').add(metricsData);
        console.warn('⚠️ Slow grace period calculation:', {
          patientId,
          time: `${calculationTime}ms`,
          rules: appliedRules.length
        });
      }
      
    } catch (error) {
      console.error('❌ Error logging grace period metrics:', error);
    }
  }

  /**
   * Create system health alert
   */
  async createSystemAlert(
    alertType: 'performance' | 'error' | 'data_integrity',
    severity: 'info' | 'warning' | 'critical',
    message: string,
    details?: any
  ): Promise<void> {
    try {
      const alert = {
        alertType,
        severity,
        message,
        details: details || {},
        status: 'active',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      await this.firestore.collection('system_alerts').add(alert);
      
      // Log critical alerts immediately
      if (severity === 'critical') {
        console.error('🚨 CRITICAL SYSTEM ALERT:', message, details);
      } else if (severity === 'warning') {
        console.warn('⚠️ System Warning:', message);
      } else {
        console.log('ℹ️ System Info:', message);
      }
      
    } catch (error) {
      console.error('❌ Error creating system alert:', error);
    }
  }

  /**
   * Monitor missed medication detection health
   */
  async monitorDetectionHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // Check recent detection metrics
      const recentMetrics = await this.firestore.collection('medication_detection_metrics')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      
      if (recentMetrics.empty) {
        issues.push('No recent detection metrics found');
        recommendations.push('Verify that detectMissedMedications function is running');
      } else {
        const metrics = recentMetrics.docs.map(doc => doc.data());
        
        // Check for high error rates
        const avgErrorRate = metrics.reduce((sum, m) => 
          sum + (m.errorCount / Math.max(m.eventsProcessed, 1)), 0) / metrics.length;
        
        if (avgErrorRate > 0.05) { // >5% error rate
          issues.push(`High error rate: ${(avgErrorRate * 100).toFixed(1)}%`);
          recommendations.push('Investigate error patterns in detection function');
        }
        
        // Check for performance issues
        const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
        
        if (avgExecutionTime > 240000) { // >4 minutes
          issues.push(`Slow execution time: ${Math.round(avgExecutionTime / 1000)}s average`);
          recommendations.push('Consider optimizing batch size or query performance');
        }
        
        // Check for missed detection gaps
        const lastDetection = metrics[0].timestamp.toDate();
        const timeSinceLastDetection = Date.now() - lastDetection.getTime();
        
        if (timeSinceLastDetection > 20 * 60 * 1000) { // >20 minutes
          issues.push('Detection function may not be running regularly');
          recommendations.push('Check Cloud Scheduler and function deployment');
        }
      }
      
      // Check for stuck scheduled events
      const now = new Date();
      const stuckEventsQuery = await this.firestore.collection('medication_calendar_events')
        .where('status', '==', 'scheduled')
        .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(new Date(now.getTime() - (4 * 60 * 60 * 1000))))
        .limit(1)
        .get();
      
      if (!stuckEventsQuery.empty) {
        issues.push('Found events scheduled >4 hours ago still marked as "scheduled"');
        recommendations.push('Run manual missed detection or check grace period configuration');
      }
      
      const isHealthy = issues.length === 0;
      
      // Log health status
      if (isHealthy) {
        console.log('✅ Missed medication detection system is healthy');
      } else {
        console.warn('⚠️ Missed medication detection system has issues:', issues);
        console.log('💡 Recommendations:', recommendations);
      }
      
      return { isHealthy, issues, recommendations };
      
    } catch (error) {
      console.error('❌ Error monitoring detection health:', error);
      return {
        isHealthy: false,
        issues: ['Error checking system health'],
        recommendations: ['Check monitoring service configuration']
      };
    }
  }

  /**
   * Get system performance statistics
   */
  async getPerformanceStats(days: number = 7): Promise<{
    totalDetectionRuns: number;
    totalEventsProcessed: number;
    totalEventsMissed: number;
    averageExecutionTime: number;
    errorRate: number;
    peakProcessingTime: number;
    systemUptime: number;
  }> {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      const metricsQuery = await this.firestore.collection('medication_detection_metrics')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .get();
      
      if (metricsQuery.empty) {
        return {
          totalDetectionRuns: 0,
          totalEventsProcessed: 0,
          totalEventsMissed: 0,
          averageExecutionTime: 0,
          errorRate: 0,
          peakProcessingTime: 0,
          systemUptime: 0
        };
      }
      
      const metrics = metricsQuery.docs.map(doc => doc.data());
      
      const totalDetectionRuns = metrics.length;
      const totalEventsProcessed = metrics.reduce((sum, m) => sum + m.eventsProcessed, 0);
      const totalEventsMissed = metrics.reduce((sum, m) => sum + m.eventsMarkedMissed, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
      const averageExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      const peakProcessingTime = Math.max(...metrics.map(m => m.executionTime));
      const errorRate = totalEventsProcessed > 0 ? totalErrors / totalEventsProcessed : 0;
      
      // Calculate uptime based on expected runs (every 15 minutes)
      const expectedRuns = Math.floor((days * 24 * 60) / 15); // Every 15 minutes
      const systemUptime = totalDetectionRuns / expectedRuns;
      
      return {
        totalDetectionRuns,
        totalEventsProcessed,
        totalEventsMissed,
        averageExecutionTime: Math.round(averageExecutionTime),
        errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimal places
        peakProcessingTime: Math.round(peakProcessingTime),
        systemUptime: Math.round(systemUptime * 10000) / 100 // Percentage with 2 decimal places
      };
      
    } catch (error) {
      console.error('❌ Error getting performance stats:', error);
      throw error;
    }
  }
}