import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Ensure settings exist for weekly 3 days and Saturday afternoon toggle
insert into settings (key, value)
values 
  ('auto_calendar_dows', '[2,4,6]'),
  ('saturday_afternoon_session', 'false')
on conflict (key) do update set
  value = excluded.value
where settings.key in ('auto_calendar_dows', 'saturday_afternoon_session');

-- 2. Redefine auto_generate_open_days to respect auto_calendar_dows and saturday_afternoon_session
create or replace function public.auto_generate_open_days(
  p_days_ahead integer default 60,
  p_working_dows integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_day date;
  v_dow int;
  v_inserted int := 0;
  v_dows int[];
  v_sat_pm boolean;
  v_s2_start time;
  v_s2_end time;
  v_note text;
begin
  -- Resolve working DOWs: use parameter if provided, otherwise fetch from settings, fallback to [2,4,6]
  if p_working_dows is not null and array_length(p_working_dows, 1) > 0 then
    v_dows := p_working_dows;
  else
    select coalesce(
      (select array_agg(elem::int) from jsonb_array_elements_text(coalesce((select value::jsonb from settings where key='auto_calendar_dows'), '[2,4,6]'::jsonb)) as elem),
      array[2, 4, 6]
    ) into v_dows;
  end if;

  -- Check Saturday afternoon setting (default false)
  select coalesce((select value = 'true' from settings where key='saturday_afternoon_session'), false) into v_sat_pm;

  for i in 0..p_days_ahead loop
    v_day := v_today + i;
    v_dow := extract(isodow from v_day)::int; -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

    if (v_dow = any(v_dows)) then
      if v_dow = 6 then
        if v_sat_pm then
          v_s2_start := '14:00'::time;
          v_s2_end := '17:00'::time;
          v_note := 'Saturday (Full Day)';
        else
          v_s2_start := null;
          v_s2_end := null;
          v_note := 'Saturday (Morning Only 10:10-12:30)';
        end if;
      else
        v_s2_start := '14:00'::time;
        v_s2_end := '17:00'::time;
        v_note := 'Standard Working Day';
      end if;

      insert into open_days (day, status, s1_start, s1_end, s2_start, s2_end, note)
      values (v_day, 'open', '10:10'::time, '12:30'::time, v_s2_start, v_s2_end, v_note)
      on conflict (day) do update set
        status = 'open',
        s1_start = '10:10'::time,
        s1_end = '12:30'::time,
        s2_start = excluded.s2_start,
        s2_end = excluded.s2_end,
        note = excluded.note
      where open_days.status = 'open' or open_days.note like 'Closed (%';

      if found then
        v_inserted := v_inserted + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'days_checked', p_days_ahead,
    'days_inserted', v_inserted,
    'working_dows', v_dows,
    'saturday_afternoon', v_sat_pm,
    'from_date', v_today,
    'to_date', v_today + p_days_ahead
  );
end $function$;

grant execute on function public.auto_generate_open_days(integer, integer[]) to authenticated, anon, service_role;

-- 3. Create sync_working_schedule function for Admin UI
create or replace function public.sync_working_schedule(
  p_working_dows integer[] default array[2, 4, 6],
  p_sat_afternoon boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_updated_open int := 0;
  v_updated_blocked int := 0;
  v_auto_res jsonb;
begin
  -- 1. Save settings
  insert into settings (key, value)
  values ('auto_calendar_dows', to_jsonb(p_working_dows)::text)
  on conflict (key) do update set value = to_jsonb(p_working_dows)::text;

  insert into settings (key, value)
  values ('saturday_afternoon_session', case when p_sat_afternoon then 'true' else 'false' end)
  on conflict (key) do update set value = case when p_sat_afternoon then 'true' else 'false' end;

  -- 2. Open active working days in upcoming calendar
  update open_days
     set status = 'open',
         s1_start = '10:10'::time,
         s1_end = '12:30'::time,
         s2_start = case
           when extract(isodow from day)::int = 6 then
             case when p_sat_afternoon then '14:00'::time else null::time end
           else '14:00'::time
         end,
         s2_end = case
           when extract(isodow from day)::int = 6 then
             case when p_sat_afternoon then '17:00'::time else null::time end
           else '17:00'::time
         end,
         note = case
           when extract(isodow from day)::int = 6 then
             case when p_sat_afternoon then 'Saturday (Full Day)' else 'Saturday (Morning Only 10:10-12:30)' end
           else 'Standard Working Day'
         end
   where day >= v_today
     and extract(isodow from day)::int = any(p_working_dows);

  get diagnostics v_updated_open = row_count;

  -- 3. Block non-working days that don't have active member bookings
  update open_days
     set status = 'blocked',
         s1_start = null,
         s1_end = null,
         s2_start = null,
         s2_end = null,
         note = 'Closed (Non-working day)'
   where day >= v_today
     and extract(isodow from day)::int <> all(p_working_dows)
     and status = 'open'
     and not exists (
       select 1 from bookings b
       where b.day = open_days.day
         and b.status in ('booked', 'arrived', 'called')
     );

  get diagnostics v_updated_blocked = row_count;

  -- 4. Automatically generate future open dates up to 60 days ahead
  select auto_generate_open_days(60, p_working_dows) into v_auto_res;

  return jsonb_build_object(
    'ok', true,
    'working_dows', p_working_dows,
    'saturday_afternoon', p_sat_afternoon,
    'updated_open_days', v_updated_open,
    'blocked_closed_days', v_updated_blocked,
    'auto_generation', v_auto_res
  );
end $function$;

grant execute on function public.sync_working_schedule(integer[], boolean) to authenticated, anon, service_role;
`;

async function main() {
  await client.connect();
  console.log('Applying weekly 3-days and Saturday afternoon session toggle functions...');
  await client.query(sql);

  // Sync now with default 3 days (Tuesday 2, Thursday 4, Saturday 6) and Saturday afternoon = false
  console.log('Syncing schedule: [2, 4, 6] (Tue, Thu, Sat) with Saturday afternoon = false...');
  const res = await client.query('SELECT sync_working_schedule(ARRAY[2, 4, 6], false)');
  console.log('Result:', JSON.stringify(res.rows[0].sync_working_schedule, null, 2));

  // Check upcoming open days
  const check = await client.query(`
    select day, to_char(day, 'Dy') as dow_name, extract(isodow from day) as dow, status, s1_start, s1_end, s2_start, s2_end, note
    from open_days
    where day >= (now() at time zone 'Asia/Kolkata')::date
      and status = 'open'
    order by day
    limit 10
  `);
  console.log('Upcoming OPEN days:');
  console.table(check.rows);

  await client.end();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
