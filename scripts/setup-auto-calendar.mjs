import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Create or replace auto_generate_open_days function
create or replace function auto_generate_open_days(
  p_days_ahead int default 60,
  p_working_dows int[] default array[2, 4, 6]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_day date;
  v_dow int;
  v_inserted int := 0;
begin
  for i in 0..p_days_ahead loop
    v_day := v_today + i;
    v_dow := extract(isodow from v_day)::int; -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

    if (v_dow = any(p_working_dows)) then
      insert into open_days (day, status, s1_start, s1_end, s2_start, s2_end, note)
      values (v_day, 'open', '10:10', '12:30', '14:00', '17:00', 'Standard Working Day')
      on conflict (day) do update set
        s1_start = '10:10',
        s1_end = '12:30',
        s2_start = '14:00',
        s2_end = '17:00'
      where open_days.status = 'open';

      if found then
        v_inserted := v_inserted + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'days_checked', p_days_ahead,
    'days_inserted', v_inserted,
    'from_date', v_today,
    'to_date', v_today + p_days_ahead
  );
end $$;

grant execute on function auto_generate_open_days(int, int[]) to authenticated;
grant execute on function auto_generate_open_days(int, int[]) to anon;
grant execute on function auto_generate_open_days(int, int[]) to service_role;

-- 2. Update customer_init to automatically ensure open days exist if upcoming days are sparse
drop function if exists customer_init(uuid);
create or replace function customer_init(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l booking_links%rowtype;
  v_adv int;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_open_count int;
begin
  select * into l from booking_links where id = p_token and expires_at > now();
  if not found then return jsonb_build_object('ok',false,'error','link_expired'); end if;

  v_adv := coalesce((select value::int from settings where key='advance_days'),15);

  -- Check if open days exist ahead. If fewer than 3 open days exist in advance window, auto-generate them!
  select count(*) into v_open_count
    from open_days
   where status = 'open' and day between v_today and (v_today + v_adv);

  if v_open_count < 3 then
    perform auto_generate_open_days(greatest(v_adv * 2, 45));
  end if;

  return jsonb_build_object(
    'ok', true,
    'purpose', l.purpose,
    'mobile_masked', repeat('X', greatest(length(l.mobile)-4,0)) || right(l.mobile,4),
    'last_name', (select customer_name from bookings where mobile = l.mobile order by created_at desc limit 1),
    'dates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', day,
          's1_start', s1_start,
          's1_end', s1_end,
          's2_start', s2_start,
          's2_end', s2_end
        ) order by day
      )
      from open_days
      where status = 'open' and day between v_today and (v_today + v_adv)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'minutes', minutes)
        order by sort_order, id
      ) from products where active
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'token', token_no,
          'day', day,
          'slot_start', slot_start,
          'slot_end', slot_end,
          'counter', counter,
          'name', customer_name,
          'product_ids', product_ids,
          'minutes', total_minutes
        ) order by slot_start
      )
      from bookings
      where mobile = l.mobile and status = 'booked'
        and slot_start > (now() at time zone 'Asia/Kolkata')
    ), '[]'::jsonb)
  );
end $$;

grant execute on function customer_init(uuid) to anon;
grant execute on function customer_init(uuid) to authenticated;
grant execute on function customer_init(uuid) to service_role;

-- 3. Add auto_generate settings
insert into settings (key, value) values
  ('auto_generate_calendar', 'true'),
  ('auto_calendar_dows', '[2,4,6]')
on conflict (key) do nothing;
`;

async function run() {
  await client.connect();
  console.log('Connected to Supabase Postgres. Applying auto-calendar migration...');
  await client.query(sql);
  console.log('Migration applied! Testing auto_generate_open_days(60)...');
  const res = await client.query('SELECT auto_generate_open_days(60)');
  console.log('Result:', res.rows[0].auto_generate_open_days);

  const daysCheck = await client.query(`
    SELECT count(*) as total,
           min(day) as min_day,
           max(day) as max_day
    FROM open_days
    WHERE day >= (now() at time zone 'Asia/Kolkata')::date
  `);
  console.log('Upcoming open days status:', daysCheck.rows[0]);
  await client.end();
}

run().catch(console.error);
