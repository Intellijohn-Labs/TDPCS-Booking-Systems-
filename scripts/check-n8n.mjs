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

async function run() {
  await client.connect();

  const trg = await client.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'bookings'");
  console.log('Triggers on bookings:', trg.rows);

  const settings = await client.query("SELECT key, value FROM settings");
  console.log('Settings:', settings.rows);

  const ext = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net'");
  console.log('pg_net extension:', ext.rows);

  await client.end();
}

run().catch(console.error);
