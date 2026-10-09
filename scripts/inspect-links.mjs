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

  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'booking_links'
  `);
  console.log('Columns in booking_links:', cols.rows);

  const policies = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'booking_links'
  `);
  console.log('Policies on booking_links:', policies.rows);

  await client.end();
}

run().catch(console.error);
