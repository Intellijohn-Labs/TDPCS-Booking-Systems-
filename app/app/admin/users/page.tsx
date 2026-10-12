'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, UserRole } from '@/types/database';
import {
  Users,
  UserPlus,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  RotateCw,
  X,
  CheckCircle2,
  AlertCircle,
  UserX,
  UserCheck,
  Trash2,
} from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [savingUser, setSavingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete User Modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const supabase = createClient();

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      else setProfiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user?.id) setCurrentUserId(data.user.id);
    });
    loadProfiles();
  }, [loadProfiles]);

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeletingUser(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-user',
          userId: deleteConfirmUser.id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setDeleteConfirmUser(null);
      await loadProfiles();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting user');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user',
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setCreateModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      await loadProfiles();
    } catch (err: any) {
      setCreateError(err.message || 'Error creating user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setResettingPassword(true);
    setResetError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userId: targetUser.id,
          newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetModalOpen(false);
      setNewPassword('');
      alert(`Password updated successfully for ${targetUser.full_name}.`);
    } catch (err: any) {
      setResetError(err.message || 'Error resetting password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleActive = async (p: Profile) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-active',
          userId: p.id,
          active: !p.active,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to update user status');
      }

      await loadProfiles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff & Admin Accounts
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage terminal operator logins, society administrators, and account credentials
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Staff Account</span>
          </button>
          <button
            onClick={() => loadProfiles()}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Compact User Cards */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading staff profiles...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
            No accounts found.
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${p.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {p.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-sm block truncate">{p.full_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      p.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.role}
                  </span>
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                      p.active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {p.active ? 'Active' : 'Deactivated'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setTargetUser(p);
                    setResetError(null);
                    setResetModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Password</span>
                </button>
                {p.id !== currentUserId && (
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmUser(p);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Profiles Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 whitespace-nowrap">Full Name</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Role</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Registered Date</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    <span>Loading staff profiles...</span>
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No accounts found.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {p.role === 'admin' ? (
                          <ShieldAlert className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        )}
                        <span>{p.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.role === 'admin'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                          p.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {p.active ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setTargetUser(p);
                          setResetError(null);
                          setResetModalOpen(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                        title="Reset Password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {p.id !== currentUserId && (
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteConfirmUser(p);
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Create Staff / Admin Account</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Anand Kumar"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@tdpcs.coop"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-hidden"
                >
                  <option value="staff">Staff (Queue Desk & Live Monitor)</option>
                  <option value="admin">Admin (Full System & Master Settings)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="py-2.5 px-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {savingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                Reset Password for {targetUser.full_name}
              </h3>
              <button
                onClick={() => setResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="py-2.5 px-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {resettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900">Delete User Account</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently remove{' '}
                <strong className="text-slate-900">{deleteConfirmUser.full_name}</strong>?
                This will delete their profile and authentication credentials immediately.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-center">
                {deleteError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deletingUser}
                className="py-2.5 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
              >
                {deletingUser ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
