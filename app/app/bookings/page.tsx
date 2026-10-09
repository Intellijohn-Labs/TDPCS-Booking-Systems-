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
  CalendarCheck,
  Search,
  Download,
  Filter,
  Eye,
  X,
  History,
  RotateCw,
  Clock,
  User,
  Phone,
  Layers,
  Trash2,
} from 'lucide-react';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export default function BookingsListPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(getTodayIST());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [counterFilter, setCounterFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected booking for detailed drawer/modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });
      if (prods) setProducts(prods);

      let query = supabase
        .from('bookings')
        .select('*')
        .gte('day', startDate)
        .lte('day', endDate)
        .order('slot_start', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as BookingStatus);
      }
      if (counterFilter !== 'all') {
        query = query.eq('counter', parseInt(counterFilter, 10));
      }

      const { data, error } = await query;
      if (error) console.error(error);
      else setBookings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter, counterFilter]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Client-side search and product filtering
  const filteredBookings = bookings.filter((b) => {
    if (productFilter !== 'all') {
      const prodId = parseInt(productFilter, 10);
      if (!b.product_ids.includes(prodId)) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      b.token_no.toLowerCase().includes(q) ||
      b.mobile.includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q))
    );
  });

  const getServiceNames = (productIds: number[]) => {
    return productIds
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      alert('No bookings to export.');
      return;
    }

    const headers = [
      'Token No',
      'Day',
      'Customer Name',
      'Mobile',
      'Counter',
      'Start Time',
      'End Time',
      'Duration (Mins)',
      'Extended (Mins)',
      'Status',
      'Cancel Reason',
      'Services',
      'Created At',
    ];

    const rows = filteredBookings.map((b) => [
      `"${b.token_no}"`,
      `"${b.day}"`,
      `"${b.customer_name || ''}"`,
      `"${b.mobile}"`,
      b.counter,
      `"${formatSlotTime(b.slot_start)}"`,
      `"${formatSlotTime(b.slot_end)}"`,
      b.total_minutes,
      b.extended_minutes,
      `"${b.status}"`,
      `"${b.cancel_reason || ''}"`,
      `"${getServiceNames(b.product_ids)}"`,
      `"${b.created_at}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TDPCS_Bookings_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteBooking = async (b: Booking, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      !confirm(
        `Are you sure you want to permanently delete booking "${b.token_no}" (${b.customer_name || 'Member'})?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('bookings').delete().eq('id', b.id);
      if (error) {
        alert(error.message);
      } else {
        if (selectedBooking?.id === b.id) {
          setSelectedBooking(null);
        }
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete booking');
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'booked':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Booked</span>;
      case 'arrived':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Arrived</span>;
      case 'called':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Called</span>;
      case 'served':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Served</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">Cancelled</span>;
      case 'no_show':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">No-show</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            All Appointments & Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, view complete audit history and export society booking records
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => loadData()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
            title="Reload Bookings"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="arrived">Arrived</option>
              <option value="called">Called</option>
              <option value="served">Served</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>

          {/* Counter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Counter</label>
            <select
              value={counterFilter}
              onChange={(e) => setCounterFilter(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            >
              <option value="all">All Counters</option>
              <option value="1">Counter 1</option>
              <option value="2">Counter 2</option>
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Service</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden truncate"
            >
              <option value="all">All Services</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="col-span-2 sm:col-span-1 md:col-span-1">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Token / Name / Mobile"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Compact Cards List */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading bookings...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
            No bookings found matching current filters.
          </div>
        ) : (
          filteredBookings.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedBooking(b)}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition active:scale-[0.99] cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-extrabold text-base text-emerald-900 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                    {b.token_no}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                    Counter {b.counter}
                  </span>
                </div>
                <div>{getStatusBadge(b.status)}</div>
              </div>

              <div className="flex items-start justify-between text-xs pt-0.5">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{b.customer_name || 'Member'}</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">{b.mobile}</div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold text-slate-800">{formatSlotDateShort(b.day)}</div>
                  <div className="text-emerald-800 font-mono text-[11px] font-bold">
                    {formatSlotTime(b.slot_start)} - {formatSlotTime(b.slot_end)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="truncate max-w-[170px] text-slate-600 font-medium">
                  {getServiceNames(b.product_ids)}
                </span>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="font-semibold text-slate-700 whitespace-nowrap">
                    {b.total_minutes}m {b.extended_minutes > 0 && `(+${b.extended_minutes}m)`}
                  </span>
                  <button
                    onClick={(e) => handleDeleteBooking(b, e)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Booking"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Bookings Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 whitespace-nowrap">Token</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Date & Time</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Counter</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Member Details</th>
                <th className="py-3.5 px-4">Services</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Duration</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    <span>Loading bookings...</span>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No bookings found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-slate-900 whitespace-nowrap">
                      {b.token_no}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{formatSlotDateShort(b.day)}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatSlotTime(b.slot_start)} - {formatSlotTime(b.slot_end)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">Counter {b.counter}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 whitespace-nowrap">{b.customer_name || 'Member'}</div>
                      <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{b.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-600">
                      {getServiceNames(b.product_ids)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{b.total_minutes} min</span>
                      {b.extended_minutes > 0 && (
                        <span className="text-amber-700 block text-[10px] font-bold">
                          +{b.extended_minutes}m ext
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(b.status)}</td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBooking(b);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteBooking(b, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Booking Record</span>
                <div className="flex items-center space-x-2">
                  <h3 className="text-2xl font-mono font-extrabold text-slate-900">
                    {selectedBooking.token_no}
                  </h3>
                  {getStatusBadge(selectedBooking.status)}
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedBooking.customer_name || 'Member'}
                </span>
                <span className="font-mono text-slate-600 block mt-0.5">{selectedBooking.mobile}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Desk</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  Counter {selectedBooking.counter}
                </span>
                <span className="text-slate-600 block mt-0.5">
                  Report by {formatSlotTime(selectedBooking.report_time)}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-800">{formatSlotDate(selectedBooking.day)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Slot:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {formatSlotTime(selectedBooking.slot_start)} - {formatSlotTime(selectedBooking.slot_end)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Allocated Time:</span>
                <span className="font-semibold text-slate-800">
                  {selectedBooking.total_minutes} min
                  {selectedBooking.extended_minutes > 0 && ` (+${selectedBooking.extended_minutes}m extension)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Services:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {getServiceNames(selectedBooking.product_ids)}
                </span>
              </div>
            </div>

            {/* Audit / Transition Details */}
            <div className="border-t border-slate-100 pt-3 text-xs space-y-1 text-slate-500">
              <div className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Lifecycle History</span>
              </div>
              <div>Created: {new Date(selectedBooking.created_at).toLocaleString()}</div>
              <div>Last Updated: {new Date(selectedBooking.updated_at).toLocaleString()}</div>
              {selectedBooking.cancelled_at && (
                <div className="text-red-700">
                  Cancelled: {new Date(selectedBooking.cancelled_at).toLocaleString()} (Reason:{' '}
                  {selectedBooking.cancel_reason || 'N/A'})
                </div>
              )}
              {selectedBooking.rescheduled_from && (
                <div className="text-blue-700">
                  Rescheduled from earlier Booking ID #{selectedBooking.rescheduled_from}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => handleDeleteBooking(selectedBooking)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Delete Booking</span>
              </button>
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
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
