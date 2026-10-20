import { createClient } from '@/lib/supabase/client';

export type StaffActionResult = {
  ok: boolean;
  error?: string;
};

export type ExtendBookingResult = {
  ok: boolean;
  counter_free_from?: string;
  error?: string;
};

export type BlockDayResult = {
  ok: boolean;
  cancelled?: number;
  error?: string;
};

export async function setBookingStatus(
  bookingId: number,
  status: 'arrived' | 'called' | 'served' | 'cancelled' | 'no_show'
): Promise<StaffActionResult> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('set_booking_status', {
    p_id: bookingId,
    p_status: status,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as StaffActionResult;
}

export async function extendBooking(
  bookingId: number,
  minutes: number
): Promise<ExtendBookingResult> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('extend_booking', {
    p_id: bookingId,
    p_minutes: minutes,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as ExtendBookingResult;
}

export async function blockDay(
  day: string,
  reason: string = 'Holiday'
): Promise<BlockDayResult> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('block_day', {
    p_day: day,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as BlockDayResult;
}

export type AutoGenerateResult = {
  ok: boolean;
  days_checked?: number;
  days_inserted?: number;
  from_date?: string;
  to_date?: string;
  error?: string;
};

export async function autoGenerateOpenDays(
  daysAhead: number = 60,
  workingDows: number[] = [2, 4, 6]
): Promise<AutoGenerateResult> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('auto_generate_open_days', {
    p_days_ahead: daysAhead,
    p_working_dows: workingDows,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as AutoGenerateResult;
}

export type PurgeRecordsResult = {
  ok: boolean;
  cutoff_date?: string;
  deleted_bookings?: number;
  deleted_audit_logs?: number;
  deleted_links?: number;
  error?: string;
};

export async function purgeOldRecords4Months(): Promise<PurgeRecordsResult> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('purge_old_records_4months');
  if (error) {
    return { ok: false, error: error.message };
  }
  return data as PurgeRecordsResult;
}

export async function logAuditEvent(
  action: string,
  details: Record<string, any> = {},
  bookingId?: number | null,
  actor?: string
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('log_audit_event', {
    p_action: action,
    p_details: details,
    p_booking_id: bookingId || null,
    p_actor: actor || null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return data as { ok: boolean; id?: number };
}


