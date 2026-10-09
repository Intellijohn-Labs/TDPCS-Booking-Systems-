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
