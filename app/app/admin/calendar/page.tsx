'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { blockDay } from '@/lib/staff-api';
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
} from 'lucide-react';

type OpenDay = Database['public']['Tables']['open_days']['Row'];

export default function AdminCalendarPage() {
  const [openDays, setOpenDays] = useState<OpenDay[]>([]);
  const [advanceDays, setAdvanceDays] = useState<number>(15);
  const [loading, setLoading] = useState(true);

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formStatus, setFormStatus] = useState<'open' | 'blocked'>('open');
  const [formS1Start, setFormS1Start] = useState('10:00');
  const [formS1End, setFormS1End] = useState('13:00');
  const [formS2Start, setFormS2Start] = useState('14:00');
  const [formS2End, setFormS2End] = useState('15:00');
  const [formHasS2, setFormHasS2] = useState(true);
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: days }, { data: advSetting }] = await Promise.all([
        supabase.from('open_days').select('*').gte('day', getTodayIST()).order('day', { ascending: true }),
        supabase.from('settings').select('value').eq('key', 'advance_days').single(),
      ]);

      setOpenDays(days || []);
      if (advSetting) setAdvanceDays(parseInt((advSetting as any).value, 10) || 15);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for new date
  const handleOpenAdd = () => {
    setEditingDay(null);
    setFormDate(getTodayIST());
    setFormStatus('open');
    setFormS1Start('10:00');
    setFormS1End('13:00');
    setFormS2Start('14:00');
    setFormS2End('15:00');
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
    setFormS1Start(d.s1_start || '10:00');
    setFormS1End(d.s1_end || '13:00');
    setFormS2Start(d.s2_start || '14:00');
    setFormS2End(d.s2_end || '15:00');
    setFormHasS2(Boolean(d.s2_start && d.s2_end));
    setFormNote(d.note || '');
    setFormError(null);
    setModalOpen(true);
  };

  // Validate and Save Day
  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
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
        setModalOpen(false);
        await loadData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Error saving date');
    } finally {
      setSaving(false);
    }
  };

  // Quick helper action: "Add every Tuesday, Thursday and Saturday for next 15 days"
  const handleBatchAddDefaultDays = async () => {
    if (
      !confirm(
        `This will generate/refresh open days (Tue & Thu: 10-13, 14-15; Sat: 10-12:30) for the next ${advanceDays} days. Continue?`
      )
    )
      return;

    setLoading(true);
    try {
      const today = new Date();
      const records = [];

      for (let i = 0; i <= advanceDays; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayOfWeek = d.getDay(); // 0 = Sun, 2 = Tue, 4 = Thu, 6 = Sat
        const dayString = d.toISOString().split('T')[0];

        if (dayOfWeek === 2 || dayOfWeek === 4) {
          // Tuesday or Thursday
          records.push({
            day: dayString,
            status: 'open' as const,
            s1_start: '10:00',
            s1_end: '13:00',
            s2_start: '14:00',
            s2_end: '15:00',
            note: 'Standard Working Day',
          });
        } else if (dayOfWeek === 6) {
          // Saturday (single session)
          records.push({
            day: dayString,
            status: 'open' as const,
            s1_start: '10:00',
            s1_end: '12:30',
            s2_start: null,
            s2_end: null,
            note: 'Saturday Half-Day Session',
          });
        }
      }

      const { error } = await supabase.from('open_days').upsert(records as any);
      if (error) {
        alert(error.message);
      } else {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Batch creation failed');
    } finally {
      setLoading(false);
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
        await loadData();
      } else {
        alert(res.error || 'Failed to block day');
      }
    } else {
      // Unblock
      const { error } = await (supabase
        .from('open_days')
        .update as any)({ status: 'open', note: null })
        .eq('day', d.day);
      if (error) alert(error.message);
      else await loadData();
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
        await loadData();
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
            Configure open dates (up to {advanceDays} days advance), working sessions, and holiday blocks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchAddDefaultDays}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generate Tue / Thu / Sat</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Date</span>
          </button>

          <button
            onClick={() => loadData()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
            No open days scheduled. Click &quot;Add Date&quot; to configure.
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
                    {d.s2_start && d.s2_end ? `${formatSlotTime(d.s2_start)} - ${formatSlotTime(d.s2_end)}` : '—'}
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
                <th className="py-3.5 px-4 whitespace-nowrap">Session 1</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Session 2</th>
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
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No open days scheduled. Click &quot;Add Date&quot; or &quot;Generate Tue / Thu / Sat&quot; to configure.
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
                      {d.s2_start && d.s2_end
                        ? `${formatSlotTime(d.s2_start)} - ${formatSlotTime(d.s2_end)}`
                        : '—'}
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

      {/* Edit / Add Modal */}
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
