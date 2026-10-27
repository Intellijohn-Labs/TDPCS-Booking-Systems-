'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { blockDay, autoGenerateOpenDays, syncWorkingSchedule, logAuditEvent } from '@/lib/staff-api';
import {
  formatSlotDate,
  formatSlotTime,
  getTodayIST,
} from '@/lib/date-utils';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  AlertOctagon,
  CheckCircle,
  RotateCw,
  Sparkles,
  Save,
  X,
  Clock,
  CalendarCheck,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Check,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
} from 'lucide-react';

type OpenDay = Database['public']['Tables']['open_days']['Row'];

const DAY_LABELS: { dow: number; name: string; short: string }[] = [
  { dow: 1, name: 'Monday', short: 'Mon' },
  { dow: 2, name: 'Tuesday', short: 'Tue' },
  { dow: 3, name: 'Wednesday', short: 'Wed' },
  { dow: 4, name: 'Thursday', short: 'Thu' },
  { dow: 5, name: 'Friday', short: 'Fri' },
  { dow: 6, name: 'Saturday', short: 'Sat' },
  { dow: 7, name: 'Sunday', short: 'Sun' },
];

export default function AdminCalendarPage() {
  const [openDays, setOpenDays] = useState<OpenDay[]>([]);
  const [advanceDays, setAdvanceDays] = useState<number>(15);
  const [loading, setLoading] = useState(true);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);

  // Weekly Schedule & Saturday Afternoon Management
  const [weeklyDows, setWeeklyDows] = useState<number[]>([2, 4, 6]); // Default Tue, Thu, Sat
  const [satAfternoon, setSatAfternoon] = useState<boolean>(false);
  const [syncingSchedule, setSyncingSchedule] = useState<boolean>(false);
  const [scheduleNotice, setScheduleNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual Add/Edit Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formStatus, setFormStatus] = useState<'open' | 'blocked'>('open');
  const [formS1Start, setFormS1Start] = useState('10:10');
  const [formS1End, setFormS1End] = useState('12:30');
  const [formS2Start, setFormS2Start] = useState('14:00');
  const [formS2End, setFormS2End] = useState('17:00');
  const [formHasS2, setFormHasS2] = useState(true);
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-Generate Modal state
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoPreset, setAutoPreset] = useState<'standard' | 'weekdays' | 'full_week' | 'custom'>('standard');
  const [selectedDows, setSelectedDows] = useState<number[]>([2, 4, 6]); // default Tue, Thu, Sat
  const [autoHorizon, setAutoHorizon] = useState<number>(60);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  const supabase = createClient();

  // Load calendar data
  const loadData = useCallback(async (isInitial: boolean = false) => {
    setLoading(true);
    try {
      const today = getTodayIST();
      const [{ data: days }, { data: settingsRows }] = await Promise.all([
        supabase.from('open_days').select('*').gte('day', today).order('day', { ascending: true }),
        supabase.from('settings').select('*'),
      ]);

      const loadedDays = (days as OpenDay[]) || [];
      let curAdv = 15;
      let curDows = [2, 4, 6];
      let curSatAfternoon = false;

      if (settingsRows) {
        for (const s of settingsRows as any[]) {
          if (s.key === 'advance_days') curAdv = parseInt(s.value, 10) || 15;
          if (s.key === 'auto_calendar_dows') {
            try {
              const parsed = JSON.parse(s.value);
              if (Array.isArray(parsed) && parsed.length > 0) curDows = parsed;
            } catch {}
          }
          if (s.key === 'saturday_afternoon_session') {
            curSatAfternoon = s.value === 'true';
          }
        }
      }

      setAdvanceDays(curAdv);
      setWeeklyDows(curDows);
      setSatAfternoon(curSatAfternoon);
      setSelectedDows(curDows);

      // Automatic rolling generation check:
      // If there are fewer than 5 future open days on initial load, auto-generate the next 60 days!
      const openCount = loadedDays.filter((d) => d.status === 'open').length;
      if (isInitial && openCount < 5) {
        const res = await autoGenerateOpenDays(60, curDows);
        if (res.ok && (res.days_inserted || 0) > 0) {
          setAutoNotice(`Auto-generated ${res.days_inserted} dates for upcoming weeks.`);
          // Reload refreshed days
          const { data: refetched } = await supabase
            .from('open_days')
            .select('*')
            .gte('day', today)
            .order('day', { ascending: true });
          setOpenDays((refetched as OpenDay[]) || []);
          return;
        }
      }

      setOpenDays(loadedDays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Statistics for top banner
  const { openCount, blockedCount, latestDate } = useMemo(() => {
    const open = openDays.filter((d) => d.status === 'open');
    const blocked = openDays.filter((d) => d.status === 'blocked');
    const latest = openDays.length > 0 ? openDays[openDays.length - 1].day : null;
    return {
      openCount: open.length,
      blockedCount: blocked.length,
      latestDate: latest,
    };
  }, [openDays]);

  // Preset changer for Auto-Generate
  const handlePresetChange = (preset: 'standard' | 'weekdays' | 'full_week' | 'custom') => {
    setAutoPreset(preset);
    if (preset === 'standard') {
      setSelectedDows([2, 4, 6]); // Tue, Thu, Sat (3 days standard)
    } else if (preset === 'weekdays') {
      setSelectedDows([1, 2, 3, 4, 5]); // Mon - Fri
    } else if (preset === 'full_week') {
      setSelectedDows([1, 2, 3, 4, 5, 6]); // Mon - Sat
    }
  };

  // Apply & Synchronize Weekly Master Schedule + Saturday Afternoon Toggle
  const handleApplySchedule = async (customDows?: number[], customSatAfternoon?: boolean) => {
    const targetDows = customDows ?? weeklyDows;
    const targetSatAfternoon = customSatAfternoon ?? satAfternoon;

    if (targetDows.length === 0) {
      alert('Please select at least one day open for booking.');
      return;
    }

    setSyncingSchedule(true);
    setScheduleNotice(null);

    try {
      const res = await syncWorkingSchedule(targetDows, targetSatAfternoon);
      if (!res.ok) {
        setScheduleNotice({
          type: 'error',
          text: res.error || 'Failed to update working schedule',
        });
      } else {
        await logAuditEvent('admin:sync_working_schedule', {
          working_dows: targetDows,
          saturday_afternoon: targetSatAfternoon,
          updated_open_days: res.updated_open_days,
          blocked_closed_days: res.blocked_closed_days,
        });

        const activeDayNames = targetDows
          .map((d) => DAY_LABELS.find((l) => l.dow === d)?.short)
          .join(', ');

        setScheduleNotice({
          type: 'success',
          text: `Live update applied! Open days: ${activeDayNames} (${targetDows.length} days/week). Saturday Afternoon: ${
            targetSatAfternoon ? 'ENABLED (2:00 PM – 5:00 PM)' : 'DISABLED (Morning 10:10 AM – 12:30 PM only)'
          }.`,
        });

        await loadData(false);
      }
    } catch (err: any) {
      setScheduleNotice({
        type: 'error',
        text: err.message || 'Failed to synchronize schedule',
      });
    } finally {
      setSyncingSchedule(false);
    }
  };

  // Toggle Weekly Day of Week in Master Schedule Card (Auto-Syncs Live!)
  const handleToggleWeeklyDow = async (dow: number) => {
    const next = weeklyDows.includes(dow)
      ? weeklyDows.filter((d) => d !== dow)
      : [...weeklyDows, dow].sort();

    if (next.length === 0) {
      alert('Please keep at least one day open for booking.');
      return;
    }

    setWeeklyDows(next);
    await handleApplySchedule(next, satAfternoon);
  };

  // Set Preset for Weekly Master Schedule Card (Auto-Syncs Live!)
  const handleSelectWeeklyPreset = async (dows: number[]) => {
    setWeeklyDows(dows);
    await handleApplySchedule(dows, satAfternoon);
  };

  // Toggle Saturday Afternoon (Auto-Syncs Live!)
  const handleToggleSaturdayAfternoon = async () => {
    const next = !satAfternoon;
    setSatAfternoon(next);
    await handleApplySchedule(weeklyDows, next);
  };

  // Toggle day of week in custom preset
  const handleToggleDow = (dow: number) => {
    setAutoPreset('custom');
    setSelectedDows((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    );
  };

  // Run Auto-Generation
  const handleRunAutoGenerate = async (horizonDays?: number) => {
    const daysToGenerate = horizonDays || autoHorizon;
    setAutoGenerating(true);
    setAutoError(null);
    try {
      const dows = selectedDows.length > 0 ? selectedDows : [1, 2, 3, 4, 5, 6];
      const res = await autoGenerateOpenDays(daysToGenerate, dows);

      if (!res.ok) {
        setAutoError(res.error || 'Failed to auto-generate dates');
      } else {
        await logAuditEvent('admin:auto_generate_calendar', {
          days_ahead: daysToGenerate,
          days_inserted: res.days_inserted || 0,
          dows,
        });
        setAutoNotice(
          `Calendar successfully updated! Added ${res.days_inserted || 0} open dates across next ${daysToGenerate} days.`
        );
        setAutoModalOpen(false);
        await loadData(false);
      }
    } catch (err: any) {
      setAutoError(err.message || 'Auto-generation failed');
    } finally {
      setAutoGenerating(false);
    }
  };

  // Open modal for new single date
  const handleOpenAdd = () => {
    setEditingDay(null);
    setFormDate(getTodayIST());
    setFormStatus('open');
    setFormS1Start('10:10');
    setFormS1End('12:30');
    setFormS2Start('14:00');
    setFormS2End('17:00');
    setFormHasS2(true);
    setFormNote('');
    setFormError(null);
    setModalOpen(true);
  };

  // Open modal for editing existing date
  const handleOpenEdit = (d: OpenDay) => {
    setEditingDay(d.day);
    setFormDate(d.day);
    setFormStatus(d.status);
    setFormS1Start(d.s1_start || '10:10');
    setFormS1End(d.s1_end || '12:30');
    setFormS2Start(d.s2_start || '14:00');
    setFormS2End(d.s2_end || '17:00');
    setFormHasS2(Boolean(d.s2_start && d.s2_end));
    setFormNote(d.note || '');
    setFormError(null);
    setModalOpen(true);
  };

  // Validate and Save Day
  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }

    if (formStatus === 'open') {
      if (!formS1Start || !formS1End) {
        setFormError('Session 1 start and end times are required.');
        return;
      }
      if (formS1End <= formS1Start) {
        setFormError('Session 1 end time must be after start time.');
        return;
      }
      if (formHasS2) {
        if (!formS2Start || !formS2End) {
          setFormError('Session 2 start and end times are required.');
          return;
        }
        if (formS2End <= formS2Start) {
          setFormError('Session 2 end time must be after start time.');
          return;
        }
        if (formS2Start < formS1End) {
          setFormError('Session 2 cannot overlap with Session 1.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        day: formDate,
        status: formStatus,
        s1_start: formStatus === 'open' ? formS1Start : null,
        s1_end: formStatus === 'open' ? formS1End : null,
        s2_start: formStatus === 'open' && formHasS2 ? formS2Start : null,
        s2_end: formStatus === 'open' && formHasS2 ? formS2End : null,
        note: formNote.trim() || null,
      };

      const { error } = await supabase.from('open_days').upsert(payload as any);
      if (error) {
        setFormError(error.message);
      } else {
        await logAuditEvent('admin:save_day', {
          day: formDate,
          status: formStatus,
          s1: `${formS1Start}-${formS1End}`,
          s2: formHasS2 ? `${formS2Start}-${formS2End}` : null,
          note: formNote.trim() || null,
        });
        setModalOpen(false);
        await loadData(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error saving date');
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Block
  const handleToggleBlock = async (d: OpenDay) => {
    if (d.status === 'open') {
      const reason = prompt(`Reason for blocking ${d.day}?`, 'Holiday / Maintenance');
      if (reason === null) return;
      const res = await blockDay(d.day, reason);
      if (res.ok) {
        alert(`Day blocked. Cancelled ${res.cancelled || 0} bookings.`);
        await loadData(false);
      } else {
        alert(res.error || 'Failed to block day');
      }
    } else {
      const { error } = await (supabase
        .from('open_days')
        .update as any)({ status: 'open', note: null })
        .eq('day', d.day);
      if (error) alert(error.message);
      else {
        await logAuditEvent('admin:unblock_day', { day: d.day });
        await loadData(false);
      }
    }
  };

  // Delete Open Day Schedule
  const handleDeleteDay = async (d: OpenDay) => {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('day', d.day)
      .in('status', ['booked', 'arrived', 'called']);

    let confirmMsg = `Are you sure you want to delete the schedule for ${formatSlotDate(d.day)}?`;
    if (count && count > 0) {
      confirmMsg = `WARNING: There are ${count} active member booking(s) on ${formatSlotDate(d.day)}. Deleting this day will remove the schedule. Proceed?`;
    }

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('open_days').delete().eq('day', d.day);
      if (error) {
        alert(error.message);
      } else {
        await logAuditEvent('admin:delete_day', { day: d.day });
        await loadData(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete day');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Calendar & Working Hours Master
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated rolling calendar generator, working session hours, and holiday management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setAutoModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>Auto-Generate Dates</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Single Date</span>
          </button>

          <button
            onClick={() => loadData(false)}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
            title="Refresh Schedule"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Auto-Notice Banner */}
      {autoNotice && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{autoNotice}</span>
          </div>
          <button
            onClick={() => setAutoNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auto-Generation Live Status Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <h2 className="text-sm font-bold tracking-wide uppercase text-emerald-300">
                Automated Rolling Calendar Active
              </h2>
            </div>
            <p className="text-xs text-emerald-100/90 max-w-2xl leading-relaxed">
              Open dates are automatically maintained ahead every night. Members can book slots up to{' '}
              <strong className="text-white underline">{advanceDays} days advance</strong>. Active booking days:{' '}
              <strong className="text-white">
                {weeklyDows.map((d) => DAY_LABELS.find((l) => l.dow === d)?.short).join(', ')} ({weeklyDows.length} days/week)
              </strong>
              . Saturday afternoon is{' '}
              <strong className="text-white underline">
                {satAfternoon ? 'OPEN (2 PM – 5 PM)' : 'CLOSED (Morning only)'}
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-emerald-200 block uppercase font-semibold">Available Schedule</span>
              <span className="text-xs font-bold text-white">
                {latestDate ? `${openCount} Days (Through ${formatSlotDate(latestDate)})` : 'Loading...'}
              </span>
            </div>

            <button
              onClick={() => handleRunAutoGenerate(30)}
              disabled={autoGenerating}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-slate-950 fill-current" />
              <span>{autoGenerating ? 'Generating...' : '+30 Days Quick Extend'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Schedule & Saturday Afternoon Control Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Weekly Booking Schedule & Saturday Afternoon Control
              </h2>
              <p className="text-xs text-slate-500">
                Choose which days are open for member booking each week, and turn Saturday afternoon sessions ON or OFF.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleApplySchedule()}
              disabled={syncingSchedule}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {syncingSchedule ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synchronizing...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Apply & Sync Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Schedule Notice */}
        {scheduleNotice && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium flex items-center space-x-2 ${
              scheduleNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            {scheduleNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{scheduleNotice.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Weekly Open Days */}
          <div className="space-y-3.5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Weekly Open Days for Booking</span>
                <span className="text-[11px] text-slate-500">
                  Select which days members can book slots each week.
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                {weeklyDows.length} Days Active
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleSelectWeeklyPreset([2, 4, 6])}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  weeklyDows.length === 3 && [2, 4, 6].every((d) => weeklyDows.includes(d))
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ★ Standard 3 Days (Tue, Thu, Sat)
              </button>
              <button
                type="button"
                onClick={() => handleSelectWeeklyPreset([1, 2, 3, 4, 5])}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  weeklyDows.length === 5 && [1, 2, 3, 4, 5].every((d) => weeklyDows.includes(d))
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                5 Days (Mon–Fri)
              </button>
              <button
                type="button"
                onClick={() => handleSelectWeeklyPreset([1, 2, 3, 4, 5, 6])}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  weeklyDows.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => weeklyDows.includes(d))
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                6 Days (Mon–Sat)
              </button>
            </div>

            {/* Individual Day Buttons */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
              {DAY_LABELS.map(({ dow, name, short }) => {
                const isActive = weeklyDows.includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => handleToggleWeeklyDow(dow)}
                    className={`py-2 px-1 rounded-xl text-center text-xs font-bold transition border flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    <span className="text-[11px] font-extrabold">{short}</span>
                    <span className="text-[9px] font-normal mt-0.5 opacity-80">
                      {isActive ? '✓ Open' : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              <strong>Tip:</strong> Changing this list and clicking &ldquo;Apply &amp; Sync Schedule&rdquo; will automatically open matching upcoming days and close unselected days that do not have active member bookings.
            </p>
          </div>

          {/* Column 2: Saturday Afternoon Session Toggle */}
          <div className="space-y-3.5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Saturday Afternoon Session (2:00 PM – 5:00 PM)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Switch Saturday afternoons ON or OFF for member slot booking.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSaturdayAfternoon}
                  disabled={syncingSchedule}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                    satAfternoon ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={satAfternoon}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      satAfternoon ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
                  satAfternoon
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold">
                  {satAfternoon ? (
                    <>
                      <Sun className="w-4 h-4 text-emerald-600" />
                      <span>Saturday Afternoon is ON (Full Day Booking)</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-amber-600" />
                      <span>Saturday Afternoon is OFF (Morning Only)</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] opacity-90">
                  {satAfternoon
                    ? 'Members can book both Morning (10:10 AM – 12:30 PM) and Afternoon (2:00 PM – 5:00 PM) slots on Saturdays.'
                    : 'Members can ONLY book Morning (10:10 AM – 12:30 PM) slots on Saturdays. Afternoon session (2:00 PM – 5:00 PM) is disabled and closed.'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Current Setting: <strong className="text-slate-800">{satAfternoon ? 'Full Day (Morning + Afternoon)' : 'Morning Session Only (10:10 AM – 12:30 PM)'}</strong>
              </span>
              <button
                type="button"
                onClick={handleToggleSaturdayAfternoon}
                disabled={syncingSchedule}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition border disabled:opacity-50 ${
                  satAfternoon
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                }`}
              >
                {satAfternoon ? 'Turn Afternoon OFF' : 'Turn Afternoon ON'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Compact Calendar Cards */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading schedule...</span>
          </div>
        ) : openDays.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs space-y-3">
            <p>No open days scheduled.</p>
            <button
              onClick={() => handleRunAutoGenerate(60)}
              className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              Auto-Generate 60 Days
            </button>
          </div>
        ) : (
          openDays.map((d) => (
            <div
              key={d.day}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">{formatSlotDate(d.day)}</span>
                  <span className="text-[11px] font-mono text-slate-400">{d.day}</span>
                </div>
                {d.status === 'open' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Open
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                    Blocked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Session 1</span>
                  <span className="font-semibold text-slate-800">
                    {d.s1_start && d.s1_end ? `${formatSlotTime(d.s1_start)} - ${formatSlotTime(d.s1_end)}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Session 2</span>
                  <span className="font-semibold text-slate-800">
                    {d.status === 'open' ? (
                      d.s2_start && d.s2_end ? (
                        `${formatSlotTime(d.s2_start)} - ${formatSlotTime(d.s2_end)}`
                      ) : (
                        <span className="text-amber-700 font-bold text-[11px]">Closed (Morning Only)</span>
                      )
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              {d.note && (
                <p className="text-xs text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                  {d.note}
                </p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(d)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Hours</span>
                </button>
                <button
                  onClick={() => handleToggleBlock(d)}
                  className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    d.status === 'open'
                      ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>{d.status === 'open' ? 'Block Date' : 'Unblock'}</span>
                </button>
                <button
                  onClick={() => handleDeleteDay(d)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
                  title="Delete Date"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Open Days Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Session 1 (Morning)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Session 2 (Afternoon)</th>
                <th className="py-3.5 px-4">Note / Reason</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    <span>Loading schedule...</span>
                  </td>
                </tr>
              ) : openDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                    <div>No open days currently scheduled.</div>
                    <button
                      onClick={() => handleRunAutoGenerate(60)}
                      className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-900"
                    >
                      Auto-Generate 60 Days Now
                    </button>
                  </td>
                </tr>
              ) : (
                openDays.map((d) => (
                  <tr key={d.day} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatSlotDate(d.day)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {d.status === 'open' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Open
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                          Blocked
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {d.s1_start && d.s1_end
                        ? `${formatSlotTime(d.s1_start)} - ${formatSlotTime(d.s1_end)}`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {d.status === 'open' ? (
                        d.s2_start && d.s2_end ? (
                          `${formatSlotTime(d.s2_start)} - ${formatSlotTime(d.s2_end)}`
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-sans">
                            Closed (Morning Only)
                          </span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 italic">{d.note || '—'}</td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(d)}
                        className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit Sessions"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleBlock(d)}
                        className={`p-1.5 rounded-lg transition ${
                          d.status === 'open'
                            ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={d.status === 'open' ? 'Block Date' : 'Unblock Date'}
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDay(d)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                        title="Delete Schedule Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Generate Modal */}
      {autoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Auto-Generate Calendar Dates</h3>
                  <p className="text-[11px] text-slate-500">
                    Automatically populate future open dates and working sessions
                  </p>
                </div>
              </div>
              <button onClick={() => setAutoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {autoError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {autoError}
              </div>
            )}

            {/* Presets */}
            <div className="space-y-2">
              <label className="block font-semibold text-slate-700 text-xs">Working Schedule Preset</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetChange('standard')}
                  className={`p-2.5 rounded-xl border text-left transition text-xs ${
                    autoPreset === 'standard'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block font-bold">Standard 3 Days</span>
                  <span className="text-[10px] text-slate-500 font-normal">Tue, Thu &amp; Sat (Society Standard)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('weekdays')}
                  className={`p-2.5 rounded-xl border text-left transition text-xs ${
                    autoPreset === 'weekdays'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block font-bold">Weekdays</span>
                  <span className="text-[10px] text-slate-500 font-normal">Monday – Friday</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('full_week')}
                  className={`p-2.5 rounded-xl border text-left transition text-xs ${
                    autoPreset === 'full_week'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block font-bold">Full Week</span>
                  <span className="text-[10px] text-slate-500 font-normal">Monday – Saturday</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('custom')}
                  className={`p-2.5 rounded-xl border text-left transition text-xs ${
                    autoPreset === 'custom'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block font-bold">Custom Days</span>
                  <span className="text-[10px] text-slate-500 font-normal">Select specific days below</span>
                </button>
              </div>
            </div>

            {/* Days of week selector */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 text-xs">Days Open for Booking</label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map(({ dow, name, short }) => {
                  const isSelected = selectedDows.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => handleToggleDow(dow)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        isSelected
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizon selector */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 text-xs">Generation Horizon</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { days: 30, label: '30 Days' },
                  { days: 60, label: '60 Days' },
                  { days: 90, label: '90 Days' },
                  { days: 180, label: '6 Months' },
                ].map(({ days, label }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setAutoHorizon(days)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border text-center transition ${
                      autoHorizon === days
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Saturday afternoon status info */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 flex items-center justify-between">
              <span>Saturday afternoon rule:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${satAfternoon ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {satAfternoon ? 'Open (2:00 PM – 5:00 PM)' : 'Closed (Morning Only)'}
              </span>
            </div>

            {/* Non-destructive guarantee notice */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-950 flex items-start space-x-2">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Conflict-Safe Guarantee:</strong> Existing blocked holidays, custom session changes, and active member bookings are strictly preserved and never overwritten.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAutoModalOpen(false)}
                className="py-2.5 px-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRunAutoGenerate()}
                disabled={autoGenerating || selectedDows.length === 0}
                className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {autoGenerating ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Schedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingDay ? `Edit Hours for ${editingDay}` : 'Add Open Booking Date'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDay} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  disabled={Boolean(editingDay)}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 disabled:opacity-60"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'open' | 'blocked')}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                >
                  <option value="open">Open for Booking</option>
                  <option value="blocked">Blocked (Holiday / Closed)</option>
                </select>
              </div>

              {formStatus === 'open' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
                    <span className="font-bold text-slate-800 block">Session 1 (Morning)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Start Time</label>
                        <input
                          type="time"
                          value={formS1Start}
                          onChange={(e) => setFormS1Start(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">End Time</label>
                        <input
                          type="time"
                          value={formS1End}
                          onChange={(e) => setFormS1End(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Session 2 (Afternoon)</span>
                      <label className="flex items-center space-x-1.5 text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formHasS2}
                          onChange={(e) => setFormHasS2(e.target.checked)}
                          className="rounded text-emerald-800"
                        />
                        <span className="text-[11px]">Enable</span>
                      </label>
                    </div>

                    {formHasS2 && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Start Time</label>
                          <input
                            type="time"
                            value={formS2Start}
                            onChange={(e) => setFormS2Start(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">End Time</label>
                          <input
                            type="time"
                            value={formS2End}
                            onChange={(e) => setFormS2End(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="e.g. Society General Holiday"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
