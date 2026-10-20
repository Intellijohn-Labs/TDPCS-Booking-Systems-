import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Create or replace log_audit_event RPC function
create or replace function log_audit_event(
  p_action text,
  p_details jsonb default '{}'::jsonb,
  p_booking_id bigint default null,
  p_actor text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_log_id bigint;
begin
  if p_actor is not null and p_actor <> '' then
    v_actor := p_actor;
  elsif auth.uid() is not null then
    v_actor := auth.uid()::text;
  else
    v_actor := 'system';
  end if;

  insert into audit_log (actor, action, booking_id, details)
  values (v_actor, p_action, p_booking_id, p_details)
  returning id into v_log_id;

  return jsonb_build_object('ok', true, 'id', v_log_id);
end $$;

grant execute on function log_audit_event(text, jsonb, bigint, text) to authenticated;
grant execute on function log_audit_event(text, jsonb, bigint, text) to anon;
grant execute on function log_audit_event(text, jsonb, bigint, text) to service_role;

-- 2. Create purge_old_records_4months RPC function (4-month automatic retention for audit logs and bookings)
create or replace function purge_old_records_4months()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff_date date := ((now() at time zone 'Asia/Kolkata')::date - interval '4 months')::date;
  v_cutoff_timestamptz timestamptz := now() - interval '4 months';
  v_deleted_bookings int := 0;
  v_deleted_audit int := 0;
  v_deleted_links int := 0;
begin
  -- Purge expired booking links
  delete from booking_links where expires_at < now();
  get diagnostics v_deleted_links = row_count;

  -- Purge bookings older than 4 months
  delete from bookings where day < v_cutoff_date;
  get diagnostics v_deleted_bookings = row_count;

  -- Purge audit_log entries older than 4 months
  delete from audit_log where at < v_cutoff_timestamptz;
  get diagnostics v_deleted_audit = row_count;

  -- Log the retention purge event if any records were removed
  if (v_deleted_bookings > 0 or v_deleted_audit > 0 or v_deleted_links > 0) then
    insert into audit_log (actor, action, details)
    values (
      'system',
      'system:purge_4months',
      jsonb_build_object(
        'deleted_bookings', v_deleted_bookings,
        'deleted_audit_logs', v_deleted_audit,
        'deleted_links', v_deleted_links,
        'cutoff_date', v_cutoff_date,
        'cutoff_timestamp', v_cutoff_timestamptz
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'cutoff_date', v_cutoff_date,
    'cutoff_timestamp', v_cutoff_timestamptz,
    'deleted_bookings', v_deleted_bookings,
    'deleted_audit_logs', v_deleted_audit,
    'deleted_links', v_deleted_links
  );
end $$;

grant execute on function purge_old_records_4months() to authenticated;
grant execute on function purge_old_records_4months() to anon;
grant execute on function purge_old_records_4months() to service_role;

-- 3. Enhance reschedule_internal to log explicit reschedule audit entry
create or replace function reschedule_internal(p_id bigint, p_mobile text, p_new_start timestamp)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o bookings%rowtype;
  res jsonb;
  v_err text;
  v_new_id bigint;
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

  v_new_id := (res->>'booking_id')::bigint;

  -- Record explicit reschedule in audit_log
  insert into audit_log (actor, action, booking_id, details)
  values (
    'customer:' || p_mobile,
    'reschedule',
    v_new_id,
    jsonb_build_object(
      'previous_booking_id', o.id,
      'previous_token', o.token_no,
      'previous_slot_start', o.slot_start,
      'new_slot_start', p_new_start
    )
  );

  return res || jsonb_build_object('old_token', o.token_no, 'old_counter', o.counter,
                                   'old_slot_start', o.slot_start, 'old_slot_end', o.slot_end);
exception when raise_exception then
  return jsonb_build_object('ok', false, 'error', coalesce(v_err, 'slot_taken'));
end $$;

-- 4. Audit Log RLS Policies
drop policy if exists "staff and admin insert audit" on audit_log;
create policy "staff and admin insert audit" on audit_log for insert to authenticated with check (true);

drop policy if exists "admin delete audit" on audit_log;
create policy "admin delete audit" on audit_log for delete to authenticated using (is_admin());
`;

async function main() {
  await client.connect();
  console.log('Connected to Supabase Postgres. Applying audit and 4-month retention updates...');
  await client.query(sql);
  console.log('SQL applied successfully!');

  // Test purge function
  const purgeRes = await client.query('SELECT purge_old_records_4months()');
  console.log('purge_old_records_4months result:', purgeRes.rows[0].purge_old_records_4months);

  // Test audit event logger
  const testAudit = await client.query(`
    SELECT log_audit_event(
      'admin:system_init',
      '{"status": "4-month retention enabled", "modules": ["bookings", "audit_log", "admin_actions"]}'::jsonb,
      null,
      'system'
    )
  `);
  console.log('log_audit_event result:', testAudit.rows[0].log_audit_event);

  await client.end();
}

main().catch(console.error);
