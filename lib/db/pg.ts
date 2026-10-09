import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured in environment variables');
    }

    poolInstance = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return poolInstance;
}

export async function createUserPg(email: string, pass: string, fullName: string, role: string) {
  const pool = getPgPool();
  const normalizedEmail = email.toLowerCase().trim();
  const id = crypto.randomUUID();

  await pool.query(
    `
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
  `,
    [id, normalizedEmail, pass, fullName.trim(), role]
  );

  await pool.query(
    `
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
  `,
    [id, normalizedEmail]
  );

  await pool.query(
    `
    INSERT INTO public.profiles (id, full_name, role, active)
    VALUES ($1, $2, $3, true)
    ON CONFLICT (id) DO UPDATE SET full_name = $2, role = $3, active = true;
  `,
    [id, fullName.trim(), role]
  );

  return { ok: true, id };
}

export async function resetUserPasswordPg(userId: string, newPassword: string) {
  const pool = getPgPool();
  await pool.query(
    `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = now() WHERE id = $2`,
    [newPassword, userId]
  );
  return { ok: true };
}

export async function toggleUserActivePg(userId: string, active: boolean) {
  const pool = getPgPool();
  await pool.query('UPDATE public.profiles SET active = $1 WHERE id = $2', [active, userId]);
  return { ok: true };
}

export async function deleteUserPg(userId: string) {
  const pool = getPgPool();
  await pool.query('DELETE FROM public.profiles WHERE id = $1', [userId]);
  await pool.query('DELETE FROM auth.identities WHERE user_id = $1::uuid', [userId]);
  await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  return { ok: true };
}
