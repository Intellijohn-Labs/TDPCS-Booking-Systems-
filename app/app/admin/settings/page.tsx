'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getEffectiveSupabaseUrl } from '@/lib/db/config';
import { logAuditEvent, syncWorkingSchedule } from '@/lib/staff-api';
import {
  Sliders,
  Save,
  Send,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Webhook,
  Phone,
  CalendarDays,
  Sun,
  Moon,
} from 'lucide-react';

const DOW_LABELS = [
  { dow: 1, short: 'Mon' },
  { dow: 2, short: 'Tue' },
  { dow: 3, short: 'Wed' },
  { dow: 4, short: 'Thu' },
  { dow: 5, short: 'Fri' },
  { dow: 6, short: 'Sat' },
  { dow: 7, short: 'Sun' },
];

export default function AdminSettingsPage() {
  const [slotStep, setSlotStep] = useState('5');
  const [reportBuffer, setReportBuffer] = useState('10');
  const [maxExtension, setMaxExtension] = useState('30');
  const [advanceDays, setAdvanceDays] = useState('15');
  const [clientNotifyNumber, setClientNotifyNumber] = useState('');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [saturdayAfternoonSession, setSaturdayAfternoonSession] = useState(false);
  const [autoCalendarDows, setAutoCalendarDows] = useState<number[]>([2, 4, 6]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Test webhook state
  const [testWebhookLoading, setTestWebhookLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const supabase = createClient();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) console.error(error);
      else if (data) {
        data.forEach((item: any) => {
          if (item.key === 'slot_step') setSlotStep(item.value);
          if (item.key === 'report_buffer') setReportBuffer(item.value);
          if (item.key === 'max_extension') setMaxExtension(item.value);
          if (item.key === 'advance_days') setAdvanceDays(item.value);
          if (item.key === 'client_notify_number') setClientNotifyNumber(item.value);
          if (item.key === 'n8n_webhook_url') setN8nWebhookUrl(item.value);
          if (item.key === 'saturday_afternoon_session') setSaturdayAfternoonSession(item.value === 'true');
          if (item.key === 'auto_calendar_dows') {
            try {
              const parsed = JSON.parse(item.value);
              if (Array.isArray(parsed) && parsed.length > 0) setAutoCalendarDows(parsed);
            } catch {}
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleSettingsDow = async (dow: number) => {
    const next = autoCalendarDows.includes(dow)
      ? autoCalendarDows.filter((d) => d !== dow)
      : [...autoCalendarDows, dow].sort();
    if (next.length === 0) {
      alert('Please keep at least one day open for booking.');
      return;
    }
    setAutoCalendarDows(next);
    try {
      await syncWorkingSchedule(next, saturdayAfternoonSession);
      setFeedback({ type: 'success', message: 'Weekly schedule updated live!' });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleToggleSettingsSatAfternoon = async () => {
    const next = !saturdayAfternoonSession;
    setSaturdayAfternoonSession(next);
    try {
      await syncWorkingSchedule(autoCalendarDows, next);
      setFeedback({ type: 'success', message: `Saturday afternoon ${next ? 'enabled' : 'disabled'} live!` });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleResetSettingsDows = async () => {
    setAutoCalendarDows([2, 4, 6]);
    try {
      await syncWorkingSchedule([2, 4, 6], saturdayAfternoonSession);
      setFeedback({ type: 'success', message: 'Reset to standard 3 days (Tue, Thu, Sat) live!' });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const updates = [
        { key: 'slot_step', value: slotStep.trim() },
        { key: 'report_buffer', value: reportBuffer.trim() },
        { key: 'max_extension', value: maxExtension.trim() },
        { key: 'advance_days', value: advanceDays.trim() },
        { key: 'client_notify_number', value: clientNotifyNumber.trim() },
        { key: 'n8n_webhook_url', value: n8nWebhookUrl.trim() },
        { key: 'saturday_afternoon_session', value: saturdayAfternoonSession ? 'true' : 'false' },
        { key: 'auto_calendar_dows', value: JSON.stringify(autoCalendarDows) },
      ];

      for (const item of updates) {
        const { error } = await supabase.from('settings').upsert(item as any);
        if (error) throw error;
      }

      // Synchronize calendar schedule based on new active days and Saturday afternoon toggle
      await syncWorkingSchedule(autoCalendarDows, saturdayAfternoonSession);

      await logAuditEvent('admin:update_settings', {
        slot_step: slotStep.trim(),
        report_buffer: reportBuffer.trim(),
        max_extension: maxExtension.trim(),
        advance_days: advanceDays.trim(),
        client_notify_number: clientNotifyNumber.trim(),
        n8n_webhook_url: n8nWebhookUrl.trim(),
        saturday_afternoon_session: saturdayAfternoonSession,
        auto_calendar_dows: autoCalendarDows,
      });

      setFeedback({ type: 'success', message: 'All branch settings saved successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  // Test n8n webhook event
  const handleSendTestEvent = async () => {
    setTestWebhookLoading(true);
    setTestResult(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(
        `${getEffectiveSupabaseUrl()}/functions/v1/test-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
        }
      );

      const json = await response.json();
      setTestResult(json);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Failed to call test-webhook edge function' });
    } finally {
      setTestWebhookLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Branch & System Settings
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure buffer intervals, slot generators, WhatsApp notification numbers and n8n webhooks
          </p>
        </div>

        <button
          onClick={() => loadSettings()}
          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition self-start sm:self-auto"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Timing & Buffer Settings */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Clock className="w-4 h-4 text-emerald-700" />
            <h2>Scheduling & Timing Parameters</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Slot Step Interval (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={slotStep}
                onChange={(e) => setSlotStep(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Steps in which counter start times are offered to members (default: 5 min).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Report Buffer (Minutes Before Slot)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={reportBuffer}
                onChange={(e) => setReportBuffer(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Required arrival buffer before the slot (default: 10 min). Slots closer than this are not offered.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Max Allowed Extension (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={maxExtension}
                onChange={(e) => setMaxExtension(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Maximum extension staff can grant per booking (default: 30 min).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Advance Booking Limit (Days)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={advanceDays}
                onChange={(e) => setAdvanceDays(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                How many days ahead members can view and book open dates (default: 15 days).
              </p>
            </div>

            {/* Saturday Afternoon Session Toggle */}
            <div className="sm:col-span-2 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block font-semibold text-slate-800">
                  Saturday Afternoon Session (2:00 PM – 5:00 PM)
                </label>
                <p className="text-[11px] text-slate-500">
                  {saturdayAfternoonSession
                    ? 'Members can book both Morning & Afternoon slots on Saturdays.'
                    : 'Members can ONLY book Morning slots (10:10 AM – 12:30 PM). Afternoon session is closed.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleSettingsSatAfternoon}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border shrink-0 ${
                  saturdayAfternoonSession
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                    : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                }`}
              >
                {saturdayAfternoonSession ? '✓ Afternoon ON' : '✕ Afternoon OFF'}
              </button>
            </div>

            {/* Weekly Open Days */}
            <div className="sm:col-span-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block font-semibold text-slate-800">
                  Weekly Open Days for Member Booking ({autoCalendarDows.length} Days Active)
                </label>
                <button
                  type="button"
                  onClick={handleResetSettingsDows}
                  className="text-[11px] text-emerald-800 hover:underline font-bold"
                >
                  Reset to Standard 3 Days (Tue, Thu, Sat)
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DOW_LABELS.map(({ dow, short }) => {
                  const isActive = autoCalendarDows.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => handleToggleSettingsDow(dow)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        isActive
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {short} {isActive ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp & n8n Webhook Integration */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Webhook className="w-4 h-4 text-emerald-700" />
            <h2>n8n & WhatsApp Notification Integration</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                n8n Webhook Endpoint URL
              </label>
              <input
                type="url"
                value={n8nWebhookUrl}
                onChange={(e) => setN8nWebhookUrl(e.target.value)}
                placeholder="https://n8n.yourdomain.com/webhook/tdpcs-events"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Postgres trigger invokes <code>net.http_post</code> to this URL for booking, rescheduling, cancellation, and no-show events.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Branch Client Notification Number
              </label>
              <input
                type="text"
                value={clientNotifyNumber}
                onChange={(e) => setClientNotifyNumber(e.target.value)}
                placeholder="91471XXXXXXX"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Optional branch WhatsApp number included in the payload sent to n8n.
              </p>
            </div>

            {/* Test webhook section */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div>
                <span className="font-bold text-slate-800 block text-xs">Test n8n Webhook Connectivity</span>
                <span className="text-[11px] text-slate-500">
                  Sends a sample test booking event to verify that n8n receives and parses the payload.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSendTestEvent}
                disabled={testWebhookLoading}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex-shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testWebhookLoading ? 'Sending...' : 'Send Test Event'}</span>
              </button>
            </div>

            {testResult && (
              <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
                <pre>{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
