'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, BookingStatus } from '@/types/database';
import {
  formatSlotTime,
  formatSlotDate,
  formatSlotDateShort,
  getTodayIST,
} from '@/lib/date-utils';
import {
  Calendar,
  Clock,
  RotateCw,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PlayCircle,
  Phone,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type OpenDay = Database['public']['Tables']['open_days']['Row'];

export default function DashboardPage() {
  const [selectedDay, setSelectedDay] = useState<string>(getTodayIST());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openDay, setOpenDay] = useState<OpenDay | null>(null);
  const [upcomingStats, setUpcomingStats] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      // 1. Load products
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });
      if (prods) setProducts(prods);

      // 2. Load open day config for selected day
      const { data: dayConfig } = await supabase
        .from('open_days')
        .select('*')
        .eq('day', selectedDay)
        .single();
      setOpenDay((dayConfig as unknown as OpenDay) || null);

      // 3. Load bookings for selected day
      const { data: dayBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('day', selectedDay)
        .order('slot_start', { ascending: true });
      setBookings(dayBookings || []);

      // 4. Load upcoming 7 days stats
      const today = getTodayIST();
      const { data: upBookings } = await supabase
        .from('bookings')
        .select('day')
        .gte('day', today)
        .in('status', ['booked', 'arrived', 'called', 'served']);

      if (upBookings) {
        const countsByDay: Record<string, number> = {};
        upBookings.forEach((b: any) => {
          countsByDay[b.day] = (countsByDay[b.day] || 0) + 1;
        });

        const statsArray = Object.keys(countsByDay)
          .sort()
          .slice(0, 7)
          .map((d) => ({ day: d, count: countsByDay[d] }));
        setUpcomingStats(statsArray);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    loadData();

    // Setup Supabase Realtime subscription
    const channel = supabase
      .channel('dashboard-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Fallback polling every 15 seconds
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

  // KPIs calculation
  const totalBooked = bookings.filter((b) => b.status === 'booked').length;
  const totalArrived = bookings.filter((b) => b.status === 'arrived').length;
  const totalCalled = bookings.filter((b) => b.status === 'called').length;
  const totalServed = bookings.filter((b) => b.status === 'served').length;
  const totalCancelled = bookings.filter((b) => b.status === 'cancelled').length;
  const totalNoShow = bookings.filter((b) => b.status === 'no_show').length;

  // Split bookings by Counter
  const counter1Bookings = bookings.filter((b) => b.counter === 1);
  const counter2Bookings = bookings.filter((b) => b.counter === 2);

  // Counter session minutes calculation
  const getSessionMinutes = () => {
    if (!openDay) return 240; // fallback 4 hours default
    let minutes = 0;
    if (openDay.s1_start && openDay.s1_end) {
      const [h1, m1] = openDay.s1_start.split(':').map(Number);
      const [h2, m2] = openDay.s1_end.split(':').map(Number);
      minutes += (h2 * 60 + m2) - (h1 * 60 + m1);
    }
    if (openDay.s2_start && openDay.s2_end) {
      const [h1, m1] = openDay.s2_start.split(':').map(Number);
      const [h2, m2] = openDay.s2_end.split(':').map(Number);
      minutes += (h2 * 60 + m2) - (h1 * 60 + m1);
    }
    return minutes > 0 ? minutes : 240;
  };

  const totalSessionMins = getSessionMinutes();
  const c1OccupiedMins = counter1Bookings
    .filter((b) => ['booked', 'arrived', 'called', 'served'].includes(b.status))
    .reduce((sum, b) => sum + b.total_minutes + b.extended_minutes, 0);
  const c2OccupiedMins = counter2Bookings
    .filter((b) => ['booked', 'arrived', 'called', 'served'].includes(b.status))
    .reduce((sum, b) => sum + b.total_minutes + b.extended_minutes, 0);

  const c1UtilPercent = Math.min(100, Math.round((c1OccupiedMins / totalSessionMins) * 100));
  const c2UtilPercent = Math.min(100, Math.round((c2OccupiedMins / totalSessionMins) * 100));

  // Determine current in-progress & next upcoming booking per counter
  const getBookingHighlights = (list: Booking[]) => {
    // Current in progress is either called/arrived or first active booking around current time
    const inProgress = list.find((b) => ['called', 'arrived'].includes(b.status));
    const nextBooking = list.find(
      (b) => b.status === 'booked' && (!inProgress || b.id !== inProgress.id)
    );
    return { inProgressId: inProgress?.id, nextBookingId: nextBooking?.id };
  };

  const c1Highlights = getBookingHighlights(counter1Bookings);
  const c2Highlights = getBookingHighlights(counter2Bookings);

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'booked':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Booked</span>;
      case 'arrived':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">Arrived</span>;
      case 'called':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 ring-1 ring-purple-400">Called</span>;
      case 'served':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Served</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">Cancelled</span>;
      case 'no_show':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">No-show</span>;
    }
  };

  const getServiceNames = (productIds: number[]) => {
    return productIds
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Date Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Live Queue Monitor
            </h1>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Realtime counter status and daily throughput for {formatSlotDate(selectedDay)}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden"
            />
          </div>

          <button
            onClick={() => loadData()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold rounded-xl transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Upcoming Days Booking Strip */}
      {upcomingStats.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 mb-2 px-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            <span>Upcoming Days Pre-Bookings Overview</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {upcomingStats.map((item) => (
              <button
                key={item.day}
                onClick={() => setSelectedDay(item.day)}
                className={`p-2 rounded-xl text-center border transition ${
                  selectedDay === item.day
                    ? 'border-emerald-800 bg-emerald-50 ring-1 ring-emerald-800'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-semibold text-slate-500">
                  {formatSlotDateShort(item.day)}
                </div>
                <div className="text-sm font-extrabold text-emerald-900 mt-0.5">
                  {item.count} booked
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Booked</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalBooked}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Arrived</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalArrived}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Called</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalCalled}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Served</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalServed}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cancelled</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalCancelled}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">No-Show</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalNoShow}</div>
        </div>
      </div>

      {/* Two Counter Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COUNTER 1 */}
        <div className="space-y-4">
          {/* Counter 1 Header & Utilisation */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Counter 1</h2>
                <p className="text-xs text-slate-500">Loan & Society Operations Desk</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-emerald-800">{c1UtilPercent}%</span>
                <span className="text-[10px] text-slate-400 block">Utilisation</span>
              </div>
            </div>

            <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  c1UtilPercent > 90 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${c1UtilPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Booked: {c1OccupiedMins} min</span>
              <span>Free Time: {Math.max(0, totalSessionMins - c1OccupiedMins)} min remaining</span>
            </div>
          </div>

          {/* Bookings List Counter 1 */}
          <div className="space-y-3">
            {counter1Bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No bookings scheduled on Counter 1 for this date.
              </div>
            ) : (
              counter1Bookings.map((b) => {
                const isInProgress = b.id === c1Highlights.inProgressId;
                const isNext = b.id === c1Highlights.nextBookingId;
                return (
                  <div
                    key={b.id}
                    className={`bg-white rounded-2xl p-4 border transition-all ${
                      isInProgress
                        ? 'border-emerald-700 bg-emerald-50/50 ring-2 ring-emerald-600 shadow-md'
                        : isNext
                        ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-400'
                        : 'border-slate-200/80 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-extrabold text-lg text-slate-900">
                          {b.token_no}
                        </span>
                        {isInProgress && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-800 text-white animate-pulse">
                            ● In Progress
                          </span>
                        )}
                        {isNext && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            Next Up
                          </span>
                        )}
                      </div>
                      <div>{getStatusBadge(b.status)}</div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{b.customer_name || 'Member'}</span>
                      <span className="font-mono text-slate-500">{b.mobile}</span>
                    </div>

                    <div className="mt-1 text-xs text-emerald-900 font-medium">
                      {getServiceNames(b.product_ids)}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatSlotTime(b.slot_start)} - {formatSlotTime(b.slot_end)}
                        </span>
                        {b.extended_minutes > 0 && (
                          <span className="text-amber-700 font-bold">
                            (+{b.extended_minutes}m extended)
                          </span>
                        )}
                      </div>
                      <span>Report: {formatSlotTime(b.report_time)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COUNTER 2 */}
        <div className="space-y-4">
          {/* Counter 2 Header & Utilisation */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Counter 2</h2>
                <p className="text-xs text-slate-500">Credit & Scheme Services Desk</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-emerald-800">{c2UtilPercent}%</span>
                <span className="text-[10px] text-slate-400 block">Utilisation</span>
              </div>
            </div>

            <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  c2UtilPercent > 90 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${c2UtilPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Booked: {c2OccupiedMins} min</span>
              <span>Free Time: {Math.max(0, totalSessionMins - c2OccupiedMins)} min remaining</span>
            </div>
          </div>

          {/* Bookings List Counter 2 */}
          <div className="space-y-3">
            {counter2Bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No bookings scheduled on Counter 2 for this date.
              </div>
            ) : (
              counter2Bookings.map((b) => {
                const isInProgress = b.id === c2Highlights.inProgressId;
                const isNext = b.id === c2Highlights.nextBookingId;
                return (
                  <div
                    key={b.id}
                    className={`bg-white rounded-2xl p-4 border transition-all ${
                      isInProgress
                        ? 'border-emerald-700 bg-emerald-50/50 ring-2 ring-emerald-600 shadow-md'
                        : isNext
                        ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-400'
                        : 'border-slate-200/80 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-extrabold text-lg text-slate-900">
                          {b.token_no}
                        </span>
                        {isInProgress && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-800 text-white animate-pulse">
                            ● In Progress
                          </span>
                        )}
                        {isNext && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            Next Up
                          </span>
                        )}
                      </div>
                      <div>{getStatusBadge(b.status)}</div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{b.customer_name || 'Member'}</span>
                      <span className="font-mono text-slate-500">{b.mobile}</span>
                    </div>

                    <div className="mt-1 text-xs text-emerald-900 font-medium">
                      {getServiceNames(b.product_ids)}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatSlotTime(b.slot_start)} - {formatSlotTime(b.slot_end)}
                        </span>
                        {b.extended_minutes > 0 && (
                          <span className="text-amber-700 font-bold">
                            (+{b.extended_minutes}m extended)
                          </span>
                        )}
                      </div>
                      <span>Report: {formatSlotTime(b.report_time)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
