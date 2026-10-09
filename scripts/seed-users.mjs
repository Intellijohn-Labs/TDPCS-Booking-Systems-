import pg from 'pg';

const { Client } = pg;

async function seedUsers() {
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.jktoipmsdvcnljogitos',
    password: process.env.PGPASSWORD || '',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const users = [
    { id: 'a1111111-1111-1111-1111-111111111112', email: 'admin@tdpcs.org', pass: 'admin123', name: 'System Administrator', role: 'admin' },
    { id: 'b2222222-2222-2222-2222-222222222221', email: 'staff@tdpcs.coop', pass: 'staff123', name: 'Branch Counter Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222222', email: 'staff@tdpcs.org', pass: 'staff123', name: 'Branch Counter Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222223', email: 'staff1@tdpcs.coop', pass: 'staff123', name: 'Counter 1 Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222225', email: 'staff2@tdpcs.coop', pass: 'staff123', name: 'Counter 2 Operator', role: 'staff' },
  ];

  for (const u of users) {
    console.log(`Upserting user: ${u.email}`);
    // Supabase Auth requires an entry in auth.users and auth.identities
    await client.query(`
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated',
        'authenticated',
        $2,
        crypt($3, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', $4::text, 'role', $5::text),
        now(),
        now(),
        ''
      )
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = crypt($3, gen_salt('bf')),
        email = $2,
        email_confirmed_at = now();
    `, [u.id, u.email, u.pass, u.name, u.role]);

    // Also create auth.identities record so GoTrue recognizes email login
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        $1::uuid,
        $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2::text),
        'email',
        $2::text,
        now(),
        now(),
        now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING;
    `, [u.id, u.email]);

    // Upsert into public.profiles
    await client.query(`
      INSERT INTO public.profiles (id, full_name, role, active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (id) DO UPDATE SET
        full_name = $2,
        role = $3,
        active = true;
    `, [u.id, u.name, u.role]);
  }

  const profiles = await client.query('SELECT * FROM public.profiles');
  console.log('Seeded profiles:', profiles.rows);

  await client.end();
}

seedUsers().catch(err => {
  console.error('Seed users error:', err);
  process.exit(1);
});
