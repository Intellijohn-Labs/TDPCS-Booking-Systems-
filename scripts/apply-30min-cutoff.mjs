import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL...');

  // 1. Update report_buffer setting to 30
  await client.query(`
    UPDATE settings SET value = '30' WHERE key = 'report_buffer';
  `);
  console.log('Updated settings.report_buffer to 30.');

  // 2. Update get_available_slots
  await client.query(`
CREATE OR REPLACE FUNCTION public.get_available_slots(p_day date, p_minutes integer)
 RETURNS TABLE(slot_start timestamp without time zone, counter smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with d as (
    select * from open_days where day = p_day and status = 'open'
  ),
  cfg as (
    select coalesce((select value::int from settings where key='slot_step'), 5) as stp,
           greatest(coalesce((select value::int from settings where key='report_buffer'), 10), 30) as buf
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
$function$;
  `);
  console.log('Updated get_available_slots function.');

  // 3. Update customer_slots
  await client.query(`
CREATE OR REPLACE FUNCTION public.customer_slots(p_token text, p_day date, p_product_ids integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_min int;
  v_slots jsonb;
  v_all_slots jsonb;
  v_buf int;
begin
  if _link_mobile(p_token) is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;
  select coalesce(sum(minutes), 0) into v_min from products where id = any(p_product_ids) and active;
  if v_min = 0 then return jsonb_build_object('ok', false, 'error', 'no_products'); end if;

  select coalesce(jsonb_agg(to_char(slot_start, 'YYYY-MM-DD"T"HH24:MI:SS') order by slot_start), '[]'::jsonb)
  into v_slots from get_available_slots(p_day, v_min);

  select greatest(coalesce((select value::int from settings where key='report_buffer'), 10), 30) into v_buf;

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
      cand.st <= (now() at time zone 'Asia/Kolkata') + make_interval(mins => v_buf) as is_past
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
end $function$;
  `);
  console.log('Updated customer_slots function.');

  // 4. Update book_slot_internal
  await client.query(`
CREATE OR REPLACE FUNCTION public.book_slot_internal(p_mobile text, p_name text, p_day date, p_start timestamp without time zone, p_product_ids integer[], p_rescheduled_from bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 30-minute advance cutoff rule
  if p_start <= (now() at time zone 'Asia/Kolkata') + interval '30 minutes' then
    return jsonb_build_object('ok', false, 'error', 'slot_cutoff_passed');
  end if;

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
end $function$;
  `);
  console.log('Updated book_slot_internal function.');

  await client.end();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
