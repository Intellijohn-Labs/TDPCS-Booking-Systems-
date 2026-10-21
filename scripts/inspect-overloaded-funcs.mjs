import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  const res = await client.query(`
    SELECT proname, count(*) as cnt
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    GROUP BY proname
    HAVING count(*) > 1
  `);
  console.log('Overloaded functions in public schema:', res.rows);

  for (const row of res.rows) {
    const list = await client.query(`
      SELECT p.oid, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [row.proname]);
    console.log(`Overloads for ${row.proname}:`, list.rows);
  }

  await client.end();
}

run().catch(console.error);
