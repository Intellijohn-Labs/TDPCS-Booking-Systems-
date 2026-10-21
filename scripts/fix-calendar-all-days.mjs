import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Redefine auto_generate_open_days with Mon-Sat (1, 2, 3, 4, 5, 6) default
create or replace function auto_generate_open_days(
  p_days_ahead int default 60,
  p_working_dows int[] default array[1, 2, 3, 4, 5, 6]
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

grant execute on function auto_generate_open_days(int, int[]) to authenticated, anon, service_role;

-- 2. Update advance_days in settings to 30 days (allows booking across the entire month)
update settings set value = '30' where key = 'advance_days';

-- 3. Update auto_calendar_dows setting
insert into settings (key, value) values ('auto_calendar_dows', '[1,2,3,4,5,6]')
on conflict (key) do update set value = '[1,2,3,4,5,6]';

-- 4. Execute auto-generation now for next 60 days on all working days (1..6)
select auto_generate_open_days(60, array[1, 2, 3, 4, 5, 6]);
`;

async function run() {
  await client.connect();
  console.log('Applying all-working-days calendar fix...');
  const res = await client.query(sql);
  console.log('Result:', res[res.length - 1].rows);

  const testInit = await client.query("SELECT customer_init('575ca597-a2db-44dc-8ab9-b87bbac9aef6')");
  const dates = testInit.rows[0].customer_init.dates;
  console.log(`customer_init now returns ${dates.length} available dates!`);
  console.log('Sample dates:', dates.slice(0, 5), '...', dates.slice(-3));

  await client.end();
}

run().catch(console.error);
