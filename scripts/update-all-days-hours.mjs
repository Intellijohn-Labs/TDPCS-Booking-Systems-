import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Update all existing open days to the new hours: 10:10 - 12:30 and 14:00 - 17:00
UPDATE open_days
SET s1_start = '10:10',
    s1_end = '12:30',
    s2_start = '14:00',
    s2_end = '17:00'
WHERE status = 'open';

-- 2. Update auto_generate_open_days RPC to use 10:10 - 12:30 and 14:00 - 17:00 for all open days
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

    if v_dow = any(p_working_dows) then
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
`;

async function main() {
  await client.connect();
  console.log('Connected to Supabase. Updating open_days hours...');
  await client.query(sql);

  const res = await client.query(`
    SELECT status, s1_start, s1_end, s2_start, s2_end, count(*)
    FROM open_days
    GROUP BY status, s1_start, s1_end, s2_start, s2_end
  `);
  console.log('Updated open_days distribution:');
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
