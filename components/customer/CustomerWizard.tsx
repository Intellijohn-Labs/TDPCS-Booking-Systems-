'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  fetchCustomerInit,
  fetchCustomerSlots,
  submitCustomerBook,
  submitCustomerCancel,
  submitCustomerReschedule,
} from '@/lib/customer-api';
import {
  CustomerInitResponse,
  CustomerOpenDay,
  CustomerProduct,
  CustomerExistingBooking,
  CustomerBookResponse,
  SlotSeatInfo,
} from '@/types/database';
import {
  formatSlotTime,
  formatSlotDate,
  formatSlotDateShort,
  formatSlotRange,
  addMinutesToTimestamp,
} from '@/lib/date-utils';
import { getStrings } from '@/lib/i18n';
import CustomerDatePicker from './CustomerDatePicker';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  User,
  Phone,
  BookmarkCheck,
  AlertTriangle,
  XCircle,
  Building2,
  Lock,
  FileText,
} from 'lucide-react';

interface CustomerWizardProps {
  token: string;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'manage' | 'reschedule';

export default function CustomerWizard({ token }: CustomerWizardProps) {
  const strings = getStrings('en').customer;
  const [loadingInit, setLoadingInit] = useState(true);
  const [initData, setInitData] = useState<CustomerInitResponse | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [customerName, setCustomerName] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [allSlotSeats, setAllSlotSeats] = useState<SlotSeatInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string>('');

  // Booking submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<CustomerBookResponse | null>(null);

  // Manage / Reschedule state
  const [bookingToCancel, setBookingToCancel] = useState<CustomerExistingBooking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const [bookingToReschedule, setBookingToReschedule] = useState<CustomerExistingBooking | null>(null);
  const [rescheduleDay, setRescheduleDay] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleAllSlotSeats, setRescheduleAllSlotSeats] = useState<SlotSeatInfo[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [rescheduleNewStart, setRescheduleNewStart] = useState<string>('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSuccessMsg, setRescheduleSuccessMsg] = useState<string | null>(null);

  // Initial load
  const loadInitData = async () => {
    setLoadingInit(true);
    setInitError(null);
    try {
      const res = await fetchCustomerInit(token);
      if (!res.ok) {
        setInitError(res.error || 'link_expired');
      } else {
        setInitData(res);
        if (res.last_name) {
          setCustomerName(res.last_name);
        }
        if (res.purpose === 'manage') {
          setStep('manage');
        } else {
          setStep(1);
        }
      }
    } catch {
      setInitError('network_error');
    } finally {
      setLoadingInit(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadInitData();
    }
  }, [token]);

  // Total duration in minutes of selected products
  const totalMinutes = selectedProductIds.reduce((sum, id) => {
    const prod = initData?.products?.find((p) => p.id === id);
    return sum + (prod ? prod.minutes : 0);
  }, 0);

  // Fetch slots when day or selectedProductIds change
  const loadSlots = async (dayStr: string, prodIds: number[]) => {
    if (!dayStr || prodIds.length === 0) return;
    setLoadingSlots(true);
    setSubmitError(null);
    try {
      const res = await fetchCustomerSlots(token, dayStr, prodIds);
      if (res.ok) {
        setAvailableSlots(res.slots || []);
        setAllSlotSeats(res.all_slots || []);
      } else {
        setAvailableSlots([]);
        setAllSlotSeats([]);
        if (res.error === 'link_expired') {
          setInitError('link_expired');
        }
      }
    } catch {
      setAvailableSlots([]);
      setAllSlotSeats([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDaySelect = (day: string) => {
    setSelectedDay(day);
    setSelectedSlotStart('');
    setAllSlotSeats([]);
  };

  const toggleProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    setSelectedSlotStart('');
    setAllSlotSeats([]);
  };

  // Screen 4 slots loading trigger
  const goToTimeStep = () => {
    if (selectedProductIds.length === 0) return;
    setStep(4);
    loadSlots(selectedDay, selectedProductIds);
  };

  // Submit booking
  const handleConfirmBooking = async () => {
    if (!customerName.trim() || !selectedSlotStart || selectedProductIds.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitCustomerBook(token, customerName.trim(), selectedSlotStart, selectedProductIds);
      if (res.ok) {
        setSuccessBooking(res);
        setStep(6); // Success screen
      } else {
        if (res.error === 'slot_taken') {
          setSubmitError(strings.slotTaken);
          setStep(4);
          loadSlots(selectedDay, selectedProductIds);
        } else if (res.error === 'already_booked') {
          setSubmitError(strings.alreadyBooked);
        } else if (res.error === 'link_expired') {
          setInitError('link_expired');
        } else {
          setSubmitError(res.error || 'Booking failed');
        }
      }
    } catch (e: any) {
      setSubmitError(e.message || 'Error completing booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel in My Bookings
  const handleExecuteCancel = async () => {
    if (!bookingToCancel) return;
    setCancelLoading(true);
    try {
      const res = await submitCustomerCancel(token, bookingToCancel.id);
      if (res.ok) {
        setCancelFeedback(strings.cancelSuccess);
        setBookingToCancel(null);
        await loadInitData();
      } else {
        alert(res.error || 'Failed to cancel booking');
      }
    } catch (e: any) {
      alert(e.message || 'Cancellation error');
    } finally {
      setCancelLoading(false);
    }
  };

  // Prepare Reschedule
  const startReschedule = (b: CustomerExistingBooking) => {
    setBookingToReschedule(b);
    setRescheduleDay('');
    setRescheduleNewStart('');
    setRescheduleError(null);
    setStep('reschedule');
  };

  const loadRescheduleSlotsForDay = async (dayStr: string) => {
    if (!bookingToReschedule) return;
    setRescheduleDay(dayStr);
    setRescheduleNewStart('');
    setLoadingRescheduleSlots(true);
    try {
      const res = await fetchCustomerSlots(token, dayStr, bookingToReschedule.product_ids);
      if (res.ok) {
        setRescheduleSlots(res.slots || []);
        setRescheduleAllSlotSeats(res.all_slots || []);
      } else {
        setRescheduleSlots([]);
        setRescheduleAllSlotSeats([]);
      }
    } catch {
      setRescheduleSlots([]);
      setRescheduleAllSlotSeats([]);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!bookingToReschedule || !rescheduleNewStart) return;
    setRescheduleSubmitting(true);
    setRescheduleError(null);
    try {
      const res = await submitCustomerReschedule(token, bookingToReschedule.id, rescheduleNewStart);
      if (res.ok) {
        setRescheduleSuccessMsg(
          strings.rescheduleSuccess.replace('{token}', res.token || '')
        );
        setBookingToReschedule(null);
        await loadInitData();
        setStep('manage');
      } else {
        if (res.error === 'slot_taken') {
          setRescheduleError(strings.rescheduleError);
          // reload slots
          if (rescheduleDay) loadRescheduleSlotsForDay(rescheduleDay);
        } else {
          setRescheduleError(res.error || 'Slot change failed');
        }
      }
    } catch (e: any) {
      setRescheduleError(e.message || 'Error changing slot');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const isDemoToken = Boolean(token && (token.startsWith('demo-') || token.startsWith('test-') || token.includes('demo')));

  // Render Header
  const renderHeader = () => (
    <>
      <header className="bg-white border-b border-slate-200 py-3.5 px-4 sticky top-0 z-20 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-xs p-1 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="TDPCS Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                TDPCS Counter Token
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Thrissur Police Co-op Society</p>
            </div>
          </div>
          {initData?.mobile_masked && (
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">WhatsApp</span>
              <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                {initData.mobile_masked}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Interactive Test Persona Switcher Bar */}
      {isDemoToken && (
        <div className="bg-emerald-900 border-b border-emerald-950 text-white text-xs py-2 px-3 shadow-inner">
          <div className="max-w-md mx-auto flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="bg-emerald-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded tracking-wide uppercase">
                TEST PERSONA
              </span>
              <span className="text-emerald-100 text-[11px] font-mono">
                {initData?.mobile_masked ? initData.mobile_masked : 'Member'}
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <span className="text-[10px] text-emerald-300">Switch:</span>
              {[1, 2, 3, 4].map((num) => {
                const personaToken = `demo-user-${num}`;
                const isCurrent = token === personaToken || (num === 1 && token === 'demo-booking-token');
                return (
                  <a
                    key={num}
                    href={`/b/${personaToken}`}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      isCurrent
                        ? 'bg-white text-emerald-900 font-bold shadow-xs'
                        : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700'
                    }`}
                  >
                    Person {num}
                  </a>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const freshToken = `demo-user-${Math.floor(1000 + Math.random() * 9000)}`;
                  window.location.href = `/b/${freshToken}`;
                }}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition"
                title="Create a fresh test member"
              >
                + New
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Expired / Error View
  if (loadingInit) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-3 border-emerald-800 border-t-transparent animate-spin mb-4" />
        <h2 className="text-base font-semibold text-slate-800">Verifying Booking Link</h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to society counter system...</p>
      </div>
    );
  }

  if (initError) {
    const isExpired = initError === 'link_expired';
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        {renderHeader()}
        <main className="max-w-md mx-auto w-full px-5 py-10 flex-1 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-5">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isExpired ? strings.expiredTitle : 'Unable to Load Session'}
          </h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {isExpired
              ? strings.expiredMessage
              : 'There was an issue connecting to your booking session. Please try refreshing or check your connection.'}
          </p>

          {!isExpired && (
            <button
              onClick={() => loadInitData()}
              className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          )}

          <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 text-left w-full space-y-2">
            <div className="font-semibold text-slate-700">Security Notice</div>
            <p>
              Pre-token booking links are time-limited for member safety and prevent automated bot access.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Calculate end time for chosen slot without timezone drift
  const calculatedEndTime = () => {
    if (!selectedSlotStart || totalMinutes === 0) return '';
    try {
      return addMinutesToTimestamp(selectedSlotStart, totalMinutes);
    } catch {
      return '';
    }
  };

  // Group theater seats into morning (10:00–13:00) and afternoon (14:00–17:00)
  const morningSeats = allSlotSeats.filter((seat) => {
    const timePart = seat.slot_start.includes('T') ? seat.slot_start.split('T')[1] : seat.slot_start;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour < 13;
  });

  const afternoonSeats = allSlotSeats.filter((seat) => {
    const timePart = seat.slot_start.includes('T') ? seat.slot_start.split('T')[1] : seat.slot_start;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour >= 13;
  });

  const rescheduleMorningSeats = rescheduleAllSlotSeats.filter((seat) => {
    const timePart = seat.slot_start.includes('T') ? seat.slot_start.split('T')[1] : seat.slot_start;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour < 13;
  });

  const rescheduleAfternoonSeats = rescheduleAllSlotSeats.filter((seat) => {
    const timePart = seat.slot_start.includes('T') ? seat.slot_start.split('T')[1] : seat.slot_start;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour >= 13;
  });

  // Fallback simple slot groups
  const morningSlots = availableSlots.filter((slot) => {
    const timePart = slot.includes('T') ? slot.split('T')[1] : slot;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour < 13;
  });

  const afternoonSlots = availableSlots.filter((slot) => {
    const timePart = slot.includes('T') ? slot.split('T')[1] : slot;
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour >= 13;
  });

  // Reusable Theater Seat Item Card
  const renderSlotSeatItem = (
    seat: SlotSeatInfo,
    isSelected: boolean,
    onSelect: (start: string) => void,
    duration: number
  ) => {
    const isBooked = seat.status === 'booked';
    const isPast = seat.status === 'past';
    const isPartial = seat.status === 'partial';
    const isClickable = !isBooked && !isPast;

    return (
      <button
        key={seat.slot_start}
        type="button"
        disabled={!isClickable}
        onClick={() => {
          if (isClickable) onSelect(seat.slot_start);
        }}
        className={`w-full min-h-[64px] py-2.5 px-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
          isBooked
            ? 'bg-slate-100/90 border-slate-300/90 cursor-not-allowed opacity-80'
            : isPast
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
            : isSelected
            ? 'bg-emerald-800 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600 scale-[1.01]'
            : isPartial
            ? 'bg-white border-amber-300/90 hover:border-emerald-700 hover:bg-emerald-50/20 active:scale-[0.99] shadow-xs'
            : 'bg-white border-slate-200 hover:border-emerald-700 hover:shadow-xs active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span
            className={`font-bold text-xs tracking-tight ${
              isBooked
                ? 'line-through text-slate-400'
                : isPast
                ? 'line-through text-slate-400'
                : isSelected
                ? 'text-white'
                : 'text-slate-900'
            }`}
          >
            {formatSlotTime(seat.slot_start)} – {formatSlotTime(seat.slot_end)}
          </span>

          {isBooked ? (
            <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-md">
              <Lock className="w-2.5 h-2.5 mr-0.5" /> Already Booked
            </span>
          ) : isPast ? (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-md">
              Passed
            </span>
          ) : isSelected ? (
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-100 bg-emerald-900/70 px-1.5 py-0.5 rounded-md">
              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Selected
            </span>
          ) : isPartial ? (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
              1 Counter Left
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              Available
            </span>
          )}
        </div>

        <div className="flex items-center justify-between w-full mt-1.5 text-[10px]">
          <span className={isSelected ? 'text-emerald-100 font-medium' : 'text-slate-500'}>
            {duration} min continuous
          </span>
          <span
            className={`font-medium ${
              isBooked
                ? 'text-red-500 font-semibold'
                : isPast
                ? 'text-slate-400'
                : isSelected
                ? 'text-emerald-200'
                : isPartial
                ? 'text-amber-700 font-semibold'
                : 'text-emerald-600 font-semibold'
            }`}
          >
            {isBooked
              ? 'Both Counters Taken'
              : isPast
              ? 'Expired'
              : isSelected
              ? 'Your Slot'
              : isPartial
              ? 'Counter 2 Open'
              : '2 Counters Open'}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between antialiased">
      {renderHeader()}

      <main className="max-w-md mx-auto w-full px-4 pt-4 pb-28 flex-1">
        {/* Navigation Step Indicator (Only for Step 1-5) */}
        {typeof step === 'number' && step >= 1 && step <= 5 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span className="text-emerald-800">
                {strings.step} {step} {strings.of} 5
              </span>
              <span>
                {step === 1 && 'Personal Info'}
                {step === 2 && 'Choose Date'}
                {step === 3 && 'Services'}
                {step === 4 && 'Choose Time'}
                {step === 5 && 'Review & Confirm'}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-full flex-1 transition-all duration-300 ${
                    s <= step ? 'bg-emerald-800' : 'bg-transparent'
                  } ${s !== 5 ? 'border-r border-white' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2.5 text-red-700 text-sm">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{submitError}</div>
            </div>
            {submitError.includes('already have an active booking') && (
              <div className="pt-2.5 border-t border-red-200 text-xs text-red-900 space-y-2">
                <p className="font-medium text-[11px] text-red-800">
                  💡 This WhatsApp member already has a booking on this date. In real use, each member has their own phone. Switch test persona to book another slot:
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4].map((num) => (
                    <a
                      key={num}
                      href={`/b/demo-user-${num}`}
                      className="px-2.5 py-1 bg-white border border-red-300 hover:bg-red-50 rounded-lg text-red-900 font-semibold text-xs transition shadow-xs"
                    >
                      Book as Person {num}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const freshToken = `demo-user-${Math.floor(1000 + Math.random() * 9000)}`;
                      window.location.href = `/b/${freshToken}`;
                    }}
                    className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition"
                  >
                    + Book as New Member
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 1: DETAILS */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{strings.detailsTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{strings.detailsSubtitle}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {strings.fullNameLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={strings.fullNamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition"
                    autoFocus
                  />
                </div>
                {customerName.trim().length > 0 && customerName.trim().length < 2 && (
                  <p className="text-[11px] text-red-500 mt-1">{strings.nameMinChars}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {strings.whatsappNumberLabel}
                </label>
                <div className="flex items-center space-x-3 p-3 bg-slate-100/80 rounded-xl border border-slate-200/80">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono text-sm font-semibold text-slate-800 block">
                      {initData?.mobile_masked || 'XXXXXXXXXXXX'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      ✓ {strings.whatsappVerifiedHint}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: DATE */}
        {step === 2 && (
          <div className="animate-in fade-in duration-200">
            {!initData?.dates || initData.dates.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">{strings.noDatesAvailable}</p>
              </div>
            ) : (
              <CustomerDatePicker
                title={strings.dateTitle}
                subtitle={strings.dateSubtitle}
                availableDates={initData.dates}
                selectedDate={selectedDay}
                onSelectDate={(day) => handleDaySelect(day)}
              />
            )}
          </div>
        )}

        {/* SCREEN 3: SERVICES */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{strings.servicesTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{strings.servicesSubtitle}</p>
            </div>

            {/* Sticky summary bar */}
            <div className="sticky top-[60px] z-10 bg-emerald-900 text-white rounded-xl p-3 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-medium">{strings.totalDuration}:</span>
              </div>
              <span className="text-sm font-bold bg-emerald-800/80 px-3 py-1 rounded-lg">
                {totalMinutes} {strings.minutes}
              </span>
            </div>

            <div className="space-y-2.5">
              {initData?.products?.map((prod: CustomerProduct) => {
                const isChecked = selectedProductIds.includes(prod.id);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => toggleProduct(prod.id)}
                    className={`w-full min-h-[56px] text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      isChecked
                        ? 'border-emerald-800 bg-emerald-50/70 ring-1 ring-emerald-800 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 active:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-sm text-slate-900 block">
                        {prod.name}
                      </span>
                      <span className="text-xs text-emerald-700 font-medium mt-0.5 block">
                        {prod.minutes} {strings.minutes}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'border-emerald-800 bg-emerald-800 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SCREEN 4: TIME */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{strings.timeTitle}</h2>
                <p className="text-xs text-slate-500 mt-1">{strings.timeSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => loadSlots(selectedDay, selectedProductIds)}
                disabled={loadingSlots}
                className="flex items-center space-x-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 active:scale-95 transition"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loadingSlots ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Visit Details Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 shadow-xs">
              <span className="font-semibold text-slate-800">{formatSlotDate(selectedDay)}</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                {totalMinutes} min continuous block
              </span>
            </div>

            {/* Theater Seat Map Legend */}
            <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white" />
                <span>Available</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded bg-emerald-800" />
                <span className="font-semibold text-emerald-900">Selected</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded border border-amber-300 bg-amber-100" />
                <span className="text-amber-800 font-medium">1 Left</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-[9px] text-red-600 font-bold">
                  <Lock className="w-2.5 h-2.5" />
                </div>
                <span className="text-slate-500 font-medium">Booked</span>
              </div>
            </div>

            {loadingSlots ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <div className="w-8 h-8 rounded-full border-3 border-emerald-800 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-xs font-medium text-slate-600">Checking seat timeline & counters...</p>
              </div>
            ) : allSlotSeats.length === 0 && availableSlots.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">{strings.noSlotsAvailable}</p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
                >
                  Choose another date
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* MORNING SESSION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {strings.morningSlots} (10:00 AM – 1:00 PM)
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Morning Session</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allSlotSeats.length > 0
                      ? morningSeats.map((seat) =>
                          renderSlotSeatItem(seat, selectedSlotStart === seat.slot_start, setSelectedSlotStart, totalMinutes)
                        )
                      : morningSlots.map((slot) => {
                          const isSelected = selectedSlotStart === slot;
                          const endSlot = addMinutesToTimestamp(slot, totalMinutes);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlotStart(slot)}
                              className={`min-h-[52px] py-2.5 px-3.5 rounded-xl border text-center transition-all flex flex-col justify-center items-center ${
                                isSelected
                                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-800'
                                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 active:bg-slate-50'
                              }`}
                            >
                              <span className="font-bold text-sm leading-tight">
                                {formatSlotTime(slot)} – {formatSlotTime(endSlot)}
                              </span>
                              <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                                {totalMinutes} min continuous slot
                              </span>
                            </button>
                          );
                        })}
                  </div>
                </div>

                {/* COUNTER BREAK BANNER */}
                <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-xs">
                  <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span className="font-medium">1:00 PM – 2:00 PM Lunch Break (Counters Closed • No Bookings)</span>
                </div>

                {/* AFTERNOON SESSION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {strings.afternoonSlots} (2:00 PM – 5:00 PM)
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Afternoon Session</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allSlotSeats.length > 0
                      ? afternoonSeats.map((seat) =>
                          renderSlotSeatItem(seat, selectedSlotStart === seat.slot_start, setSelectedSlotStart, totalMinutes)
                        )
                      : afternoonSlots.map((slot) => {
                          const isSelected = selectedSlotStart === slot;
                          const endSlot = addMinutesToTimestamp(slot, totalMinutes);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlotStart(slot)}
                              className={`min-h-[52px] py-2.5 px-3.5 rounded-xl border text-center transition-all flex flex-col justify-center items-center ${
                                isSelected
                                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-800'
                                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 active:bg-slate-50'
                              }`}
                            >
                              <span className="font-bold text-sm leading-tight">
                                {formatSlotTime(slot)} – {formatSlotTime(endSlot)}
                              </span>
                              <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                                {totalMinutes} min continuous slot
                              </span>
                            </button>
                          );
                        })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 5: REVIEW */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{strings.reviewTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{strings.reviewSubtitle}</p>
            </div>

            {/* Reporting buffer notice card */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">{strings.reportingNotice}</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  {strings.reportBy}:{' '}
                  <strong className="underline">
                    {formatSlotTime(
                      new Date(new Date(selectedSlotStart).getTime() - 10 * 60000).toISOString()
                    )}
                  </strong>
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 divide-y divide-slate-100">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Member Name
                </span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {customerName}
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Date & Slot Time
                </span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                  {formatSlotDate(selectedDay)}
                </span>
                <span className="text-sm font-semibold text-emerald-800 mt-0.5 block">
                  {formatSlotRange(selectedSlotStart, calculatedEndTime())} ({totalMinutes} mins)
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  {strings.selectedServices}
                </span>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {selectedProductIds.map((id) => {
                    const prod = initData?.products?.find((p) => p.id === id);
                    return (
                      <li key={id} className="flex justify-between items-center py-0.5">
                        <span className="font-medium">• {prod?.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{prod?.minutes} min</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Surety Notice Reminder */}
            <div className="flex items-start space-x-2.5 text-blue-900 bg-blue-50/90 border border-blue-200/80 p-3.5 rounded-2xl text-xs text-left leading-relaxed">
              <FileText className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <span>{strings.suretyNotice}</span>
            </div>
          </div>
        )}

        {/* SCREEN 6: SUCCESS */}
        {step === 6 && successBooking && (
          <div className="space-y-5 animate-in zoom-in-95 duration-200 text-center pt-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {strings.bookingConfirmed}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your society counter token has been reserved
              </p>
            </div>

            {/* Token Badge Card */}
            <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-md space-y-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold block">
                  {strings.tokenNumber}
                </span>
                <span className="text-4xl font-extrabold tracking-tight mt-1 font-mono block">
                  {successBooking.token}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-800/80 text-left">
                <div className="bg-emerald-950/40 p-3 rounded-xl">
                  <span className="text-[10px] uppercase text-emerald-300 block font-semibold">
                    {strings.counter}
                  </span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    Counter {successBooking.counter}
                  </span>
                </div>
                <div className="bg-emerald-950/40 p-3 rounded-xl">
                  <span className="text-[10px] uppercase text-emerald-300 block font-semibold">
                    {strings.reportBy}
                  </span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {formatSlotTime(successBooking.report_time)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-emerald-200 pt-1 text-center font-medium">
                Slot: {formatSlotTime(successBooking.slot_start)} - {formatSlotTime(successBooking.slot_end)}
              </div>
            </div>

            {/* Strict notice & Surety Requirement */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2.5">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>{strings.whatsappSentNotice}</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                {strings.strictArrivalWarning}
              </p>
              <div className="flex items-start space-x-2 text-blue-900 bg-blue-50/90 p-2.5 rounded-lg border border-blue-200 text-[11px] leading-relaxed">
                <FileText className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                <span>{strings.suretyNotice}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  await loadInitData();
                  setStep('manage');
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-black text-white font-bold text-sm py-3 px-4 rounded-xl shadow transition"
              >
                {strings.viewMyBookings}
              </button>
            </div>
          </div>
        )}

        {/* MY BOOKINGS VIEW */}
        {step === 'manage' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{strings.myBookingsTitle}</h2>
                <p className="text-xs text-slate-500 mt-1">{strings.myBookingsSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
              >
                + Book New
              </button>
            </div>

            {cancelFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {cancelFeedback}
              </div>
            )}

            {rescheduleSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {rescheduleSuccessMsg}
              </div>
            )}

            {!initData?.bookings || initData.bookings.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">{strings.noBookings}</p>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold bg-emerald-800 text-white px-4 py-2 rounded-xl hover:bg-emerald-900 transition"
                >
                  <span>Book a Slot Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {initData.bookings.map((b: CustomerExistingBooking) => (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Token Number
                        </span>
                        <span className="text-2xl font-extrabold font-mono text-emerald-900">
                          {b.token}
                        </span>
                      </div>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                        Counter {b.counter}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatSlotDate(b.day)}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-800 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {formatSlotRange(b.slot_start, b.slot_end)} ({b.minutes} min)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => startReschedule(b)}
                        className="min-h-[44px] py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs transition"
                      >
                        {strings.changeBooking}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingToCancel(b)}
                        className="min-h-[44px] py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition"
                      >
                        {strings.cancelBooking}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESCHEDULE WIZARD VIEW */}
        {step === 'reschedule' && bookingToReschedule && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{strings.changeBooking}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Rescheduling Token {bookingToReschedule.token} ({bookingToReschedule.minutes} mins)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('manage')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            {rescheduleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                {rescheduleError}
              </div>
            )}

            {/* Current Booking Info */}
            <div className="bg-slate-100 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-700 block">Current Reservation:</span>
              <div>Date: {formatSlotDate(bookingToReschedule.day)}</div>
              <div>Time: {formatSlotRange(bookingToReschedule.slot_start, bookingToReschedule.slot_end)}</div>
            </div>

            {/* Step 1 of Reschedule: Choose New Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                1. Select New Date:
              </label>
              <CustomerDatePicker
                availableDates={initData?.dates || []}
                selectedDate={rescheduleDay}
                onSelectDate={(day) => loadRescheduleSlotsForDay(day)}
              />
            </div>

            {/* Step 2 of Reschedule: Choose New Time */}
            {rescheduleDay && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  2. Select New Time on {formatSlotDateShort(rescheduleDay)}:
                </label>
                {loadingRescheduleSlots ? (
                  <div className="p-6 text-center bg-white rounded-xl border border-slate-200">
                    <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin mx-auto mb-2" />
                    <span className="text-xs text-slate-500">Checking open slots...</span>
                  </div>
                ) : rescheduleAllSlotSeats.length === 0 && rescheduleSlots.length === 0 ? (
                  <div className="p-4 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                    No slots available on this date.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Legend */}
                    <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-2 flex items-center justify-between text-[10px] text-slate-600">
                      <div className="flex items-center space-x-1">
                        <div className="w-2.5 h-2.5 rounded border border-slate-300 bg-white" />
                        <span>Available</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2.5 h-2.5 rounded bg-emerald-800" />
                        <span className="font-semibold text-emerald-900">Selected</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2.5 h-2.5 rounded bg-slate-200 flex items-center justify-center text-red-600 font-bold">
                          <Lock className="w-2 h-2" />
                        </div>
                        <span className="text-slate-500">Booked</span>
                      </div>
                    </div>

                    {/* Reschedule Morning */}
                    {rescheduleMorningSeats.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Morning (10:00 AM – 1:00 PM)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rescheduleMorningSeats.map((seat) =>
                            renderSlotSeatItem(
                              seat,
                              rescheduleNewStart === seat.slot_start,
                              setRescheduleNewStart,
                              bookingToReschedule.minutes
                            )
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-center font-medium">
                      1:00 PM – 2:00 PM Lunch Break (Closed)
                    </div>

                    {/* Reschedule Afternoon */}
                    {rescheduleAfternoonSeats.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Afternoon (2:00 PM – 5:00 PM)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rescheduleAfternoonSeats.map((seat) =>
                            renderSlotSeatItem(
                              seat,
                              rescheduleNewStart === seat.slot_start,
                              setRescheduleNewStart,
                              bookingToReschedule.minutes
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Confirm Reschedule Button */}
            {rescheduleNewStart && (
              <div className="pt-4">
                <button
                  type="button"
                  disabled={rescheduleSubmitting}
                  onClick={handleConfirmReschedule}
                  className="w-full min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {rescheduleSubmitting ? 'Rescheduling Slot...' : strings.confirmReschedule}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cancel Confirmation Dialog Modal */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-5 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900">{strings.cancelConfirmTitle}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {strings.cancelConfirmDesc.replace('{token}', bookingToCancel.token)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBookingToCancel(null)}
                disabled={cancelLoading}
                className="min-h-[48px] py-2 px-3 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50"
              >
                {strings.keepBooking}
              </button>
              <button
                type="button"
                onClick={handleExecuteCancel}
                disabled={cancelLoading}
                className="min-h-[48px] py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : strings.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM ACTION BAR (Wizard Navigation) */}
      {typeof step === 'number' && step >= 1 && step <= 5 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 z-20 shadow-lg">
          <div className="max-w-md mx-auto flex items-center space-x-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => ((prev as number) - 1) as Step)}
                disabled={isSubmitting}
                className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition flex items-center justify-center flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={customerName.trim().length < 2}
                className="flex-1 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-4 rounded-xl shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2"
              >
                <span>{strings.next}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedDay}
                className="flex-1 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-4 rounded-xl shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2"
              >
                <span>{strings.next}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={goToTimeStep}
                disabled={selectedProductIds.length === 0}
                className="flex-1 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-4 rounded-xl shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2"
              >
                <span>{strings.next} ({totalMinutes} min)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={!selectedSlotStart}
                className="flex-1 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-4 rounded-xl shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2"
              >
                <span>{strings.next}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                className="flex-1 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-4 rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    <span>{strings.bookingInProgress}</span>
                  </>
                ) : (
                  <>
                    <span>{strings.confirmBooking}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Small link at bottom to switch between Book and Manage */}
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => setStep('manage')}
              className="text-[11px] font-semibold text-slate-500 hover:text-emerald-800 underline transition"
            >
              {strings.viewMyBookings} ({initData?.bookings?.length || 0})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
