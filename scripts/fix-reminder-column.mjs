import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyDbFix() {
  await client.connect();
  console.log('1. Adding reminder_sent column to bookings table...');
  await client.query(`
    ALTER TABLE public.bookings 
    ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  console.log('2. Creating index idx_bookings_reminder...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bookings_reminder 
    ON public.bookings (day, status, reminder_sent);
  `);

  console.log('3. Verifying column addition...');
  const res = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'reminder_sent';
  `);
  console.log('Verified column:', res.rows[0]);

  await client.end();
}

applyDbFix().catch(console.error);
