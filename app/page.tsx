import Link from 'next/link';
import { ShieldCheck, MessageSquare, Clock, Building2, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center text-white font-bold text-xl shadow-inner">
              T
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">TDPCS-Apt</h1>
              <p className="text-xs text-slate-500">Thrissur District Police Co-op Society</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950 px-4 py-2 rounded-lg border border-emerald-800/20 hover:bg-emerald-50 transition"
          >
            Staff & Admin Login
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>Official Token Booking System</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight max-w-2xl">
          Automated Pre-Token Counter Slot Booking
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl">
          Fast-track your branch visit. Book dedicated loan and society counter appointments
          without waiting in long queues.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-3xl w-full">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">WhatsApp Initiated</h3>
            <p className="text-xs text-slate-500">
              Members receive secure booking links directly on WhatsApp. No app download or account creation required.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Guaranteed Time</h3>
            <p className="text-xs text-slate-500">
              Dynamic multi-service duration allocation with Counter 1 and Counter 2 load balancing.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Branch Operations</h3>
            <p className="text-xs text-slate-500">
              Live queue dashboard, automated time shifts, and counter monitoring for society staff.
            </p>
          </div>
        </div>

        <div className="mt-10 bg-emerald-50 border border-emerald-200/80 rounded-2xl p-6 max-w-xl text-center">
          <h4 className="font-semibold text-emerald-950 text-sm">🧪 Testing Personas & Portals</h4>
          <p className="text-xs text-emerald-800 mt-1">
            Test concurrent booking from different member WhatsApp accounts or sign in to branch operations:
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/b/demo-user-1"
              className="inline-flex items-center space-x-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-900 font-semibold text-xs px-3 py-2 rounded-xl shadow-xs transition"
            >
              <span>👤 Member 1 (3211)</span>
            </Link>
            <Link
              href="/b/demo-user-2"
              className="inline-flex items-center space-x-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-900 font-semibold text-xs px-3 py-2 rounded-xl shadow-xs transition"
            >
              <span>👤 Member 2 (3212)</span>
            </Link>
            <Link
              href="/b/demo-user-3"
              className="inline-flex items-center space-x-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-900 font-semibold text-xs px-3 py-2 rounded-xl shadow-xs transition"
            >
              <span>👤 Member 3 (3213)</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center space-x-2 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs px-4 py-2 rounded-xl shadow transition"
            >
              <span>Staff Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Thrissur District Police Co-operative Society (TDPCS). All rights reserved.</p>
      </footer>
    </div>
  );
}
