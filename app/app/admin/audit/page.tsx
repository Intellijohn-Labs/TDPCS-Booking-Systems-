'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { purgeOldRecords4Months } from '@/lib/staff-api';
import {
  ScrollText,
  Search,
  Filter,
  RotateCw,
  Clock,
  ShieldCheck,
  User,
  X,
  Code2,
  Trash2,
  Calendar,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Activity,
  History,
} from 'lucide-react';

type AuditEntry = Database['public']['Tables']['audit_log']['Row'];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = createClient();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .limit(250);

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      const { data, error } = await query;
      if (error) console.error(error);
      else setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  const handleDeleteLog = async (logId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to delete audit log entry #${logId}?`)) return;

    try {
      const { error } = await supabase.from('audit_log').delete().eq('id', logId);
      if (error) {
        alert(error.message);
      } else {
        if (selectedLog?.id === logId) setSelectedLog(null);
        await loadLogs();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete audit log');
    }
  };

  const handleClearAllLogs = async () => {
    if (
      !confirm(
        'DANGER: This will permanently delete all audit trail entries. Proceed with clearing all logs?'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('audit_log').delete().gte('id', 0);
      if (error) {
        alert(error.message);
      } else {
        setSelectedLog(null);
        setNotice('All audit trail logs have been cleared.');
        await loadLogs();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to clear audit trail');
    } finally {
      setLoading(false);
    }
  };

  const handlePurge4Months = async () => {
    setPurging(true);
    try {
      const res = await purgeOldRecords4Months();
      if (res.ok) {
        const msg = `Purge complete! Removed ${res.deleted_bookings || 0} old booking(s), ${res.deleted_audit_logs || 0} old audit record(s), and ${res.deleted_links || 0} expired link(s) older than 4 months.`;
        setNotice(msg);
        await loadLogs();
      } else {
        alert(res.error || 'Purge failed');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to run 4-month retention cleanup');
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (l.actor && l.actor.toLowerCase().includes(q)) ||
      l.action.toLowerCase().includes(q) ||
      (l.booking_id && l.booking_id.toString().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.startsWith('admin:')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    if (act === 'book') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (act === 'cancel' || act.includes('cancelled')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (act === 'reschedule') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (act === 'extend') {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    if (act.startsWith('status:')) {
      return 'bg-sky-100 text-sky-800 border-sky-200';
    }
    if (act === 'delete') {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (act.includes('block')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (act.startsWith('system:')) {
      return 'bg-slate-100 text-slate-800 border-slate-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              System Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive audit log of all admin operations and booking system actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePurge4Months}
            disabled={purging}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200/80 disabled:opacity-50"
            title="Clean records older than 4 months"
          >
            <History className={`w-3.5 h-3.5 text-slate-500 ${purging ? 'animate-spin' : ''}`} />
            <span>{purging ? 'Purging...' : 'Run 4M Purge Now'}</span>
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClearAllLogs}
              className="flex items-center space-x-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl transition"
              title="Delete all demo/test audit entries"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Clear Trail</span>
            </button>
          )}

          <button
            onClick={() => loadLogs()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
            title="Refresh logs"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4-Month Retention Active Status Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xs border border-indigo-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                4-Month Automatic Retention Policy Active
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              All bookings and audit log entries are retained for exactly <strong className="text-white">4 months</strong>.
              Records older than 4 months are automatically purged every night at 02:00 AM IST via automated maintenance.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-mono font-bold text-slate-200 border border-white/10">
              {logs.length} Logged Entries
            </span>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Actor / Action / Booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Actions</option>
            <option value="admin:">Admin Actions (admin:*)</option>
            <option value="book">Bookings (book)</option>
            <option value="cancel">Cancellations (cancel)</option>
            <option value="reschedule">Reschedules (reschedule)</option>
            <option value="extend">Extensions (extend)</option>
            <option value="status">Status Changes (status:*)</option>
            <option value="block_day">Block Day (block_day)</option>
            <option value="delete">Deletions (delete)</option>
            <option value="purge">Retention Purges (purge)</option>
          </select>
        </div>
      </div>

      {/* Mobile Compact Audit Cards */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading audit records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
            No audit records found.
          </div>
        ) : (
          filteredLogs.map((l) => (
            <div
              key={l.id}
              onClick={() => setSelectedLog(l)}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition active:scale-[0.99] cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] border ${getActionBadge(
                    l.action
                  )}`}
                >
                  {l.action}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(l.at).toLocaleDateString()} {new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <div className="font-semibold text-slate-800 truncate max-w-[180px]">
                  Actor: <span className="font-bold text-slate-900">{l.actor || 'system'}</span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {l.booking_id && (
                    <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                      #{l.booking_id}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteLog(l.id, e)}
                    className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Audit Log Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-44 whitespace-nowrap">Timestamp</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Actor</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Action</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Booking ID</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Payload Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLog(l)}
                    className="hover:bg-slate-50/60 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(l.at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {l.actor || 'system'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] border ${getActionBadge(
                          l.action
                        )}`}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {l.booking_id ? `#${l.booking_id}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(l);
                        }}
                        className="px-2.5 py-1 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-semibold"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={(e) => handleDeleteLog(l.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Entry"
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

      {/* Inspect Detail Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-base text-slate-900">
                  Audit Entry #{selectedLog.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Action</span>
                  <span className="font-mono font-bold text-slate-800">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Actor</span>
                  <span className="font-semibold text-slate-800">{selectedLog.actor || 'system'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Timestamp</span>
                  <span className="font-mono text-slate-600">{new Date(selectedLog.at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Booking ID</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {selectedLog.booking_id ? `#${selectedLog.booking_id}` : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <span className="block font-semibold text-slate-700 mb-1">Payload JSON</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleDeleteLog(selectedLog.id)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition"
              >
                Delete This Entry
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
