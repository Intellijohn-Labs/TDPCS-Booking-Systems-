'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Layers,
  CalendarCheck,
  CalendarDays,
  Package,
  Sliders,
  Users,
  BarChart3,
  ScrollText,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface StaffNavbarProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
    role: 'staff' | 'admin';
  };
}

export default function StaffNavbar({ user }: StaffNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const operationItems = [
    { name: 'Live Monitor', href: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Queue Desk', href: '/app/queue', icon: Layers },
    { name: 'All Bookings', href: '/app/bookings', icon: CalendarCheck },
  ];

  const adminItems = [
    { name: 'Calendar & Hours', href: '/app/admin/calendar', icon: CalendarDays },
    { name: 'Services Master', href: '/app/admin/products', icon: Package },
    { name: 'Settings', href: '/app/admin/settings', icon: Sliders },
    { name: 'Accounts', href: '/app/admin/users', icon: Users },
    { name: 'Reports', href: '/app/admin/reports', icon: BarChart3 },
    { name: 'Audit Log', href: '/app/admin/audit', icon: ScrollText },
  ];

  const renderNavLink = (item: { name: string; href: string; icon: any }, onNavigate?: () => void) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          if (pathname !== item.href) setPendingHref(item.href);
          if (onNavigate) onNavigate();
        }}
        className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
          isActive
            ? 'bg-emerald-50 text-emerald-900 font-bold border-l-4 border-emerald-800 shadow-xs ring-1 ring-emerald-200/50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Icon
          className={`w-4 h-4 flex-shrink-0 transition-colors ${
            isActive ? 'text-emerald-800' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Modern Top Page Loading Progress Bar */}
      {pendingHref && (
        <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-emerald-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-indeterminate" />
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between shadow-xs">
        <Link href="/app/dashboard" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/90 shadow-xs p-0.5 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="TDPCS Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-sm leading-none block">
              TDPCS-Apt
            </span>
            <span className="text-[10px] text-slate-500 font-medium leading-none block mt-0.5">
              Thrissur Police Co-op Society
            </span>
          </div>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex">
          <div className="w-72 max-w-[85%] bg-white h-full shadow-2xl flex flex-col justify-between p-4 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/90 shadow-xs p-0.5 flex items-center justify-center flex-shrink-0">
                    <img src="/logo.png" alt="TDPCS Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 tracking-tight text-sm leading-none block">
                      TDPCS-Apt
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-0.5">
                      Thrissur Police Co-op Society
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Operations */}
              <div className="mt-4 space-y-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Operations
                </span>
                {operationItems.map((item) => renderNavLink(item, () => setMobileMenuOpen(false)))}
              </div>

              {/* Admin */}
              {user.role === 'admin' && (
                <div className="mt-5 pt-4 border-t border-slate-200 space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Administration
                  </span>
                  {adminItems.map((item) => renderNavLink(item, () => setMobileMenuOpen(false)))}
                </div>
              )}
            </div>

            {/* Profile & Logout */}
            <div className="pt-4 border-t border-slate-200 mt-6">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl mb-3">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {user.role === 'admin' ? (
                      <ShieldAlert className="w-4 h-4 text-emerald-800" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-emerald-800" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate leading-none">
                      {user.fullName}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mt-1 leading-none">
                      {user.role}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white border-r border-slate-200/90 h-screen sticky top-0 z-30 shrink-0 shadow-xs">
        {/* Top Brand & Nav */}
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand Logo & Name */}
          <div className="p-5 border-b border-slate-200/80">
            <Link href="/app/dashboard" className="flex items-center space-x-3 group">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/90 shadow-xs p-1 flex items-center justify-center flex-shrink-0 group-hover:border-emerald-300 transition">
                <img src="/logo.png" alt="TDPCS Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-slate-900 tracking-tight text-base leading-tight block">
                  TDPCS-Apt
                </span>
                <span className="text-[11px] text-slate-500 font-medium leading-tight truncate mt-0.5">
                  Thrissur Police Co-op Society
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-6 flex-1">
            {/* Operations Section */}
            <div>
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Operations
              </span>
              <div className="space-y-1">
                {operationItems.map((item) => renderNavLink(item))}
              </div>
            </div>

            {/* Admin Section */}
            {user.role === 'admin' && (
              <div>
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Administration
                </span>
                <div className="space-y-1">
                  {adminItems.map((item) => renderNavLink(item))}
                </div>
              </div>
            )}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/60">
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs mb-2.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/90 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.role === 'admin' ? (
                    <ShieldAlert className="w-4 h-4 text-emerald-800" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-emerald-800" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-none">
                    {user.fullName}
                  </p>
                  <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mt-1 leading-none">
                    {user.role}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50/80 rounded-xl transition border border-transparent hover:border-red-200"
              title="Sign Out of Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
