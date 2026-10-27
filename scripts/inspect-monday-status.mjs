import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  console.log('--- SETTINGS ---');
  const s = await client.query("SELECT * FROM settings WHERE key IN ('auto_calendar_dows', 'saturday_afternoon_session', 'advance_days')");
  console.log(s.rows);

  console.log('--- UPCOMING MONDAYS IN OPEN_DAYS ---');
  const m = await client.query(`
    SELECT day, to_char(day, 'Day') as day_name, extract(isodow from day) as dow, status, s1_start, s1_end, s2_start, s2_end, note
    FROM open_days
    WHERE day >= CURRENT_DATE AND extract(isodow from day) = 1
    ORDER BY day ASC
    LIMIT 10
  `);
  console.log(m.rows);

  console.log('--- ALL UPCOMING OPEN_DAYS (NEXT 15 DAYS) ---');
  const allDays = await client.query(`
    SELECT day, to_char(day, 'Dy') as dow, status, s1_start, s1_end, s2_start, s2_end, note
    FROM open_days
    WHERE day >= CURRENT_DATE
    ORDER BY day ASC
    LIMIT 20
  `);
  console.table(allDays.rows);

  await client.end();
}

run().catch(console.error);
