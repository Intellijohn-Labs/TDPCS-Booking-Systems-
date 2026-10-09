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
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth'");
  console.log('Tables in auth schema:', tables.rows.map(r => r.table_name));

  const uCols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users'");
  console.log('Columns in auth.users:', uCols.rows);

  const iCols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'identities'");
  console.log('Columns in auth.identities:', iCols.rows);

  // Check grants on auth schema
  const grants = await client.query("SELECT grantee, privilege_type FROM information_schema.schema_privileges WHERE schema_name = 'auth'");
  console.log('Schema privileges on auth:', grants.rows);

  await client.end();
}

run().catch(console.error);
