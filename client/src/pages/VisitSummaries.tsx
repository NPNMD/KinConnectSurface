import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Users,
  Building,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Filter,
  Plus,
  Mic,
  ChevronDown,
  ChevronUp,
  Heart,
  Pill
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import VisitSummaryCard from '@/components/VisitSummaryCard';
import VisitSummaryForm from '@/components/VisitSummaryForm';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import type { VisitSummary, VisitType, AIProcessingStatus } from '@shared/types';

export default function VisitSummaries() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [visitSummaries, setVisitSummaries] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VisitType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AIProcessingStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showVisitRecording, setShowVisitRecording] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (firebaseUser?.uid) {
      fetchVisitSummaries(true); // Reset pagination
    }
  }, [firebaseUser?.uid, searchTerm, filterType, filterStatus]);

  const fetchVisitSummaries = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
      } else {
        setLoadingMore(true);
      }

      const userId = firebaseUser?.uid;
      if (!userId) return;

      const currentPage = reset ? 0 : page;
      const offset = currentPage * ITEMS_PER_PAGE;

      console.log('🔍 Fetching visit summaries:', { 
        userId, 
        offset, 
        limit: ITEMS_PER_PAGE,
        searchTerm,
        filterType,
        filterStatus
      });

      // Build query parameters
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: offset.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      if (filterType !== 'all') {
        params.append('visitType', filterType);
      }

      if (filterStatus !== 'all') {
        params.append('processingStatus', filterStatus);
      }

      const response = await apiClient.get<{ 
        success: boolean; 
        data: VisitSummary[];
        total: number;
        hasMore: boolean;
      }>(`${API_ENDPOINTS.VISIT_SUMMARIES(userId)}?${params.toString()}`);
      
      if (response.success && response.data) {
        // Convert date strings to Date objects
        const summariesWithDates = response.data.map(summary => ({
          ...summary,
          visitDate: new Date(summary.visitDate),
          createdAt: new Date(summary.createdAt),
          updatedAt: new Date(summary.updatedAt),
          lastProcessingAttempt: summary.lastProcessingAttempt 
            ? new Date(summary.lastProcessingAttempt) 
            : undefined,
          aiProcessedSummary: summary.aiProcessedSummary ? {
            ...summary.aiProcessedSummary,
            followUpDate: summary.aiProcessedSummary.followUpDate 
              ? new Date(summary.aiProcessedSummary.followUpDate)
              : undefined
          } : undefined
        }));

        if (reset) {
          setVisitSummaries(summariesWithDates);
        } else {
          setVisitSummaries(prev => [...prev, ...summariesWithDates]);
        }

        setHasMore(response.hasMore || false);
        setPage(currentPage + 1);
        
        console.log('✅ Visit summaries loaded:', {
          count: summariesWithDates.length,
          total: response.total,
          hasMore: response.hasMore
        });
      }
    } catch (error) {
      console.error('❌ Error fetching visit summaries:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchVisitSummaries(false);
    }
  };

  const handleEdit = (summary: VisitSummary) => {
    // TODO: Implement edit functionality
    console.log('Edit summary:', summary.id);
  };

  const handleDelete = async (summaryId: string) => {
    if (!confirm('Are you sure you want to delete this visit summary? This action cannot be undone.')) {
      return;
    }

    try {
      const userId = firebaseUser?.uid;
      if (!userId) return;

      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.VISIT_SUMMARY_DELETE(userId, summaryId)
      );

      if (response.success) {
        // Remove from local state
        setVisitSummaries(prev => prev.filter(s => s.id !== summaryId));
        showSuccess('Visit summary deleted');
      } else {
        showError('Failed to delete visit summary');
      }
    } catch (error) {
      console.error('Error deleting visit summary:', error);
      showError('Failed to delete visit summary');
    }
  };

  const handleRetryAI = async (summaryId: string) => {
    try {
      const userId = firebaseUser?.uid;
      if (!userId) return;

      const response = await apiClient.post<{ success: boolean }>(
        API_ENDPOINTS.VISIT_SUMMARY_RETRY_AI(userId, summaryId)
      );

      if (response.success) {
        // Refresh the summaries to show updated processing status
        await fetchVisitSummaries(true);
        showInfo('AI processing started - this may take a few minutes');
      } else {
        showError('Failed to retry AI processing');
      }
    } catch (error) {
      console.error('Error retrying AI processing:', error);
      showError('Failed to retry AI processing');
    }
  };

  const handleVisitSummarySubmit = async (summary: any) => {
    console.log('✅ Visit summary submitted:', summary);
    setShowVisitRecording(false);
    // Refresh visit summaries to show the new one
    await fetchVisitSummaries(true);
  };

  const handleVisitSummaryCancel = () => {
    setShowVisitRecording(false);
  };

  const filteredSummaries = visitSummaries.filter(summary => {
    const matchesSearch = !searchTerm.trim() || 
      summary.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.facilityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.doctorSummary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.aiProcessedSummary?.keyPoints?.some(point => 
        point.toLowerCase().includes(searchTerm.toLowerCase())
      );

    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <h1 className="text-lg font-semibold text-gray-900">Visit Summaries</h1>
              </div>
            </div>
            
            <button
              onClick={() => setShowVisitRecording(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Visit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-3 mb-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search visits by provider, facility, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as VisitType | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="scheduled">Scheduled</option>
                <option value="walk_in">Walk-in</option>
                <option value="emergency">Emergency</option>
                <option value="follow_up">Follow-up</option>
                <option value="consultation">Consultation</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Processing Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AIProcessingStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="px-4 py-6 pb-20">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
              <span className="ml-3 text-gray-600">Loading visit summaries...</span>
            </div>
          ) : filteredSummaries.length > 0 ? (
            <div className="space-y-4">
              {filteredSummaries.map((summary) => (
                <div key={summary.id} className="relative">
                  <Link
                    to={`/visit-summary/${summary.id}`}
                    className="block hover:shadow-md transition-shadow"
                  >
                    <VisitSummaryCard
                      summary={summary}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRetryAI={handleRetryAI}
                      showFamilyView={false}
                      isFamily={false}
                    />
                  </Link>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center py-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load More</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Visit Summaries Found</h2>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'No visit summaries match your current filters.'
                  : 'You haven\'t recorded any visit summaries yet.'}
              </p>
              <button
                onClick={() => setShowVisitRecording(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Mic className="w-4 h-4" />
                <span>Record Your First Visit</span>
              </button>
            </div>
          )}
        </div>

        {/* Visit Recording Modal */}
        {showVisitRecording && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <VisitSummaryForm
                patientId={firebaseUser?.uid || ''}
                onSubmit={handleVisitSummarySubmit}
                onCancel={handleVisitSummaryCancel}
                initialData={{
                  visitType: 'walk_in',
                  visitDate: new Date()
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex flex-col items-center space-y-1 p-2 text-rose-600 hover:text-rose-700 transition-colors"
          >
            <div className="bg-rose-100 p-2 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex flex-col items-center space-y-1 p-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <div className="bg-blue-100 p-2 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex flex-col items-center space-y-1 p-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <div className="bg-purple-100 p-2 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center space-y-1 p-2 text-green-600 hover:text-green-700 transition-colors"
          >
            <div className="bg-green-100 p-2 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex flex-col items-center space-y-1 p-2 text-amber-600 hover:text-amber-700 transition-colors"
          >
            <div className="bg-amber-100 p-2 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}