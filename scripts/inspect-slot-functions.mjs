import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  for (const fn of ['reschedule_internal', 'reschedule_booking']) {
    const res = await client.query(`
      SELECT p.oid, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [fn]);
    console.log(`=== ${fn} ===`);
    console.log(res.rows[0]?.def);
  }

  await client.end();
}

run().catch(console.error);
