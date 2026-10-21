import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- Drop the overloaded uuid version
DROP FUNCTION IF EXISTS public.customer_init(uuid);

-- Ensure customer_init(p_token text) is the single canonical function
CREATE OR REPLACE FUNCTION public.customer_init(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  l booking_links%rowtype;
  v_adv int;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_open_count int;
begin
  select * into l from booking_links where id = p_token and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;

  v_adv := coalesce((select value::int from settings where key='advance_days'), 15);

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
    'mobile_masked', repeat('X', greatest(length(l.mobile)-4, 0)) || right(l.mobile, 4),
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
end $function$;

GRANT EXECUTE ON FUNCTION public.customer_init(text) TO anon, authenticated, service_role;
`;

async function run() {
  await client.connect();
  console.log('Applying customer_init fix...');
  await client.query(sql);
  console.log('Fix applied successfully!');
  await client.end();
}

run().catch(console.error);
