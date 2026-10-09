import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function migrate() {
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.jktoipmsdvcnljogitos',
    password: process.env.PGPASSWORD || '',
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connecting to Supabase PostgreSQL database...');
  try {
    await client.connect();
    console.log('Connected successfully!');

    const sqlPath = path.join(process.cwd(), 'supabase', 'setup_complete.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running setup_complete.sql...');
    await client.query(sql);
    console.log('setup_complete.sql executed successfully!');

    // Verify products
    const resProducts = await client.query('SELECT count(*) FROM products');
    console.log('Products count:', resProducts.rows[0].count);

    // Verify open days
    const resDays = await client.query('SELECT count(*) FROM open_days');
    console.log('Open days count:', resDays.rows[0].count);

    // Verify booking links
    const resLinks = await client.query('SELECT count(*) FROM booking_links');
    console.log('Booking links count:', resLinks.rows[0].count);

    await client.end();
    console.log('Migration completed cleanly.');
  } catch (err) {
    console.error('Migration failed:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

migrate();
