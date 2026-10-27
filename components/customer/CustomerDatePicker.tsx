'use client';

import React, { useState, useMemo } from 'react';
import { CustomerOpenDay } from '@/types/database';
import { formatSlotDate, formatSlotTime } from '@/lib/date-utils';
import { ChevronLeft, ChevronRight, Calendar, Clock, Check, RotateCw } from 'lucide-react';

interface CustomerDatePickerProps {
  availableDates: CustomerOpenDay[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dayStr: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
  subtitle?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CustomerDatePicker({
  availableDates = [],
  selectedDate,
  onSelectDate,
  onRefresh,
  refreshing = false,
  title,
  subtitle,
}: CustomerDatePickerProps) {
  // Build a lookup map of available days for fast O(1) checks
  const availableMap = useMemo(() => {
    const map = new Map<string, CustomerOpenDay>();
    for (const d of availableDates) {
      map.set(d.day, d);
    }
    return map;
  }, [availableDates]);

  // Determine earliest and latest available dates for bounding month navigation
  const { minYearMonth, maxYearMonth, initialYear, initialMonth } = useMemo(() => {
    if (availableDates.length === 0) {
      const now = new Date();
      return {
        minYearMonth: now.getFullYear() * 12 + now.getMonth(),
        maxYearMonth: now.getFullYear() * 12 + now.getMonth() + 2,
        initialYear: now.getFullYear(),
        initialMonth: now.getMonth(),
      };
    }

    const sorted = [...availableDates].sort((a, b) => a.day.localeCompare(b.day));
    const [firstY, firstM] = sorted[0].day.split('-').map(Number);
    const [lastY, lastM] = sorted[sorted.length - 1].day.split('-').map(Number);

    const minYM = firstY * 12 + (firstM - 1);
    const maxYM = lastY * 12 + (lastM - 1);

    // Initial month is selectedDate if valid, otherwise first available date
    let initY = firstY;
    let initM = firstM - 1;

    if (selectedDate && selectedDate.includes('-')) {
      const [selY, selM] = selectedDate.split('-').map(Number);
      if (!isNaN(selY) && !isNaN(selM)) {
        initY = selY;
        initM = selM - 1;
      }
    }

    return {
      minYearMonth: minYM,
      maxYearMonth: maxYM,
      initialYear: initY,
      initialMonth: initM,
    };
  }, [availableDates, selectedDate]);

  // Current displayed calendar year & month (0-indexed month)
  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);

  const currentYearMonth = currentYear * 12 + currentMonth;
  const canGoPrev = currentYearMonth > minYearMonth;
  const canGoNext = currentYearMonth < maxYearMonth;

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Calendar matrix calculations
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun, 1=Mon...

  // Format today's date for highlight
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const selectedDayInfo = selectedDate ? availableMap.get(selectedDate) : null;

  return (
    <div className="space-y-4">
      {/* Header Info */}
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      )}

      {/* Main Calendar Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
        {/* Month & Navigation Bar */}
        <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-100">
          <div>
            <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight block">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <span className="text-[11px] text-slate-400 font-medium block">
              Tap any green date to choose your slot
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh calendar dates"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 active:scale-95 transition"
              >
                <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-700' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              aria-label="Next month"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Header Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`text-[11px] font-bold uppercase tracking-wider py-1.5 ${
                i === 0 ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Leading blank offset days */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`blank-${idx}`} className="aspect-square" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;

            const isOpen = availableMap.has(dayStr);
            const isSelected = selectedDate === dayStr;
            const isToday = dayStr === todayStr;

            if (isOpen) {
              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => onSelectDate(dayStr)}
                  className={`aspect-square min-h-[42px] sm:min-h-[46px] rounded-2xl flex flex-col items-center justify-center relative transition-all duration-150 ${
                    isSelected
                      ? 'bg-emerald-800 text-white font-extrabold shadow-md ring-2 ring-emerald-800 ring-offset-2 scale-[1.04] z-10'
                      : 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/90 hover:border-emerald-500 hover:bg-emerald-100 hover:scale-105 active:scale-95'
                  }`}
                >
                  <span className="text-xs sm:text-sm leading-none">{dayNum}</span>
                  {!isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1" />
                  )}
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mt-1" />
                  )}
                </button>
              );
            }

            // Closed / Not Available Day
            return (
              <div
                key={dayStr}
                className={`aspect-square min-h-[42px] sm:min-h-[46px] rounded-2xl flex flex-col items-center justify-center text-slate-300 select-none ${
                  isToday ? 'border border-dashed border-slate-300' : ''
                }`}
              >
                <span className="text-xs font-medium leading-none">{dayNum}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-emerald-100 border border-emerald-300 flex-shrink-0" />
            <span>Open Date</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-emerald-800 flex-shrink-0" />
            <span>Selected</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-slate-100 flex-shrink-0" />
            <span>Closed / Sunday</span>
          </div>
        </div>
      </div>

      {/* Selected Date Summary Card */}
      {selectedDate && selectedDayInfo && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-left animate-in fade-in slide-in-from-top-2 duration-150 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Selected Appointment Date
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
              {formatSlotDate(selectedDate)}
            </p>
            <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
              <span>
                {selectedDayInfo.s1_start
                  ? `${formatSlotTime(selectedDayInfo.s1_start)} - ${formatSlotTime(
                      selectedDayInfo.s1_end
                    )}`
                  : ''}
                {selectedDayInfo.s2_start
                  ? ` & ${formatSlotTime(selectedDayInfo.s2_start)} - ${formatSlotTime(
                      selectedDayInfo.s2_end
                    )}`
                  : ''}
              </span>
            </div>
          </div>
          <div className="w-6 h-6 rounded-full bg-emerald-800 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-xs">
            <Check className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
}
