'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import {
  formatSlotDateShort,
  getTodayIST,
} from '@/lib/date-utils';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  RotateCw,
  PieChart as PieIcon,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });

type Booking = Database['public']['Tables']['bookings']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export default function AdminReportsPage() {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(getTodayIST());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: prods }, { data: bookingsData }] = await Promise.all([
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('bookings')
          .select('*')
          .gte('day', startDate)
          .lte('day', endDate)
          .order('day', { ascending: true }),
      ]);

      if (prods) setProducts(prods);
      setBookings(bookingsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate 1: Bookings per day
  const dailyDataMap: Record<string, { day: string; booked: number; served: number; cancelled: number; no_show: number }> = {};
  bookings.forEach((b) => {
    if (!dailyDataMap[b.day]) {
      dailyDataMap[b.day] = { day: b.day, booked: 0, served: 0, cancelled: 0, no_show: 0 };
    }
    if (b.status === 'served') dailyDataMap[b.day].served++;
    else if (b.status === 'cancelled') dailyDataMap[b.day].cancelled++;
    else if (b.status === 'no_show') dailyDataMap[b.day].no_show++;
    else dailyDataMap[b.day].booked++;
  });
  const dailyChartData = Object.values(dailyDataMap).sort((a, b) => a.day.localeCompare(b.day));

  // Aggregate 2: Bookings by service
  const serviceCountMap: Record<number, number> = {};
  bookings.forEach((b) => {
    b.product_ids.forEach((pid) => {
      serviceCountMap[pid] = (serviceCountMap[pid] || 0) + 1;
    });
  });
  const serviceChartData = products.map((p) => ({
    name: p.name,
    count: serviceCountMap[p.id] || 0,
  }));

  // Aggregate 3: Peak hours distribution (10:00 - 15:00)
  const hourlyMap: Record<string, number> = {};
  bookings.forEach((b) => {
    try {
      const timePart = b.slot_start.includes('T') ? b.slot_start.split('T')[1] : b.slot_start;
      const hour = timePart.split(':')[0];
      const hourLabel = `${hour}:00`;
      hourlyMap[hourLabel] = (hourlyMap[hourLabel] || 0) + 1;
    } catch {
      // ignore
    }
  });
  const hourlyChartData = Object.keys(hourlyMap)
    .sort()
    .map((h) => ({ hour: h, bookings: hourlyMap[h] }));

  // Aggregate 4: Counter distribution
  const c1Count = bookings.filter((b) => b.counter === 1).length;
  const c2Count = bookings.filter((b) => b.counter === 2).length;
  const counterChartData = [
    { name: 'Counter 1', count: c1Count },
    { name: 'Counter 2', count: c2Count },
  ];

  // Totals & Rates
  const totalBookings = bookings.length;
  const servedCount = bookings.filter((b) => b.status === 'served').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
  const noShowCount = bookings.filter((b) => b.status === 'no_show').length;

  const cancellationRate = totalBookings > 0 ? ((cancelledCount / totalBookings) * 100).toFixed(1) : '0';
  const noShowRate = totalBookings > 0 ? ((noShowCount / totalBookings) * 100).toFixed(1) : '0';

  // Export CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) return;
    const headers = ['Day', 'Token', 'Counter', 'Customer Name', 'Mobile', 'Status', 'Duration Mins'];
    const rows = bookings.map((b) => [
      b.day,
      b.token_no,
      b.counter,
      `"${b.customer_name || ''}"`,
      b.mobile,
      b.status,
      b.total_minutes,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `TDPCS_Report_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Reports & Performance Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Society counter utilisation, hourly peak patterns, and attendance rate statistics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 text-xs no-print">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Date Range:</span>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
          />
        </div>
        <button
          onClick={() => loadData()}
          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition ml-auto"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Volume</span>
          <span className="text-2xl font-extrabold text-slate-900 block mt-1">{totalBookings}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Pre-token bookings</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">Served Members</span>
          <span className="text-2xl font-extrabold text-emerald-800 block mt-1">{servedCount}</span>
          <span className="text-[11px] text-emerald-700 mt-0.5 block">Completed at counter</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Cancellation Rate</span>
          <span className="text-2xl font-extrabold text-slate-700 block mt-1">{cancellationRate}%</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{cancelledCount} cancelled</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-red-500 block">No-Show Rate</span>
          <span className="text-2xl font-extrabold text-red-700 block mt-1">{noShowRate}%</span>
          <span className="text-[11px] text-red-600 mt-0.5 block">{noShowCount} unattended</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Bookings */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-800" />
            <h3 className="font-bold text-sm text-slate-900">Daily Bookings Breakdown</h3>
          </div>
          <div className="h-64 w-full text-xs">
            {dailyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                No data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => formatSlotDateShort(v)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="served" name="Served" fill="#15803d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="booked" name="Booked" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="no_show" name="No-show" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Bookings by Service */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-800" />
            <h3 className="font-bold text-sm text-slate-900">Demand by Loan & Service</h3>
          </div>
          <div className="h-64 w-full text-xs">
            {serviceChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                No data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Appointments" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Peak Hours Heatmap / Hourly distribution */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-800" />
            <h3 className="font-bold text-sm text-slate-900">Peak Hours Slot Distribution</h3>
          </div>
          <div className="h-64 w-full text-xs">
            {hourlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                No data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="bookings" name="Bookings" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Counter Load Balance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <Layers className="w-4 h-4 text-emerald-800" />
            <h3 className="font-bold text-sm text-slate-900">Counter Load Balancing</h3>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={counterChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Allocated Slots" fill="#4338ca" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Daily Attendance Breakdown</h3>
          <span className="text-xs text-slate-400">Aggregated by date</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Served</th>
                <th className="py-3 px-4 whitespace-nowrap">Pending/Booked</th>
                <th className="py-3 px-4 whitespace-nowrap">Cancelled</th>
                <th className="py-3 px-4 whitespace-nowrap">No-Show</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Daily Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyChartData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                dailyChartData.map((row) => (
                  <tr key={row.day} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">{formatSlotDateShort(row.day)}</td>
                    <td className="py-3 px-4 text-emerald-700 font-bold whitespace-nowrap">{row.served}</td>
                    <td className="py-3 px-4 text-blue-700 whitespace-nowrap">{row.booked}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{row.cancelled}</td>
                    <td className="py-3 px-4 text-red-600 font-semibold whitespace-nowrap">{row.no_show}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {row.served + row.booked + row.cancelled + row.no_show}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
