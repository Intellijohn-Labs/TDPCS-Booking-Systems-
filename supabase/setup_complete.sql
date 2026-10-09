-- ==============================================================================
-- TDPCS-Apt: Complete Database Setup for Thrissur Police Co-op Society
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jktoipmsdvcnljogitos/sql/new
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists btree_gist;

-- 2. Create Schema Tables
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('staff', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id serial primary key,
  name text not null,
  minutes int not null check (minutes > 0),
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists open_days (
  day date primary key,
  status text not null default 'open' check (status in ('open', 'blocked')),
  s1_start time,
  s1_end time,
  s2_start time,
  s2_end time,
  note text
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists token_counters (
  day date primary key,
  last_no int not null default 0
);

create table if not exists booking_links (
  id text primary key,
  mobile text not null,
  purpose text not null check (purpose in ('book', 'manage')),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id bigserial primary key,
  token_no text not null,
  day date not null references open_days(day),
  customer_name text,
  mobile text not null,
  product_ids int[] not null,
  total_minutes int not null,
  counter smallint not null check (counter in (1, 2)),
  slot_start timestamp not null,
  slot_end timestamp not null,
  report_time timestamp not null,
  status text not null default 'booked'
    check (status in ('booked', 'arrived', 'called', 'served', 'cancelled', 'no_show')),
  extended_minutes int not null default 0,
  cancel_reason text,
  rescheduled_from bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (day, token_no),
  constraint no_overlap exclude using gist (
    counter with =, tsrange(slot_start, slot_end) with &&
  ) where (status in ('booked', 'arrived', 'called')) deferrable initially immediate
);

create index if not exists idx_bookings_mobile_status on bookings (mobile, status);
create index if not exists idx_bookings_day_status on bookings (day, status);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text,
  action text not null,
  booking_id bigint,
  details jsonb not null default '{}'::jsonb
);

-- 3. Role Helpers
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role in ('staff', 'admin'));
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin');
$$;

create or replace function _link_mobile(p_token text) returns text
language sql stable security definer set search_path = public as $$
  select mobile from booking_links where id = p_token and expires_at > now();
$$;

-- 4. Available Slots Calculation (Morning 10:00-13:00, Afternoon 14:00-17:00, no crossing)
create or replace function get_available_slots(p_day date, p_minutes int)
returns table(slot_start timestamp, counter smallint)
language sql stable security definer set search_path = public as $$
  with d as (
    select * from open_days where day = p_day and status = 'open'
  ),
  cfg as (
    select coalesce((select value::int from settings where key='slot_step'), 5) as stp,
           coalesce((select value::int from settings where key='report_buffer'), 10) as buf
  ),
  sessions as (
    select p_day + s1_start as st, p_day + s1_end as en from d where s1_start is not null
    union all
    select p_day + s2_start, p_day + s2_end from d where s2_start is not null
  ),
  cand as (
    select g as st
    from sessions, cfg,
         generate_series(sessions.st, sessions.en - make_interval(mins => p_minutes),
                         make_interval(mins => greatest(p_minutes, 5))) g
  ),
  c as (
    select 1::smallint as counter union all select 2::smallint
  )
  select distinct on (cand.st) cand.st, c.counter
  from cand cross join c cross join cfg
  where cand.st > (now() at time zone 'Asia/Kolkata') + make_interval(mins => cfg.buf)
    and not exists (
      select 1 from bookings b
      where b.counter = c.counter and b.status in ('booked', 'arrived', 'called')
        and tsrange(b.slot_start, b.slot_end) &&
            tsrange(cand.st, cand.st + make_interval(mins => p_minutes))
    )
  order by cand.st, c.counter;
$$;

-- 5. Internal Booking & Reschedule Engine
create or replace function book_slot_internal(
  p_mobile text, p_name text, p_day date,
  p_start timestamp, p_product_ids int[], p_rescheduled_from bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min int;
  v_counter smallint;
  v_no int;
  v_end timestamp;
  v_buf int;
  v_id bigint;
begin
  select coalesce(sum(minutes), 0) into v_min from products where id = any(p_product_ids) and active;
  if v_min = 0 then return jsonb_build_object('ok', false, 'error', 'no_products'); end if;

  perform 1 from open_days where day = p_day and status = 'open' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'day_closed'); end if;

  if exists (select 1 from bookings where mobile = p_mobile and day = p_day
               and status in ('booked', 'arrived', 'called')
               and (p_rescheduled_from is null or id <> p_rescheduled_from)) then
    return jsonb_build_object('ok', false, 'error', 'already_booked');
  end if;

  select counter into v_counter from get_available_slots(p_day, v_min)
   where slot_start = p_start limit 1;
  if v_counter is null then return jsonb_build_object('ok', false, 'error', 'slot_taken'); end if;

  insert into token_counters(day, last_no) values (p_day, 1)
  on conflict (day) do update set last_no = token_counters.last_no + 1
  returning last_no into v_no;

  v_end := p_start + make_interval(mins => v_min);
  v_buf := coalesce((select value::int from settings where key='report_buffer'), 10);

  insert into bookings(token_no, day, customer_name, mobile, product_ids, total_minutes,
                       counter, slot_start, slot_end, report_time, rescheduled_from)
  values ('T-' || lpad(v_no::text, 3, '0'), p_day, p_name, p_mobile, p_product_ids, v_min,
          v_counter, p_start, v_end, greatest(p_start - make_interval(mins => v_buf), p_day::timestamp),
          p_rescheduled_from)
  returning id into v_id;

  insert into audit_log(actor, action, booking_id, details)
  values ('customer:' || p_mobile, case when p_rescheduled_from is null then 'book' else 'reschedule' end,
          v_id, jsonb_build_object('token', 'T-' || lpad(v_no::text, 3, '0'), 'counter', v_counter));

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_id,
    'token', 'T-' || lpad(v_no::text, 3, '0'),
    'counter', v_counter,
    'slot_start', to_char(p_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'slot_end', to_char(v_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'report_time', to_char(greatest(p_start - make_interval(mins => v_buf), p_day::timestamp), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'minutes', v_min,
    'name', p_name
  );
exception when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'slot_taken');
end $$;

create or replace function cancel_internal(p_id bigint, p_mobile text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_id and mobile = p_mobile and status = 'booked' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;

  update bookings set status = 'cancelled', cancel_reason = 'customer',
         cancelled_at = now(), updated_at = now() where id = p_id;
  insert into audit_log(actor, action, booking_id) values ('customer:' || p_mobile, 'cancel', p_id);

  return jsonb_build_object('ok', true, 'token', b.token_no, 'counter', b.counter,
                           'slot_start', b.slot_start, 'slot_end', b.slot_end, 'name', b.customer_name);
end $$;

create or replace function reschedule_internal(p_id bigint, p_mobile text, p_new_start timestamp)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o bookings%rowtype;
  res jsonb;
  v_err text;
begin
  select * into o from bookings where id = p_id and mobile = p_mobile and status = 'booked' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  update bookings set status = 'cancelled', cancel_reason = 'rescheduled',
         cancelled_at = now(), updated_at = now() where id = p_id;

  res := book_slot_internal(o.mobile, o.customer_name, p_new_start::date, p_new_start,
                            o.product_ids, o.id);
  if not (res->>'ok')::boolean then
    v_err := res->>'error';
    raise exception 'rollback_reschedule';
  end if;

  return res || jsonb_build_object('old_token', o.token_no, 'old_counter', o.counter,
                                   'old_slot_start', o.slot_start, 'old_slot_end', o.slot_end);
exception when raise_exception then
  return jsonb_build_object('ok', false, 'error', coalesce(v_err, 'slot_taken'));
end $$;

-- 6. Customer-facing RPCs
create or replace function customer_init(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l booking_links%rowtype;
  v_adv int;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into l from booking_links where id = p_token and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;

  v_adv := coalesce((select value::int from settings where key='advance_days'), 15);

  return jsonb_build_object(
    'ok', true,
    'purpose', l.purpose,
    'mobile_masked', repeat('X', greatest(length(l.mobile)-4, 0)) || right(l.mobile, 4),
    'last_name', (select customer_name from bookings where mobile = l.mobile order by created_at desc limit 1),
    'dates', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 's1_start', s1_start, 's1_end', s1_end,
                                         's2_start', s2_start, 's2_end', s2_end) order by day)
      from open_days where status = 'open' and day between v_today and v_today + v_adv
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'minutes', minutes) order by sort_order, id)
      from products where active
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'token', token_no, 'day', day,
                                         'slot_start', slot_start, 'slot_end', slot_end,
                                         'counter', counter, 'name', customer_name,
                                         'product_ids', product_ids, 'minutes', total_minutes) order by slot_start)
      from bookings where mobile = l.mobile and status = 'booked'
        and slot_start > (now() at time zone 'Asia/Kolkata')
    ), '[]'::jsonb)
  );
end $$;

create or replace function customer_slots(p_token text, p_day date, p_product_ids int[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_min int;
  v_slots jsonb;
  v_all_slots jsonb;
begin
  if _link_mobile(p_token) is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;
  select coalesce(sum(minutes), 0) into v_min from products where id = any(p_product_ids) and active;
  if v_min = 0 then return jsonb_build_object('ok', false, 'error', 'no_products'); end if;

  select coalesce(jsonb_agg(to_char(slot_start, 'YYYY-MM-DD"T"HH24:MI:SS') order by slot_start), '[]'::jsonb)
  into v_slots from get_available_slots(p_day, v_min);

  with d as (
    select * from open_days where day = p_day and status = 'open'
  ),
  sessions as (
    select p_day + s1_start as st, p_day + s1_end as en from d where s1_start is not null
    union all
    select p_day + s2_start, p_day + s2_end from d where s2_start is not null
  ),
  cand as (
    select g as st, g + make_interval(mins => v_min) as en
    from sessions,
         generate_series(sessions.st, sessions.en - make_interval(mins => v_min),
                         make_interval(mins => greatest(v_min, 5))) g
  ),
  seat_eval as (
    select
      cand.st as slot_start,
      cand.en as slot_end,
      exists(select 1 from bookings b where b.counter = 1 and b.status in ('booked', 'arrived', 'called')
               and tsrange(b.slot_start, b.slot_end) && tsrange(cand.st, cand.en)) as c1_booked,
      exists(select 1 from bookings b where b.counter = 2 and b.status in ('booked', 'arrived', 'called')
               and tsrange(b.slot_start, b.slot_end) && tsrange(cand.st, cand.en)) as c2_booked,
      cand.st < (now() at time zone 'Asia/Kolkata') as is_past
    from cand
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'slot_start', to_char(slot_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'slot_end', to_char(slot_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'c1_booked', c1_booked,
      'c2_booked', c2_booked,
      'counter', case when not c1_booked then 1 when not c2_booked then 2 else null end,
      'status', case
        when is_past then 'past'
        when c1_booked and c2_booked then 'booked'
        when c1_booked or c2_booked then 'partial'
        else 'available'
      end
    ) order by slot_start
  ), '[]'::jsonb) into v_all_slots from seat_eval;

  return jsonb_build_object(
    'ok', true,
    'minutes', v_min,
    'slots', v_slots,
    'all_slots', v_all_slots
  );
end $$;

create or replace function customer_book(p_token text, p_name text, p_start timestamp, p_product_ids int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mobile text := _link_mobile(p_token);
begin
  if v_mobile is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;
  if length(trim(coalesce(p_name, ''))) < 2 then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  update booking_links set used_at = coalesce(used_at, now()) where id = p_token;
  return book_slot_internal(v_mobile, trim(p_name), p_start::date, p_start, p_product_ids, null);
end $$;

create or replace function customer_cancel(p_token text, p_booking_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_mobile text := _link_mobile(p_token);
begin
  if v_mobile is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;
  return cancel_internal(p_booking_id, v_mobile);
end $$;

create or replace function customer_reschedule(p_token text, p_booking_id bigint, p_new_start timestamp)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mobile text := _link_mobile(p_token);
begin
  if v_mobile is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;
  return reschedule_internal(p_booking_id, v_mobile, p_new_start);
end $$;

-- 7. Staff & Admin Functions
create or replace function set_booking_status(p_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('arrived', 'called', 'served', 'cancelled', 'no_show') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  update bookings set status = p_status, updated_at = now(),
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancel_reason = case when p_status = 'cancelled' then 'staff' else cancel_reason end
   where id = p_id and status in ('booked', 'arrived', 'called');
  if not found then return jsonb_build_object('ok', false, 'error', 'not_updatable'); end if;
  insert into audit_log(actor, action, booking_id) values (auth.uid()::text, 'status:' || p_status, p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function extend_booking(p_id bigint, p_minutes int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  r bookings%rowtype;
  v_max int;
  v_cursor timestamp;
  v_shift interval;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  v_max := coalesce((select value::int from settings where key='max_extension'), 30);
  select * into b from bookings where id = p_id and status in ('booked', 'arrived', 'called') for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.extended_minutes + p_minutes > v_max then
    return jsonb_build_object('ok', false, 'error', 'limit_exceeded');
  end if;
  set constraints no_overlap deferred;
  v_cursor := b.slot_end + make_interval(mins => p_minutes);
  update bookings set slot_end = v_cursor, extended_minutes = extended_minutes + p_minutes,
         updated_at = now() where id = b.id;
  for r in select * from bookings
            where counter = b.counter and day = b.day and status = 'booked'
              and slot_start >= b.slot_start and id <> b.id
            order by slot_start loop
    exit when r.slot_start >= v_cursor;
    v_shift := v_cursor - r.slot_start;
    update bookings set slot_start = slot_start + v_shift, slot_end = slot_end + v_shift,
           report_time = report_time + v_shift, updated_at = now() where id = r.id;
    v_cursor := r.slot_end + v_shift;
  end loop;
  insert into audit_log(actor, action, booking_id, details)
    values (auth.uid()::text, 'extend', p_id, jsonb_build_object('minutes', p_minutes));
  return jsonb_build_object('ok', true, 'counter_free_from', v_cursor);
end $$;

create or replace function block_day(p_day date, p_reason text default 'Holiday') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  update open_days set status = 'blocked', note = p_reason where day = p_day;
  if not found then insert into open_days(day, status, note) values (p_day, 'blocked', p_reason); end if;
  update bookings set status = 'cancelled', cancelled_at = now(), updated_at = now(),
         cancel_reason = 'day_blocked'
   where day = p_day and status = 'booked';
  get diagnostics n = row_count;
  insert into audit_log(actor, action, details)
    values (auth.uid()::text, 'block_day', jsonb_build_object('day', p_day, 'cancelled', n));
  return jsonb_build_object('ok', true, 'cancelled', n);
end $$;

-- 8. Permissions and RLS Policies
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function customer_init(text), customer_slots(text, date, int[]),
  customer_book(text, text, timestamp, int[]), customer_cancel(text, bigint),
  customer_reschedule(text, bigint, timestamp) to anon, authenticated;
grant execute on function is_staff(), is_admin(), set_booking_status(bigint, text),
  extend_booking(bigint, int), block_day(date, text) to authenticated;

alter table profiles enable row level security;
alter table products enable row level security;
alter table open_days enable row level security;
alter table settings enable row level security;
alter table token_counters enable row level security;
alter table booking_links enable row level security;
alter table bookings enable row level security;
alter table audit_log enable row level security;

-- Policies
drop policy if exists "own profile or admin" on profiles;
create policy "own profile or admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

drop policy if exists "admin manages profiles" on profiles;
create policy "admin manages profiles" on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "staff read products" on products;
create policy "staff read products" on products for select to authenticated using (is_staff());

drop policy if exists "admin write products" on products;
create policy "admin write products" on products for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "staff read open_days" on open_days;
create policy "staff read open_days" on open_days for select to authenticated using (is_staff());

drop policy if exists "admin write open_days" on open_days;
create policy "admin write open_days" on open_days for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "staff read settings" on settings;
create policy "staff read settings" on settings for select to authenticated
  using (is_staff() and key not like 'n8n_%');

drop policy if exists "admin write settings" on settings;
create policy "admin write settings" on settings for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "staff read bookings" on bookings;
create policy "staff read bookings" on bookings for select to authenticated using (is_staff());

drop policy if exists "admin read audit" on audit_log;
create policy "admin read audit" on audit_log for select to authenticated using (is_admin());

-- 9. Realtime Publication
do $$
begin
  alter publication supabase_realtime add table bookings;
exception when others then
  null;
end $$;

-- 10. Seed Products
insert into products(name, minutes, sort_order) values
 ('Simple Loan', 20, 1),
 ('Emergency Loan', 5, 2),
 ('Education Loan', 5, 3),
 ('Professional Edu. Loan', 15, 4),
 ('Vehicle Loan', 20, 5),
 ('Hire Purchase Loan', 15, 6),
 ('Chitty Prized Withdrawal', 10, 7)
on conflict do nothing;

-- 11. Seed Settings
insert into settings (key, value) values
 ('slot_step', '5'),
 ('report_buffer', '10'),
 ('max_extension', '30'),
 ('advance_days', '15'),
 ('client_notify_number', ''),
 ('n8n_webhook_url', '')
on conflict (key) do nothing;

-- 12. Seed Open Days (Working Hours: 10:00-13:00 and 14:00-17:00)
insert into open_days(day, status, s1_start, s1_end, s2_start, s2_end, note)
select d::date, 'open', '10:00', '13:00', '14:00', '17:00', 'Thrissur Society Working Day'
  from generate_series(current_date, current_date + 30, '1 day') d
 where extract(isodow from d) in (1, 2, 3, 4, 5, 6)
on conflict (day) do nothing;

-- 13. Seed Demo Booking Links (for Persona Testing)
insert into booking_links (id, mobile, purpose, expires_at) values
 ('demo-booking-token', '919876543210', 'book', now() + interval '30 days'),
 ('demo-user-1', '919876543211', 'book', now() + interval '30 days'),
 ('demo-user-2', '919876543212', 'book', now() + interval '30 days'),
 ('demo-user-3', '919876543213', 'book', now() + interval '30 days'),
 ('demo-user-4', '919876543214', 'book', now() + interval '30 days'),
 ('demo-user-5', '919876543215', 'book', now() + interval '30 days')
on conflict (id) do nothing;

-- 14. n8n WhatsApp Bot & Webhook Automation
create extension if not exists pg_net;

create table if not exists bot_sessions (
  mobile text primary key,
  step text not null default 'MENU',
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table bot_sessions enable row level security;
drop policy if exists "service_role manages bot_sessions" on bot_sessions;
create policy "service_role manages bot_sessions" on bot_sessions for all using (true) with check (true);

create or replace function book_slot(
  p_mobile text, p_name text, p_day date, p_start timestamp, p_product_ids int[]
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return book_slot_internal(p_mobile, trim(p_name), p_day, p_start, p_product_ids, null);
end $$;

create or replace function cancel_booking(
  p_booking_id bigint, p_mobile text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return cancel_internal(p_booking_id, p_mobile);
end $$;

create or replace function reschedule_booking(
  p_booking_id bigint, p_mobile text, p_new_start timestamp
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return reschedule_internal(p_booking_id, p_mobile, p_new_start);
end $$;

create or replace function no_show_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bookings
     set status = 'no_show', updated_at = now()
   where status = 'booked'
     and slot_start < (now() at time zone 'Asia/Kolkata');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function notify_n8n() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_event text;
  v_prev jsonb;
begin
  select value into v_url from settings where key = 'n8n_webhook_url';
  if v_url is null or v_url = '' or v_url like '%<%>%' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.rescheduled_from is not null then
      v_event := 'rescheduled';
      select to_jsonb(b) into v_prev from bookings b where b.id = new.rescheduled_from;
    else
      v_event := 'booked';
    end if;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    if new.cancel_reason = 'rescheduled' then
      return new;
    end if;
    v_event := 'cancelled';
  elsif new.status = 'no_show' and old.status <> 'no_show' then
    v_event := 'no_show';
  elsif new.slot_start <> old.slot_start and new.status = 'booked' then
    v_event := 'time_changed';
    v_prev := jsonb_build_object(
      'slot_start', old.slot_start,
      'slot_end', old.slot_end,
      'counter', old.counter
    );
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url     := v_url,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object(
        'event', v_event,
        'booking', to_jsonb(new),
        'previous', v_prev,
        'client_number', (select value from settings where key = 'client_notify_number')
      )
    );
  exception when others then
    null;
  end;

  return new;
end $$;

drop trigger if exists trg_notify_n8n on bookings;
create trigger trg_notify_n8n
after insert or update of status, slot_start on bookings
for each row execute function notify_n8n();

grant execute on function book_slot(text, text, date, timestamp, int[]),
  cancel_booking(bigint, text),
  reschedule_booking(bigint, text, timestamp),
  no_show_sweep()
to anon, authenticated, service_role;

grant all on bot_sessions to authenticated, service_role;

