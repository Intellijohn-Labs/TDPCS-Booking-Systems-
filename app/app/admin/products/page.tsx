'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  RotateCw,
  Save,
  X,
  Clock,
} from 'lucide-react';

type Product = Database['public']['Tables']['products']['Row'];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [sortOrder, setSortOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) console.error(error);
      else setProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setMinutes(15);
    setSortOrder((products.length ? Math.max(...products.map((p) => p.sort_order)) : 0) + 1);
    setActive(true);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setMinutes(p.minutes);
    setSortOrder(p.sort_order);
    setActive(p.active);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Service name is required.');
      return;
    }
    if (minutes <= 0) {
      setErrorMessage('Duration must be greater than 0 minutes.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            minutes,
            sort_order: sortOrder,
            active,
          } as any)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert({
          name: name.trim(),
          minutes,
          sort_order: sortOrder,
          active,
        } as any);

        if (error) throw error;
      }

      setModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving service');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: !p.active } as any)
        .eq('id', p.id);
      if (error) alert(error.message);
      else await loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reorder up/down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const currentProd = products[index];
    const targetProd = products[targetIndex];

    try {
      await Promise.all([
        supabase.from('products').update({ sort_order: targetProd.sort_order } as any).eq('id', currentProd.id),
        supabase.from('products').update({ sort_order: currentProd.sort_order } as any).eq('id', targetProd.id),
      ]);
      await loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Safe delete or deactivate if bookings exist
  const handleDeleteProduct = async (p: Product) => {
    // Check if bookings reference this product
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id')
      .contains('product_ids', [p.id])
      .limit(1);

    if (existingBookings && existingBookings.length > 0) {
      if (
        confirm(
          `Service "${p.name}" is already used in existing member bookings. Deleting would corrupt audit records. Do you want to DEACTIVATE it instead?`
        )
      ) {
        await supabase.from('products').update({ active: false } as any).eq('id', p.id);
        await loadProducts();
      }
      return;
    }

    if (confirm(`Are you sure you want to delete service "${p.name}"?`)) {
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) alert(error.message);
      else await loadProducts();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Services & Products Master
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure loan schemes, service durations, display ordering and availability
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
          </button>
          <button
            onClick={() => loadProducts()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Compact Service Cards */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading services...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
            No services configured yet.
          </div>
        ) : (
          products.map((p, idx) => (
            <div
              key={p.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-slate-400">#{p.sort_order}</span>
                  <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                </div>
                <button
                  onClick={() => handleToggleActive(p)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                    p.active
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {p.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg text-xs">
                  {p.minutes} minutes
                </span>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === products.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 text-slate-600 hover:text-emerald-800 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg transition"
                    title="Edit Service"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p)}
                    className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 rounded-lg transition"
                    title="Delete Service"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Products Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-16 whitespace-nowrap">Order</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Service Name</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Duration</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Reorder</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    <span>Loading services...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No services configured yet.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400 whitespace-nowrap">
                      #{p.sort_order}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {p.minutes} minutes
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                          p.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveOrder(idx, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === products.length - 1}
                        onClick={() => handleMoveOrder(idx, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingId ? 'Edit Service' : 'Add New Service'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gold Loan Renewal"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 5)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  min="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 1)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="activeCheck" className="font-semibold text-slate-700 cursor-pointer">
                  Active (available for member booking)
                </label>
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
                  {saving ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
