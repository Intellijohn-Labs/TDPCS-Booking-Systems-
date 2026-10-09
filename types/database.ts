export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus =
  | 'booked'
  | 'arrived'
  | 'called'
  | 'served'
  | 'cancelled'
  | 'no_show';

export type UserRole = 'staff' | 'admin';

export type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: UserRole;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          active?: boolean;
          created_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      products: {
        Row: {
          id: number;
          name: string;
          minutes: number;
          active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: number;
          name: string;
          minutes: number;
          active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: number;
          name?: string;
          minutes?: number;
          active?: boolean;
          sort_order?: number;
        };
        Relationships: GenericRelationship[];
      };
      open_days: {
        Row: {
          day: string;
          status: 'open' | 'blocked';
          s1_start: string | null;
          s1_end: string | null;
          s2_start: string | null;
          s2_end: string | null;
          note: string | null;
        };
        Insert: {
          day: string;
          status?: 'open' | 'blocked';
          s1_start?: string | null;
          s1_end?: string | null;
          s2_start?: string | null;
          s2_end?: string | null;
          note?: string | null;
        };
        Update: {
          day?: string;
          status?: 'open' | 'blocked';
          s1_start?: string | null;
          s1_end?: string | null;
          s2_start?: string | null;
          s2_end?: string | null;
          note?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      settings: {
        Row: {
          key: string;
          value: string;
        };
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
        Relationships: GenericRelationship[];
      };
      token_counters: {
        Row: {
          day: string;
          last_no: number;
        };
        Insert: {
          day: string;
          last_no?: number;
        };
        Update: {
          day?: string;
          last_no?: number;
        };
        Relationships: GenericRelationship[];
      };
      booking_links: {
        Row: {
          id: string;
          mobile: string;
          purpose: 'book' | 'manage';
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mobile: string;
          purpose: 'book' | 'manage';
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          mobile?: string;
          purpose?: 'book' | 'manage';
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      bookings: {
        Row: {
          id: number;
          token_no: string;
          day: string;
          customer_name: string | null;
          mobile: string;
          product_ids: number[];
          total_minutes: number;
          counter: 1 | 2;
          slot_start: string;
          slot_end: string;
          report_time: string;
          status: BookingStatus;
          extended_minutes: number;
          cancel_reason: string | null;
          rescheduled_from: number | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: number;
          token_no: string;
          day: string;
          customer_name?: string | null;
          mobile: string;
          product_ids: number[];
          total_minutes: number;
          counter: 1 | 2;
          slot_start: string;
          slot_end: string;
          report_time: string;
          status?: BookingStatus;
          extended_minutes?: number;
          cancel_reason?: string | null;
          rescheduled_from?: number | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Update: {
          id?: number;
          token_no?: string;
          day?: string;
          customer_name?: string | null;
          mobile?: string;
          product_ids?: number[];
          total_minutes?: number;
          counter?: 1 | 2;
          slot_start?: string;
          slot_end?: string;
          report_time?: string;
          status?: BookingStatus;
          extended_minutes?: number;
          cancel_reason?: string | null;
          rescheduled_from?: number | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      audit_log: {
        Row: {
          id: number;
          at: string;
          actor: string | null;
          action: string;
          booking_id: number | null;
          details: Json;
        };
        Insert: {
          id?: number;
          at?: string;
          actor?: string | null;
          action: string;
          booking_id?: number | null;
          details?: Json;
        };
        Update: {
          id?: number;
          at?: string;
          actor?: string | null;
          action?: string;
          booking_id?: number | null;
          details?: Json;
        };
        Relationships: GenericRelationship[];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      customer_init: {
        Args: { p_token: string };
        Returns: Json;
      };
      customer_slots: {
        Args: { p_token: string; p_day: string; p_product_ids: number[] };
        Returns: Json;
      };
      customer_book: {
        Args: {
          p_token: string;
          p_name: string;
          p_start: string;
          p_product_ids: number[];
        };
        Returns: Json;
      };
      customer_cancel: {
        Args: { p_token: string; p_booking_id: number };
        Returns: Json;
      };
      customer_reschedule: {
        Args: { p_token: string; p_booking_id: number; p_new_start: string };
        Returns: Json;
      };
      set_booking_status: {
        Args: { p_id: number; p_status: string };
        Returns: Json;
      };
      extend_booking: {
        Args: { p_id: number; p_minutes: number };
        Returns: Json;
      };
      block_day: {
        Args: { p_day: string; p_reason?: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Client helper types for Customer API
export interface CustomerOpenDay {
  day: string;
  s1_start: string | null;
  s1_end: string | null;
  s2_start: string | null;
  s2_end: string | null;
}

export interface CustomerProduct {
  id: number;
  name: string;
  minutes: number;
}

export interface CustomerExistingBooking {
  id: number;
  token: string;
  day: string;
  slot_start: string;
  slot_end: string;
  counter: number;
  name: string | null;
  product_ids: number[];
  minutes: number;
}

export interface CustomerInitResponse {
  ok: boolean;
  error?: string;
  purpose?: 'book' | 'manage';
  mobile_masked?: string;
  last_name?: string | null;
  dates?: CustomerOpenDay[];
  products?: CustomerProduct[];
  bookings?: CustomerExistingBooking[];
}

export interface SlotSeatInfo {
  slot_start: string;
  slot_end: string;
  status: 'available' | 'partial' | 'booked' | 'past';
  counter: number | null;
  c1_booked: boolean;
  c2_booked: boolean;
}

export interface CustomerSlotsResponse {
  ok: boolean;
  error?: string;
  minutes?: number;
  slots?: string[];
  all_slots?: SlotSeatInfo[];
}

export interface CustomerBookResponse {
  ok: boolean;
  error?: string;
  booking_id?: number;
  token?: string;
  counter?: number;
  slot_start?: string;
  slot_end?: string;
  report_time?: string;
  minutes?: number;
  name?: string;
}

export interface CustomerCancelResponse {
  ok: boolean;
  error?: string;
  token?: string;
  counter?: number;
  slot_start?: string;
  slot_end?: string;
  name?: string;
}

export interface CustomerRescheduleResponse extends CustomerBookResponse {
  old_token?: string;
  old_counter?: number;
  old_slot_start?: string;
  old_slot_end?: string;
}
