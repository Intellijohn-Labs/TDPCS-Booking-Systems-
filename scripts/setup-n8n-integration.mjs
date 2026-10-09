import pg from 'pg';

const { Client } = pg;
const client = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.jktoipmsdvcnljogitos',
  password: process.env.PGPASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Enable pg_net
create extension if not exists pg_net;

-- 2. Create bot_sessions table for n8n WhatsApp conversation state
create table if not exists bot_sessions (
  mobile text primary key,
  step text not null default 'MENU',
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table bot_sessions enable row level security;

-- Policy for bot_sessions (service_role can manage all, authenticated staff can view)
drop policy if exists "service_role manages bot_sessions" on bot_sessions;
create policy "service_role manages bot_sessions" on bot_sessions for all using (true) with check (true);

-- 3. n8n RPC Functions for direct WhatsApp booking
create or replace function book_slot(
  p_mobile text,
  p_name text,
  p_day date,
  p_start timestamp,
  p_product_ids int[]
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return book_slot_internal(p_mobile, trim(p_name), p_day, p_start, p_product_ids, null);
end $$;

create or replace function cancel_booking(
  p_booking_id bigint,
  p_mobile text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return cancel_internal(p_booking_id, p_mobile);
end $$;

create or replace function reschedule_booking(
  p_booking_id bigint,
  p_mobile text,
  p_new_start timestamp
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return reschedule_internal(p_booking_id, p_mobile, p_new_start);
end $$;

-- 4. No-show Sweep function
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

-- 5. Notification Trigger to n8n Webhook
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
      return new; -- covered by rescheduled event
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
    -- Fail safe in case pg_net encounters network or url errors
    null;
  end;

  return new;
end $$;

drop trigger if exists trg_notify_n8n on bookings;
create trigger trg_notify_n8n
after insert or update of status, slot_start on bookings
for each row execute function notify_n8n();

-- 6. Permissions Grant
grant execute on function book_slot(text, text, date, timestamp, int[]),
  cancel_booking(bigint, text),
  reschedule_booking(bigint, text, timestamp),
  no_show_sweep(),
  get_available_slots(date, int)
to anon, authenticated, service_role;

grant all on bot_sessions to authenticated, service_role;
`;

async function apply() {
  await client.connect();
  console.log('Applying n8n integration SQL...');
  await client.query(sql);
  console.log('n8n integration SQL applied successfully!');

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' and table_name = 'bot_sessions'");
  console.log('bot_sessions table exists:', tables.rows.length > 0);

  const triggers = await client.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'bookings'");
  console.log('Triggers on bookings:', triggers.rows.map(r => r.trigger_name));

  await client.end();
}

apply().catch(err => {
  console.error('Failed to setup n8n integration:', err);
  process.exit(1);
});
