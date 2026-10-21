import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT to_char(day, 'YYYY-MM-DD') as date_str, to_char(day, 'Dy') as dow, status, s1_start, s1_end, s2_start, s2_end
    FROM open_days
    WHERE day >= '2026-10-21'
    ORDER BY day
    LIMIT 35
  `);
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
