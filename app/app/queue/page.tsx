'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, BookingStatus } from '@/types/database';
import {
  setBookingStatus,
  extendBooking,
  blockDay,
} from '@/lib/staff-api';
import {
  formatSlotTime,
  formatSlotDate,
  getTodayIST,
} from '@/lib/date-utils';
import {
  Layers,
  Search,
  Bell,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  RotateCw,
  Calendar,
  AlertTriangle,
  Flame,
  ChevronRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type OpenDay = Database['public']['Tables']['open_days']['Row'];

export default function QueueDeskPage() {
  const [selectedDay, setSelectedDay] = useState<string>(getTodayIST());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openDay, setOpenDay] = useState<OpenDay | null>(null);
  const [maxExtension, setMaxExtension] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Extend Modal State
  const [extendingBooking, setExtendingBooking] = useState<Booking | null>(null);
  const [extensionShiftAlert, setExtensionShiftAlert] = useState<string | null>(null);

  // Block Day Modal State
  const [blockDayModalOpen, setBlockDayModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('Society Holiday');
  const [blockingLoading, setBlockingLoading] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      const [
        { data: prods },
        { data: dayConfig },
        { data: extSetting },
        { data: dayBookings },
      ] = await Promise.all([
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
        supabase.from('open_days').select('*').eq('day', selectedDay).single(),
        supabase.from('settings').select('value').eq('key', 'max_extension').single(),
        supabase.from('bookings').select('*').eq('day', selectedDay).order('slot_start', { ascending: true }),
      ]);

      if (prods) setProducts(prods);
      setOpenDay(dayConfig || null);
      if (extSetting) setMaxExtension(parseInt((extSetting as any).value, 10) || 30);
      setBookings(dayBookings || []);
    } catch (err) {
      console.error('Error loading queue data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    loadData();

    // Supabase Realtime channel
    const channel = supabase
      .channel('queue-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadData();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      if (supabase && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [loadData]);

  // Status Action Handler
  const handleSetStatus = async (
    bookingId: number,
    status: 'arrived' | 'called' | 'served' | 'cancelled' | 'no_show'
  ) => {
    setActionLoadingId(bookingId);
    try {
      const res = await setBookingStatus(bookingId, status);
      if (!res.ok) {
        alert(res.error || 'Failed to update booking status');
      } else {
        await loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Error updating status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete / Dismiss Token from Queue
  const handleDeleteToken = async (bookingId: number, tokenNo: string) => {
    if (!confirm(`Permanently delete token ${tokenNo} from queue?`)) return;
    setActionLoadingId(bookingId);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) {
        alert(error.message);
      } else {
        await loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting token');
    } finally {
      setActionLoadingId(null);
    }
  };

  // "Call Next" per counter
  const handleCallNext = async (counterNo: 1 | 2) => {
    // Find next eligible booking: arrived first, or booked
    const counterList = bookings.filter((b) => b.counter === counterNo);
    const nextArrived = counterList.find((b) => b.status === 'arrived');
    const nextBooked = counterList.find((b) => b.status === 'booked');

    const target = nextArrived || nextBooked;
    if (!target) {
      alert(`No upcoming tokens waiting on Counter ${counterNo}.`);
      return;
    }

    await handleSetStatus(target.id, 'called');
  };

  // Extend Action
  const handleApplyExtension = async (minutes: number) => {
    if (!extendingBooking) return;
    setActionLoadingId(extendingBooking.id);
    setExtensionShiftAlert(null);
    try {
      const res = await extendBooking(extendingBooking.id, minutes);
      if (res.ok) {
        // Check if any booking now exceeds session end
        setExtendingBooking(null);
        await loadData();

        // Check if latest booking end exceeds session end
        if (openDay) {
          const sessionEnd = openDay.s2_end || openDay.s1_end;
          if (sessionEnd && res.counter_free_from) {
            const freeFromTime = res.counter_free_from.includes('T')
              ? res.counter_free_from.split('T')[1]
              : res.counter_free_from;
            if (freeFromTime > sessionEnd) {
              setExtensionShiftAlert(
                `Warning: Shifted bookings on Counter ${extendingBooking.counter} now extend beyond the session end (${formatSlotTime(sessionEnd)})!`
              );
            }
          }
        }
      } else {
        alert(res.error || 'Cannot extend booking');
      }
    } catch (e: any) {
      alert(e.message || 'Error extending slot');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Block Day
  const handleConfirmBlockDay = async () => {
    setBlockingLoading(true);
    try {
      const res = await blockDay(selectedDay, blockReason);
      if (res.ok) {
        setBlockDayModalOpen(false);
        alert(`Date blocked successfully. Cancelled ${res.cancelled || 0} active bookings.`);
        await loadData();
      } else {
        alert(res.error || 'Failed to block day');
      }
    } catch (e: any) {
      alert(e.message || 'Error blocking date');
    } finally {
      setBlockingLoading(false);
    }
  };

  // Filter bookings based on search
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      b.token_no.toLowerCase().includes(q) ||
      b.mobile.includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q))
    );
  });

  const counter1Bookings = filteredBookings.filter((b) => b.counter === 1);
  const counter2Bookings = filteredBookings.filter((b) => b.counter === 2);

  const getServiceNames = (productIds: number[]) => {
    return productIds
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Queue Desk Control Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Queue Desk Terminal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage arrivals, token calls, slot extensions, and counter dispatch
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden"
            />
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Token / Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 w-44 sm:w-52 focus:outline-hidden focus:ring-1 focus:ring-emerald-800"
            />
          </div>

          <button
            onClick={() => loadData()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
            title="Refresh Queue"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Block Holiday Button */}
          <button
            onClick={() => setBlockDayModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Block Date</span>
          </button>
        </div>
      </div>

      {/* Extension Shift Warning Alert */}
      {extensionShiftAlert && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-900 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-sm">Schedule Shift Notice</div>
            <div className="mt-0.5">{extensionShiftAlert}</div>
          </div>
          <button
            onClick={() => setExtensionShiftAlert(null)}
            className="text-amber-700 hover:text-amber-900 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Day Blocked Notice */}
      {openDay?.status === 'blocked' && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-2xl text-red-900 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold">
            <AlertOctagon className="w-4 h-4 text-red-700" />
            <span>This date is marked as BLOCKED ({openDay.note || 'Holiday'}). All bookings were cancelled.</span>
          </div>
        </div>
      )}

      {/* Two Counter Queue Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COUNTER 1 */}
        <div className="space-y-4">
          <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-300">Terminal</div>
              <h2 className="text-xl font-extrabold tracking-tight">Counter 1</h2>
            </div>
            <button
              onClick={() => handleCallNext(1)}
              className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition"
            >
              <Bell className="w-4 h-4" />
              <span>Call Next Token</span>
            </button>
          </div>

          <div className="space-y-3">
            {counter1Bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No active bookings matching criteria on Counter 1.
              </div>
            ) : (
              counter1Bookings.map((b) => (
                <QueueCard
                  key={b.id}
                  booking={b}
                  serviceNames={getServiceNames(b.product_ids)}
                  maxExtension={maxExtension}
                  loadingAction={actionLoadingId === b.id}
                  onStatus={handleSetStatus}
                  onOpenExtend={setExtendingBooking}
                  onDelete={handleDeleteToken}
                />
              ))
            )}
          </div>
        </div>

        {/* COUNTER 2 */}
        <div className="space-y-4">
          <div className="bg-navy-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-navy-300">Terminal</div>
              <h2 className="text-xl font-extrabold tracking-tight">Counter 2</h2>
            </div>
            <button
              onClick={() => handleCallNext(2)}
              className="flex items-center space-x-1.5 bg-sky-400 hover:bg-sky-300 text-navy-950 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition"
            >
              <Bell className="w-4 h-4" />
              <span>Call Next Token</span>
            </button>
          </div>

          <div className="space-y-3">
            {counter2Bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No active bookings matching criteria on Counter 2.
              </div>
            ) : (
              counter2Bookings.map((b) => (
                <QueueCard
                  key={b.id}
                  booking={b}
                  serviceNames={getServiceNames(b.product_ids)}
                  maxExtension={maxExtension}
                  loadingAction={actionLoadingId === b.id}
                  onStatus={handleSetStatus}
                  onOpenExtend={setExtendingBooking}
                  onDelete={handleDeleteToken}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* EXTEND TIME MODAL */}
      {extendingBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-base text-slate-900">Extend Slot Duration</h3>
              </div>
              <button
                onClick={() => setExtendingBooking(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <div>
                Token: <strong className="font-mono text-slate-900">{extendingBooking.token_no}</strong> ({extendingBooking.customer_name})
              </div>
              <div>Counter: <strong>Counter {extendingBooking.counter}</strong></div>
              <div>Current End: <strong>{formatSlotTime(extendingBooking.slot_end)}</strong></div>
              <div className="text-emerald-800">
                Already extended: <strong>{extendingBooking.extended_minutes} min</strong> / max {maxExtension} min
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Extending will automatically shift all subsequent bookings on this counter forward.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {[5, 10, 15, 30].map((mins) => {
                const disabled = extendingBooking.extended_minutes + mins > maxExtension;
                return (
                  <button
                    key={mins}
                    disabled={disabled || actionLoadingId === extendingBooking.id}
                    onClick={() => handleApplyExtension(mins)}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition ${
                      disabled
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-emerald-800/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 active:scale-95'
                    }`}
                  >
                    +{mins} Minutes
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setExtendingBooking(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK DAY MODAL */}
      {blockDayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900">Block Entire Date</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mark <strong>{formatSlotDate(selectedDay)}</strong> as blocked. All current booked slots on this date will be cancelled immediately and notifications sent to members.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Note
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Society General Holiday"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBlockDayModalOpen(false)}
                disabled={blockingLoading}
                className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlockDay}
                disabled={blockingLoading}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                {blockingLoading ? 'Blocking...' : 'Block & Cancel Slots'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Individual Queue Booking Card with Quick Action Buttons
interface QueueCardProps {
  booking: Booking;
  serviceNames: string;
  maxExtension: number;
  loadingAction: boolean;
  onStatus: (
    id: number,
    status: 'arrived' | 'called' | 'served' | 'cancelled' | 'no_show'
  ) => void;
  onOpenExtend: (b: Booking) => void;
  onDelete: (id: number, tokenNo: string) => void;
}

function QueueCard({
  booking,
  serviceNames,
  maxExtension,
  loadingAction,
  onStatus,
  onOpenExtend,
  onDelete,
}: QueueCardProps) {
  const isActionable = ['booked', 'arrived', 'called'].includes(booking.status);
  const remainingExtension = maxExtension - booking.extended_minutes;

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'booked':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Booked</span>;
      case 'arrived':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">Arrived</span>;
      case 'called':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 ring-1 ring-purple-400">Called</span>;
      case 'served':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Served</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">Cancelled ({booking.cancel_reason || 'cancelled'})</span>;
      case 'no_show':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">No-show</span>;
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-4 border transition-all ${
        booking.status === 'called'
          ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-300 shadow-sm'
          : booking.status === 'arrived'
          ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-300'
          : 'border-slate-200/80 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-extrabold text-xl text-slate-900">
            {booking.token_no}
          </span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="text-right text-[11px] text-slate-500 font-mono">
            {formatSlotTime(booking.slot_start)} - {formatSlotTime(booking.slot_end)}
          </div>
          <button
            onClick={() => onDelete(booking.id, booking.token_no)}
            disabled={loadingAction}
            className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete Token from Queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-800">{booking.customer_name || 'Member'}</span>
        <span className="font-mono text-slate-500">{booking.mobile}</span>
      </div>

      <div className="mt-1 text-xs text-emerald-800 font-medium">
        {serviceNames} ({booking.total_minutes} min)
        {booking.extended_minutes > 0 && (
          <span className="ml-2 text-amber-700 font-bold">
            +{booking.extended_minutes}m extended
          </span>
        )}
      </div>

      {/* Quick Action Toolbar (only for active tokens) */}
      {isActionable && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          {booking.status === 'booked' && (
            <button
              onClick={() => onStatus(booking.id, 'arrived')}
              disabled={loadingAction}
              className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition flex items-center space-x-1"
            >
              <span>Arrived</span>
            </button>
          )}

          {['booked', 'arrived'].includes(booking.status) && (
            <button
              onClick={() => onStatus(booking.id, 'called')}
              disabled={loadingAction}
              className="px-2.5 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold transition flex items-center space-x-1"
            >
              <span>Call</span>
            </button>
          )}

          {['arrived', 'called'].includes(booking.status) && (
            <button
              onClick={() => onStatus(booking.id, 'served')}
              disabled={loadingAction}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold transition flex items-center space-x-1"
            >
              <span>Served</span>
            </button>
          )}

          {/* Extend action */}
          <button
            onClick={() => onOpenExtend(booking)}
            disabled={loadingAction || remainingExtension <= 0}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center space-x-1 ${
              remainingExtension <= 0
                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span>Extend</span>
            <span className="text-[10px] text-slate-400">({remainingExtension}m left)</span>
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              if (confirm(`Cancel token ${booking.token_no}?`)) {
                onStatus(booking.id, 'cancelled');
              }
            }}
            disabled={loadingAction}
            className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition ml-auto"
            title="Cancel Slot"
          >
            Cancel
          </button>

          {/* No-show */}
          <button
            onClick={() => {
              if (confirm(`Mark token ${booking.token_no} as No-show?`)) {
                onStatus(booking.id, 'no_show');
              }
            }}
            disabled={loadingAction}
            className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 text-xs font-semibold transition"
            title="Mark No-show"
          >
            No-show
          </button>
        </div>
      )}
    </div>
  );
}
