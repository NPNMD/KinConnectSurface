import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Coffee, 
  Moon, 
  Sun, 
  Repeat, 
  AlertTriangle,
  Info,
  Save,
  X,
  Settings
} from 'lucide-react';
import type { 
  NewEnhancedMedicationSchedule,
  Medication,
  TimingType,
  MealType,
  SleepRelativeType,
  ScheduleConflict
} from '@shared/types';

interface AdvancedScheduleFormProps {
  medication: Medication;
  onSave: (schedule: NewEnhancedMedicationSchedule) => Promise<void>;
  onCancel: () => void;
  existingSchedules?: any[];
  isLoading?: boolean;
}

export default function AdvancedScheduleForm({
  medication,
  onSave,
  onCancel,
  existingSchedules = [],
  isLoading = false
}: AdvancedScheduleFormProps) {
  const [timingType, setTimingType] = useState<TimingType>('absolute');
  const [frequency, setFrequency] = useState<string>('daily');
  const [times, setTimes] = useState<string[]>(['07:00']);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [dosageAmount, setDosageAmount] = useState<string>(medication.dosage);
  const [instructions, setInstructions] = useState<string>(medication.instructions || '');
  
  // Meal-relative timing
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealOffset, setMealOffset] = useState<number>(0);
  const [mealFallbackTime, setMealFallbackTime] = useState<string>('07:00');
  
  // Sleep-relative timing
  const [sleepRelativeTo, setSleepRelativeTo] = useState<SleepRelativeType>('bedtime');
  const [sleepOffset, setSleepOffset] = useState<number>(0);
  const [sleepFallbackTime, setSleepFallbackTime] = useState<string>('22:00');
  
  // Interval timing
  const [intervalHours, setIntervalHours] = useState<number>(8);
  const [intervalStartTime, setIntervalStartTime] = useState<string>('07:00');
  const [intervalEndTime, setIntervalEndTime] = useState<string>('22:00');
  const [avoidSleepHours, setAvoidSleepHours] = useState<boolean>(true);
  const [maxDosesPerDay, setMaxDosesPerDay] = useState<number>(3);
  
  // Validation and conflicts
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (timingType === 'absolute') {
      updateTimesForFrequency(frequency);
    }
  }, [frequency, timingType]);

  useEffect(() => {
    validateSchedule();
  }, [timingType, frequency, times, mealType, mealOffset, sleepRelativeTo, sleepOffset, intervalHours]);

  const updateTimesForFrequency = (freq: string) => {
    switch (freq) {
      case 'daily':
        setTimes(['07:00']);
        break;
      case 'twice_daily':
        setTimes(['07:00', '19:00']);
        break;
      case 'three_times_daily':
        setTimes(['07:00', '13:00', '19:00']);
        break;
      case 'four_times_daily':
        setTimes(['07:00', '12:00', '17:00', '22:00']);
        break;
      default:
        setTimes(['07:00']);
    }
  };

  const validateSchedule = () => {
    const errors: Record<string, string> = {};
    const newConflicts: ScheduleConflict[] = [];

    if (!dosageAmount.trim()) {
      errors.dosageAmount = 'Dosage amount is required';
    }

    if (timingType === 'absolute' && times.length === 0) {
      errors.times = 'At least one time is required';
    }

    if (timingType === 'interval') {
      if (intervalHours < 1 || intervalHours > 24) {
        errors.intervalHours = 'Interval must be between 1 and 24 hours';
      }
      if (maxDosesPerDay < 1 || maxDosesPerDay > 12) {
        errors.maxDosesPerDay = 'Max doses per day must be between 1 and 12';
      }
    }
    
    setValidationErrors(errors);
    setConflicts(newConflicts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      const scheduleData: NewEnhancedMedicationSchedule = {
        medicationId: medication.id,
        patientId: medication.patientId,
        frequency: frequency as any,
        times: timingType === 'absolute' ? times : [],
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        isIndefinite,
        dosageAmount,
        instructions,
        generateCalendarEvents: true,
        reminderMinutesBefore: [15, 5],
        isActive: true,
        timingType,
        
        ...(timingType === 'meal_relative' && {
          mealRelativeTiming: {
            mealType,
            offsetMinutes: mealOffset,
            isFlexible: true,
            fallbackTime: mealFallbackTime
          }
        }),
        
        ...(timingType === 'sleep_relative' && {
          sleepRelativeTiming: {
            relativeTo: sleepRelativeTo,
            offsetMinutes: sleepOffset,
            fallbackTime: sleepFallbackTime
          }
        }),
        
        ...(timingType === 'interval' && {
          intervalTiming: {
            intervalHours,
            startTime: intervalStartTime,
            endTime: intervalEndTime,
            avoidSleepHours,
            maxDosesPerDay
          }
        })
      };

      await onSave(scheduleData);
    } catch (error) {
      console.error('Error saving advanced schedule:', error);
    }
  };

  const getMealTimingLabel = (offset: number): string => {
    if (offset === 0) return 'with meal';
    if (offset < 0) return `${Math.abs(offset)} minutes before meal`;
    return `${offset} minutes after meal`;
  };

  const getSleepTimingLabel = (relativeTo: SleepRelativeType, offset: number): string => {
    const timeType = relativeTo === 'bedtime' ? 'bedtime' : 'waking up';
    if (offset === 0) return `at ${timeType}`;
    if (offset < 0) return `${Math.abs(offset)} minutes before ${timeType}`;
    return `${offset} minutes after ${timeType}`;
  };

  const getSchedulePreview = (): string => {
    switch (timingType) {
      case 'absolute':
        return `Take ${dosageAmount} at ${times.join(', ')} daily`;
      case 'meal_relative':
        return `Take ${dosageAmount} ${getMealTimingLabel(mealOffset)} for ${mealType}`;
      case 'sleep_relative':
        return `Take ${dosageAmount} ${getSleepTimingLabel(sleepRelativeTo, sleepOffset)}`;
      case 'interval':
        return `Take ${dosageAmount} every ${intervalHours} hours from ${intervalStartTime} to ${intervalEndTime}`;
      default:
        return `Take ${dosageAmount} as scheduled`;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Advanced Schedule</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900">{medication.name}</h4>
        <p className="text-sm text-gray-600">{medication.dosage} • {medication.frequency}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Timing Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: 'absolute', label: 'Fixed Times', icon: <Clock className="w-4 h-4" />, description: 'Specific times each day' },
              { value: 'meal_relative', label: 'Meal-Relative', icon: <Coffee className="w-4 h-4" />, description: 'Before/after meals' },
              { value: 'sleep_relative', label: 'Sleep-Relative', icon: <Moon className="w-4 h-4" />, description: 'Bedtime/wake time' },
              { value: 'interval', label: 'Interval-Based', icon: <Repeat className="w-4 h-4" />, description: 'Every X hours' }
            ].map((option) => (
              <label
                key={option.value}
                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  timingType === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="timingType"
                  value={option.value}
                  checked={timingType === option.value}
                  onChange={(e) => setTimingType(e.target.value as TimingType)}
                  className="sr-only"
                />
                <div className="mb-2">{option.icon}</div>
                <div className="text-sm font-medium text-center">{option.label}</div>
                <div className="text-xs text-center text-gray-500 mt-1">{option.description}</div>
              </label>
            ))}
          </div>
        </div>

        {timingType === 'absolute' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="daily">Once daily</option>
                <option value="twice_daily">Twice daily</option>
                <option value="three_times_daily">Three times daily</option>
                <option value="four_times_daily">Four times daily</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Times
              </label>
              <div className="space-y-2">
                {times.map((time, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...times];
                        newTimes[index] = e.target.value;
                        setTimes(newTimes);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTimes(times.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {timingType === 'meal_relative' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meal Type
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="breakfast">🌅 Breakfast</option>
                <option value="lunch">☀️ Lunch</option>
                <option value="dinner">🌆 Dinner</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timing Relative to Meal
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { offset: -30, label: '30 min before' },
                  { offset: -15, label: '15 min before' },
                  { offset: 0, label: 'With meal' },
                  { offset: 15, label: '15 min after' },
                  { offset: 30, label: '30 min after' },
                  { offset: 60, label: '1 hour after' }
                ].map((option) => (
                  <label
                    key={option.offset}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      mealOffset === option.offset
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mealOffset"
                      value={option.offset}
                      checked={mealOffset === option.offset}
                      onChange={(e) => setMealOffset(parseInt(e.target.value))}
                      className="sr-only"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Meal-Relative Timing</p>
                  <p>
                    This medication will be scheduled {getMealTimingLabel(mealOffset)} for {mealType}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {timingType === 'sleep_relative' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relative to Sleep Schedule
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  sleepRelativeTo === 'bedtime' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="sleepRelativeTo"
                    value="bedtime"
                    checked={sleepRelativeTo === 'bedtime'}
                    onChange={(e) => setSleepRelativeTo(e.target.value as SleepRelativeType)}
                    className="sr-only"
                  />
                  <Moon className="w-4 h-4 mr-2" />
                  <span className="text-sm">Bedtime</span>
                </label>
                
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  sleepRelativeTo === 'wake_time' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="sleepRelativeTo"
                    value="wake_time"
                    checked={sleepRelativeTo === 'wake_time'}
                    onChange={(e) => setSleepRelativeTo(e.target.value as SleepRelativeType)}
                    className="sr-only"
                  />
                  <Sun className="w-4 h-4 mr-2" />
                  <span className="text-sm">Wake Time</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timing Offset
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { offset: -60, label: '1 hour before' },
                  { offset: -30, label: '30 min before' },
                  { offset: 0, label: 'Exactly at time' },
                  { offset: 30, label: '30 min after' },
                  { offset: 60, label: '1 hour after' }
                ].map((option) => (
                  <label
                    key={option.offset}
                    className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                      sleepOffset === option.offset
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sleepOffset"
                      value={option.offset}
                      checked={sleepOffset === option.offset}
                      onChange={(e) => setSleepOffset(parseInt(e.target.value))}
                      className="sr-only"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {timingType === 'interval' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interval Presets
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { hours: 4, label: 'Every 4 hours (q4h)', maxDaily: 6 },
                  { hours: 6, label: 'Every 6 hours (q6h)', maxDaily: 4 },
                  { hours: 8, label: 'Every 8 hours (q8h)', maxDaily: 3 },
                  { hours: 12, label: 'Every 12 hours (q12h)', maxDaily: 2 }
                ].map((preset) => (
                  <label
                    key={preset.hours}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      intervalHours === preset.hours
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="intervalHours"
                      value={preset.hours}
                      checked={intervalHours === preset.hours}
                      onChange={(e) => {
                        setIntervalHours(parseInt(e.target.value));
                        setMaxDosesPerDay(preset.maxDaily);
                      }}
                      className="sr-only"
                    />
                    <div>
                      <div className="text-sm font-medium">{preset.label}</div>
                      <div className="text-xs text-gray-500">Max {preset.maxDaily} doses/day</div>
                    </div>
                    <Repeat className="w-4 h-4 text-gray-400" />
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={intervalStartTime}
                  onChange={(e) => setIntervalStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={intervalEndTime}
                  onChange={(e) => setIntervalEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dosage Amount
            </label>
            <input
              type="text"
              value={dosageAmount}
              onChange={(e) => setDosageAmount(e.target.value)}
              placeholder="e.g., 1 tablet, 5ml, 500mg"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.dosageAmount ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.dosageAmount && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.dosageAmount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Take with food, avoid alcohol, empty stomach..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Schedule Preview</h4>
          <div className="text-sm text-gray-600">
            {getSchedulePreview()}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || Object.keys(validationErrors).length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Schedule</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}