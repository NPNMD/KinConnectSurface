import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  Sun, 
  Sunset, 
  Plus, 
  Clock, 
  Check, 
  X,
  Calendar,
  Edit,
  Trash2
} from 'lucide-react';
import type { MealLog, NewMealLog, MealType } from '@shared/types';
import { useAuth } from '@/contexts/AuthContext';

interface MealLoggerProps {
  patientId: string;
  date?: Date;
  onMealLogged?: (mealLog: MealLog) => void;
  compactMode?: boolean;
}

interface MealLogFormData {
  mealType: MealType;
  loggedAt: Date;
  estimatedTime?: Date;
  notes: string;
}

export default function MealLogger({ 
  patientId, 
  date = new Date(), 
  onMealLogged,
  compactMode = false 
}: MealLoggerProps) {
  const { user } = useAuth();
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MealLogFormData>({
    mealType: 'breakfast',
    loggedAt: new Date(),
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadMealLogs();
  }, [patientId, date]);

  const loadMealLogs = async () => {
    try {
      setIsLoading(true);
      
      // Import the API here to avoid circular dependencies
      const { medicationCalendarApi } = await import('@/lib/medicationCalendarApi');
      
      const result = await medicationCalendarApi.getMealLogs({
        date: date
      });
      
      if (result.success && result.data) {
        setMealLogs(result.data);
      } else {
        console.error('Failed to load meal logs:', result.error);
        setMealLogs([]);
      }
    } catch (error) {
      console.error('Error loading meal logs:', error);
      setMealLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      const mealLogData: NewMealLog = {
        patientId,
        date: new Date(date.toDateString()), // Normalize to date only
        mealType: formData.mealType,
        loggedAt: formData.loggedAt,
        estimatedTime: formData.estimatedTime,
        notes: formData.notes.trim() || undefined
      };

      const { medicationCalendarApi } = await import('@/lib/medicationCalendarApi');
      
      let result;
      if (editingMealId) {
        // Update existing meal log
        result = await medicationCalendarApi.updateMealLog(editingMealId, mealLogData);
      } else {
        // Create new meal log
        result = await medicationCalendarApi.createMealLog(mealLogData);
      }
      
      if (result.success && result.data) {
        // Refresh meal logs
        await loadMealLogs();
        onMealLogged?.(result.data);
        handleCancel();
      } else {
        console.error('Failed to save meal log:', result.error);
        alert(`Failed to save meal log: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error saving meal log:', error);
      alert('Failed to save meal log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (mealLog: MealLog) => {
    setFormData({
      mealType: mealLog.mealType,
      loggedAt: mealLog.loggedAt,
      estimatedTime: mealLog.estimatedTime,
      notes: mealLog.notes || ''
    });
    setEditingMealId(mealLog.id);
    setShowAddForm(true);
  };

  const handleDelete = async (mealLogId: string) => {
    if (window.confirm('Are you sure you want to delete this meal log?')) {
      try {
        const { medicationCalendarApi } = await import('@/lib/medicationCalendarApi');
        
        const result = await medicationCalendarApi.deleteMealLog(mealLogId);
        
        if (result.success) {
          // Refresh meal logs
          await loadMealLogs();
        } else {
          console.error('Failed to delete meal log:', result.error);
          alert(`Failed to delete meal log: ${result.error}`);
        }
      } catch (error) {
        console.error('Error deleting meal log:', error);
        alert('Failed to delete meal log. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingMealId(null);
    setFormData({
      mealType: 'breakfast',
      loggedAt: new Date(),
      notes: ''
    });
  };

  const getMealIcon = (mealType: MealType) => {
    switch (mealType) {
      case 'breakfast':
        return <Coffee className="w-4 h-4 text-orange-600" />;
      case 'lunch':
        return <Sun className="w-4 h-4 text-yellow-600" />;
      case 'dinner':
        return <Sunset className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMealColor = (mealType: MealType) => {
    switch (mealType) {
      case 'breakfast':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'lunch':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'dinner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const todaysMeals = mealLogs.filter(log => 
    log.date.toDateString() === date.toDateString()
  );

  const getMealsForToday = () => {
    const meals = ['breakfast', 'lunch', 'dinner'] as MealType[];
    return meals.map(mealType => {
      const logged = todaysMeals.find(log => log.mealType === mealType);
      return {
        mealType,
        logged,
        isLogged: !!logged
      };
    });
  };

  if (compactMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Today's Meals</h4>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Log meal
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          {getMealsForToday().map(({ mealType, logged, isLogged }) => (
            <div
              key={mealType}
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                isLogged 
                  ? getMealColor(mealType)
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {getMealIcon(mealType)}
              <span className="capitalize">{mealType}</span>
              {isLogged && logged && (
                <span className="text-xs">
                  {formatTime(logged.estimatedTime || logged.loggedAt)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Quick Add Form */}
        {showAddForm && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData(prev => ({ ...prev, mealType: e.target.value as MealType }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
                <input
                  type="time"
                  value={formData.estimatedTime?.toTimeString().slice(0, 5) || new Date().toTimeString().slice(0, 5)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const time = new Date();
                    time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    setFormData(prev => ({ ...prev, estimatedTime: time }));
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                />
              </div>
              
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Log Meal'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">Meal Timing</h3>
          <span className="text-sm text-gray-500">
            {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Log Meal</span>
          </button>
        )}
      </div>

      {/* Today's Meals Overview */}
      <div className="grid grid-cols-3 gap-4">
        {getMealsForToday().map(({ mealType, logged, isLogged }) => (
          <div
            key={mealType}
            className={`p-4 rounded-lg border ${
              isLogged 
                ? getMealColor(mealType)
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2 mb-2">
              {getMealIcon(mealType)}
              <span className="font-medium capitalize">{mealType}</span>
            </div>
            
            {isLogged && logged ? (
              <div className="space-y-1">
                <p className="text-sm">
                  {formatTime(logged.estimatedTime || logged.loggedAt)}
                </p>
                {logged.notes && (
                  <p className="text-xs opacity-75">{logged.notes}</p>
                )}
                <div className="flex items-center space-x-1 mt-2">
                  <button
                    onClick={() => handleEdit(logged)}
                    className="p-1 text-gray-600 hover:text-gray-800"
                    title="Edit meal time"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(logged.id)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="Delete meal log"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Not logged yet
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Meal Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">
              {editingMealId ? 'Edit Meal Time' : 'Log Meal Time'}
            </h4>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meal Type
                </label>
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData(prev => ({ ...prev, mealType: e.target.value as MealType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="breakfast">🌅 Breakfast</option>
                  <option value="lunch">☀️ Lunch</option>
                  <option value="dinner">🌆 Dinner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meal Time
                </label>
                <input
                  type="time"
                  value={formData.estimatedTime?.toTimeString().slice(0, 5) || new Date().toTimeString().slice(0, 5)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const time = new Date(date);
                    time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    setFormData(prev => ({ ...prev, estimatedTime: time }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g., ate out, late meal, light breakfast..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Quick Time Presets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Times
              </label>
              <div className="flex flex-wrap gap-2">
                {getQuickTimePresets(formData.mealType).map((preset) => (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => {
                      const [hours, minutes] = preset.time.split(':');
                      const time = new Date(date);
                      time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                      setFormData(prev => ({ ...prev, estimatedTime: time }));
                    }}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : editingMealId ? 'Update' : 'Log Meal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Meal Logs List */}
      {todaysMeals.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Today's Meal Times</h4>
          <div className="space-y-2">
            {todaysMeals.map((mealLog) => (
              <div
                key={mealLog.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getMealColor(mealLog.mealType)}`}
              >
                <div className="flex items-center space-x-3">
                  {getMealIcon(mealLog.mealType)}
                  <div>
                    <div className="font-medium capitalize">{mealLog.mealType}</div>
                    <div className="text-sm">
                      {formatTime(mealLog.estimatedTime || mealLog.loggedAt)}
                    </div>
                    {mealLog.notes && (
                      <div className="text-xs opacity-75">{mealLog.notes}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(mealLog)}
                    className="p-1 text-gray-600 hover:text-gray-800"
                    title="Edit meal time"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(mealLog.id)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="Delete meal log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {todaysMeals.length === 0 && !showAddForm && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No meals logged today</h4>
          <p className="text-gray-500 mb-4">
            Log your meal times to enable meal-relative medication scheduling.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Log First Meal</span>
          </button>
        </div>
      )}

      {/* Meal Timing Benefits */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start space-x-2">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Why log meal times?</p>
            <ul className="space-y-1 text-xs">
              <li>• Enables meal-relative medication scheduling (e.g., "30 minutes before breakfast")</li>
              <li>• Helps optimize medication timing for better absorption</li>
              <li>• Allows flexible scheduling that adapts to your daily routine</li>
              <li>• Improves medication effectiveness and reduces side effects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get quick time presets for each meal
function getQuickTimePresets(mealType: MealType) {
  switch (mealType) {
    case 'breakfast':
      return [
        { time: '06:00', label: '6:00 AM' },
        { time: '07:00', label: '7:00 AM' },
        { time: '08:00', label: '8:00 AM' },
        { time: '09:00', label: '9:00 AM' }
      ];
    case 'lunch':
      return [
        { time: '11:30', label: '11:30 AM' },
        { time: '12:00', label: '12:00 PM' },
        { time: '12:30', label: '12:30 PM' },
        { time: '13:00', label: '1:00 PM' }
      ];
    case 'dinner':
      return [
        { time: '17:00', label: '5:00 PM' },
        { time: '18:00', label: '6:00 PM' },
        { time: '19:00', label: '7:00 PM' },
        { time: '20:00', label: '8:00 PM' }
      ];
    default:
      return [];
  }
}