import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity, 
  Zap,
  RefreshCw,
  Play,
  Download,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Users,
  TestTube,
  BarChart3,
  AlertCircle,
  Info,
  Wrench
} from 'lucide-react';

interface TestResult {
  id: string;
  testType: 'single_channel' | 'multi_channel' | 'family_notification' | 'emergency_alert' | 'scheduled_notification';
  channel?: 'email' | 'sms' | 'push' | 'in_app';
  recipient: string;
  status: 'success' | 'failure' | 'partial_success';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  details: {
    sent: boolean;
    delivered?: boolean;
    error?: string;
    responseTime?: number;
    messageId?: string;
  };
  metadata?: Record<string, any>;
}

interface TestSuite {
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

interface DiagnosticReport {
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
    throughput: number;
  };
  recommendations: string[];
}

const NotificationTroubleshooting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'testing' | 'diagnostics' | 'history'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());

  // Mock data for demonstration
  const mockDiagnosticReport: DiagnosticReport = {
    id: 'diagnostic_1',
    timestamp: new Date(),
    systemHealth: {
      emailService: 'healthy',
      smsService: 'degraded',
      pushService: 'healthy',
      database: 'healthy',
      scheduler: 'healthy'
    },
    recentErrors: [
      {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        service: 'sms',
        error: 'Invalid phone number format',
        count: 5
      },
      {
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        service: 'push',
        error: 'Device token expired',
        count: 3
      }
    ],
    performanceMetrics: {
      averageDeliveryTime: 2500,
      deliveryRate: 94.2,
      errorRate: 5.8,
      throughput: 45.2
    },
    recommendations: [
      'SMS service is experiencing issues - check Twilio configuration',
      'Consider implementing device token refresh mechanism',
      'Monitor delivery rate closely - target is 95%+'
    ]
  };

  const mockTestResults: TestResult[] = [
    {
      id: 'test_1',
      testType: 'single_channel',
      channel: 'email',
      recipient: 'test@example.com',
      status: 'success',
      startTime: new Date(Date.now() - 10 * 60 * 1000),
      endTime: new Date(Date.now() - 9 * 60 * 1000),
      duration: 1200,
      details: {
        sent: true,
        delivered: true,
        responseTime: 1200
      }
    },
    {
      id: 'test_2',
      testType: 'single_channel',
      channel: 'sms',
      recipient: '+1234567890',
      status: 'failure',
      startTime: new Date(Date.now() - 5 * 60 * 1000),
      endTime: new Date(Date.now() - 4 * 60 * 1000),
      duration: 5000,
      details: {
        sent: false,
        error: 'Invalid phone number format'
      }
    }
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // In a real app, these would be API calls
      // const diagnosticResponse = await fetch('/api/notifications/diagnostics');
      // const testResponse = await fetch('/api/notifications/test-history');
      
      // For now, use mock data
      setDiagnosticReport(mockDiagnosticReport);
      setTestResults(mockTestResults);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      // In a real app: await fetch('/api/notifications/run-diagnostics', { method: 'POST' });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      await loadDashboardData();
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  const runChannelTest = async (channel: 'email' | 'sms' | 'push' | 'in_app', recipient: string) => {
    const testId = `test_${channel}_${Date.now()}`;
    setRunningTests(prev => new Set([...prev, testId]));
    
    try {
      // In a real app: await fetch('/api/notifications/test-channel', { method: 'POST', body: JSON.stringify({ channel, recipient }) });
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate test
      
      // Add mock result
      const newResult: TestResult = {
        id: testId,
        testType: 'single_channel',
        channel,
        recipient,
        status: Math.random() > 0.3 ? 'success' : 'failure',
        startTime: new Date(),
        endTime: new Date(),
        duration: Math.random() * 5000 + 1000,
        details: {
          sent: Math.random() > 0.3,
          responseTime: Math.random() * 3000 + 500
        }
      };
      
      setTestResults(prev => [newResult, ...prev]);
    } catch (error) {
      console.error('Error running channel test:', error);
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
    }
  };

  const runFamilyTest = async (patientId: string, scenario: string) => {
    const testId = `family_test_${Date.now()}`;
    setRunningTests(prev => new Set([...prev, testId]));
    
    try {
      // In a real app: await fetch('/api/notifications/test-family', { method: 'POST', body: JSON.stringify({ patientId, scenario }) });
      await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate test
      
      // Add mock test suite
      const newSuite: TestSuite = {
        id: testId,
        name: `Family Test - ${scenario}`,
        description: `Test ${scenario} notifications to family members`,
        tests: [],
        overallStatus: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        summary: {
          total: 3,
          passed: 2,
          failed: 1,
          successRate: 66.7
        }
      };
      
      setTestSuites(prev => [newSuite, ...prev]);
    } catch (error) {
      console.error('Error running family test:', error);
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'down':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
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

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">System Health</h3>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </button>
        </div>

        {diagnosticReport && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.entries(diagnosticReport.systemHealth).map(([service, status]) => (
              <div key={service} className={`border rounded-lg p-4 ${getHealthColor(status)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {service.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-xs opacity-75 capitalize">{status}</p>
                  </div>
                  {getHealthIcon(status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      {diagnosticReport && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {diagnosticReport.performanceMetrics.deliveryRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Delivery Rate</div>
              <div className="flex items-center justify-center mt-1">
                {diagnosticReport.performanceMetrics.deliveryRate >= 95 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(diagnosticReport.performanceMetrics.averageDeliveryTime / 1000).toFixed(1)}s
              </div>
              <div className="text-sm text-gray-500">Avg Delivery Time</div>
              <div className="flex items-center justify-center mt-1">
                {diagnosticReport.performanceMetrics.averageDeliveryTime < 5000 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {diagnosticReport.performanceMetrics.errorRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Error Rate</div>
              <div className="flex items-center justify-center mt-1">
                {diagnosticReport.performanceMetrics.errorRate < 5 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {diagnosticReport.performanceMetrics.throughput.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Notifications/min</div>
              <div className="flex items-center justify-center mt-1">
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {diagnosticReport && diagnosticReport.recentErrors.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Errors</h3>
          <div className="space-y-3">
            {diagnosticReport.recentErrors.map((error, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-900">{error.service.toUpperCase()}</p>
                    <p className="text-sm text-red-700">{error.error}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-900">{error.count} occurrences</p>
                  <p className="text-xs text-red-600">{error.timestamp.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {diagnosticReport && diagnosticReport.recommendations.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            {diagnosticReport.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <p className="text-sm text-blue-900">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTesting = () => (
    <div className="space-y-6">
      {/* Channel Testing */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Channel Testing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { channel: 'email', label: 'Email', placeholder: 'test@example.com' },
            { channel: 'sms', label: 'SMS', placeholder: '+1234567890' },
            { channel: 'push', label: 'Push', placeholder: 'device-token' },
            { channel: 'in_app', label: 'In-App', placeholder: 'user-id' }
          ].map(({ channel, label, placeholder }) => (
            <div key={channel} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                {getChannelIcon(channel)}
                <h4 className="font-medium text-gray-900">{label}</h4>
              </div>
              <input
                type="text"
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                id={`test-${channel}`}
              />
              <button
                onClick={() => {
                  const input = document.getElementById(`test-${channel}`) as HTMLInputElement;
                  if (input?.value) {
                    runChannelTest(channel as any, input.value);
                  }
                }}
                disabled={runningTests.has(`test_${channel}_${Date.now()}`)}
                className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Family Testing */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Family Notification Testing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { scenario: 'appointment_reminder', label: 'Appointment Reminder', description: 'Test appointment reminder notifications' },
            { scenario: 'transportation_request', label: 'Transportation Request', description: 'Test transportation coordination' },
            { scenario: 'emergency_alert', label: 'Emergency Alert', description: 'Test emergency notification system' }
          ].map(({ scenario, label, description }) => (
            <div key={scenario} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{label}</h4>
              <p className="text-sm text-gray-600 mb-3">{description}</p>
              <input
                type="text"
                placeholder="Patient ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                id={`family-test-${scenario}`}
              />
              <button
                onClick={() => {
                  const input = document.getElementById(`family-test-${scenario}`) as HTMLInputElement;
                  if (input?.value) {
                    runFamilyTest(input.value, scenario);
                  }
                }}
                disabled={runningTests.has(`family_test_${Date.now()}`)}
                className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Users className="h-4 w-4 mr-2" />
                Test Family
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Test Results */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Test Results</h3>
        {testResults.length === 0 ? (
          <div className="text-center py-8">
            <TestTube className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tests run yet</h3>
            <p className="mt-1 text-sm text-gray-500">Run some tests to see results here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {testResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getChannelIcon(result.channel || 'in_app')}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {result.channel?.toUpperCase()} Test - {result.recipient}
                    </p>
                    <p className="text-xs text-gray-500">
                      {result.startTime.toLocaleString()}
                      {result.duration && ` • ${result.duration}ms`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {result.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    result.status === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderDiagnostics = () => (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Diagnostics</h3>
        <p className="text-gray-600 mb-4">
          Comprehensive system health check and performance analysis.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Available Diagnostics</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm">Service Health Check</span>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Run</button>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm">Performance Analysis</span>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Run</button>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm">Error Pattern Analysis</span>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Run</button>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm">Configuration Validation</span>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Run</button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Export Diagnostic Report
              </button>
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Settings className="h-4 w-4 mr-2" />
                System Configuration
              </button>
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Wrench className="h-4 w-4 mr-2" />
                Repair Tools
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test History</h3>
        <div className="space-y-4">
          {testSuites.map((suite) => (
            <div key={suite.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{suite.name}</h4>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  suite.overallStatus === 'completed' ? 'bg-green-100 text-green-800' :
                  suite.overallStatus === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {suite.overallStatus}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{suite.description}</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-1 font-medium">{suite.summary.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Passed:</span>
                  <span className="ml-1 font-medium text-green-600">{suite.summary.passed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Failed:</span>
                  <span className="ml-1 font-medium text-red-600">{suite.summary.failed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Success Rate:</span>
                  <span className="ml-1 font-medium">{suite.summary.successRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading && !diagnosticReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Troubleshooting</h1>
        <p className="text-gray-600">
          Monitor system health, run tests, and diagnose notification delivery issues.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: Activity },
            { id: 'testing', name: 'Testing', icon: TestTube },
            { id: 'diagnostics', name: 'Diagnostics', icon: Wrench },
            { id: 'history', name: 'History', icon: Clock }
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
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'testing' && renderTesting()}
        {activeTab === 'diagnostics' && renderDiagnostics()}
        {activeTab === 'history' && renderHistory()}
      </div>
    </div>
  );
};

export default NotificationTroubleshooting;