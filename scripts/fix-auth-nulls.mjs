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

  console.log('Updating auth.users empty string defaults...');
  await client.query(`
    UPDATE auth.users
    SET
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      phone_change_token = coalesce(phone_change_token, '')
    WHERE true;
  `);

  console.log('Checking auth.users:');
  const res = await client.query('SELECT email, confirmation_token, recovery_token, email_change FROM auth.users');
  console.log(res.rows);

  await client.end();
}

run().catch(console.error);
