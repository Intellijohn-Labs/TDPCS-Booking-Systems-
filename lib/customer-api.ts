import { createClient } from '@/lib/supabase/client';
import {
  CustomerInitResponse,
  CustomerSlotsResponse,
  CustomerBookResponse,
  CustomerCancelResponse,
  CustomerRescheduleResponse,
} from '@/types/database';

/**
 * Typed client wrapper for Customer RPC functions
 * Customer calls use the anon Supabase client with only the secure token
 */

export async function fetchCustomerInit(token: string): Promise<CustomerInitResponse> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('customer_init', { p_token: token });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as unknown as CustomerInitResponse;
}

export async function fetchCustomerSlots(
  token: string,
  day: string,
  productIds: number[]
): Promise<CustomerSlotsResponse> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('customer_slots', {
    p_token: token,
    p_day: day,
    p_product_ids: productIds,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as unknown as CustomerSlotsResponse;
}

export async function submitCustomerBook(
  token: string,
  name: string,
  start: string,
  productIds: number[]
): Promise<CustomerBookResponse> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('customer_book', {
    p_token: token,
    p_name: name,
    p_start: start,
    p_product_ids: productIds,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as unknown as CustomerBookResponse;
}

export async function submitCustomerCancel(
  token: string,
  bookingId: number
): Promise<CustomerCancelResponse> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('customer_cancel', {
    p_token: token,
    p_booking_id: bookingId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as unknown as CustomerCancelResponse;
}

export async function submitCustomerReschedule(
  token: string,
  bookingId: number,
  newStart: string
): Promise<CustomerRescheduleResponse> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('customer_reschedule', {
    p_token: token,
    p_booking_id: bookingId,
    p_new_start: newStart,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return data as unknown as CustomerRescheduleResponse;
}
