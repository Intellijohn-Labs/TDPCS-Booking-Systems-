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

  console.log('Setting default gen_random_uuid()::text for booking_links.id...');
  await client.query(`
    alter table booking_links alter column id set default gen_random_uuid()::text;
    
    drop policy if exists "service_role manages booking_links" on booking_links;
    create policy "service_role manages booking_links" on booking_links for all using (true) with check (true);

    drop policy if exists "allow select booking_links" on booking_links;
    create policy "allow select booking_links" on booking_links for select using (true);

    drop policy if exists "allow insert booking_links" on booking_links;
    create policy "allow insert booking_links" on booking_links for insert with check (true);
  `);
  console.log('booking_links altered successfully!');

  // Test inserting without specifying id (as n8n does)
  const res = await client.query(`
    insert into booking_links (mobile, purpose, expires_at)
    values ('919876543210', 'book', now() + interval '30 minutes')
    returning id, mobile, purpose, expires_at;
  `);
  console.log('Test n8n insert into booking_links succeeded:', res.rows[0]);

  await client.end();
}

run().catch(console.error);
