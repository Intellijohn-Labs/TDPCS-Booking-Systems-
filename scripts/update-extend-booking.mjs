import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
create or replace function public.extend_booking(p_id bigint, p_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  v_next bookings%rowtype;
  v_max int;
  v_new_end timestamp;
  v_day_record open_days%rowtype;
  v_time_part time;
begin
  -- Check staff role
  if not is_staff() then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized: Only staff can extend bookings');
  end if;

  v_max := coalesce((select value::int from settings where key='max_extension'), 30);

  select * into b from bookings
  where id = p_id and status in ('booked', 'arrived', 'called')
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Booking not found or not active');
  end if;

  if b.extended_minutes + p_minutes > v_max then
    return jsonb_build_object(
      'ok', false,
      'error', 'Extension limit exceeded (Maximum ' || v_max || ' minutes allowed. Already extended ' || b.extended_minutes || 'm)'
    );
  end if;

  v_new_end := b.slot_end + make_interval(mins => p_minutes);

  -- Check if extending exceeds session closing hours
  select * into v_day_record from open_days where day = b.day;
  if found and v_day_record.status = 'open' then
    v_time_part := v_new_end::time;
    -- If booking is in morning session, cannot extend past s1_end (lunch break)
    if b.slot_end::time <= v_day_record.s1_end and v_time_part > v_day_record.s1_end then
      return jsonb_build_object(
        'ok', false,
        'error', 'Extension not possible: Cannot extend past Morning Session closing time (' || to_char(v_day_record.s1_end, 'HH12:MI AM') || ')'
      );
    end if;
    -- If booking is in afternoon session, cannot extend past s2_end
    if v_day_record.s2_end is not null and v_time_part > v_day_record.s2_end then
      return jsonb_build_object(
        'ok', false,
        'error', 'Extension not possible: Cannot extend past closing time (' || to_char(v_day_record.s2_end, 'HH12:MI AM') || ')'
      );
    end if;
  end if;

  -- Check if there is ANY conflicting booking on the same counter during the extension window
  select * into v_next
  from bookings
  where counter = b.counter
    and day = b.day
    and status in ('booked', 'arrived', 'called')
    and id <> b.id
    and slot_start < v_new_end
    and slot_end > b.slot_end
  order by slot_start asc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Extension not possible: Counter ' || b.counter || ' has booking ' || coalesce(v_next.token_no, '') || ' scheduled at ' || to_char(v_next.slot_start, 'HH12:MI AM')
    );
  end if;

  -- Update booking slot_end and extended_minutes directly without moving subsequent bookings
  update bookings
  set slot_end = v_new_end,
      extended_minutes = extended_minutes + p_minutes,
      updated_at = now()
  where id = b.id;

  insert into audit_log(actor, action, booking_id, details)
  values (
    coalesce(auth.uid()::text, 'staff'),
    'extend',
    p_id,
    jsonb_build_object('minutes', p_minutes, 'previous_end', b.slot_end, 'new_end', v_new_end)
  );

  return jsonb_build_object('ok', true, 'counter_free_from', v_new_end);
end;
$$;

grant execute on function public.extend_booking(bigint, int) to authenticated, anon, service_role;
`;

async function main() {
  await client.connect();
  console.log('Updating extend_booking on Supabase PostgreSQL...');
  await client.query(sql);
  console.log('Successfully updated extend_booking!');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
