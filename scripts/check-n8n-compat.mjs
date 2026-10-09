import pg from 'pg';

const { Client } = pg;
const client = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.jktoipmsdvcnljogitos',
  password: process.env.PGPASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();

  const fns = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name");
  console.log('Public routines:', fns.rows.map(r => r.routine_name));

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Public tables:', tables.rows.map(r => r.table_name));

  await client.end();
}

check().catch(console.error);
