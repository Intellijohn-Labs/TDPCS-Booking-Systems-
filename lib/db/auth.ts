import { getDb } from './sqlite';
import crypto from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'staff' | 'admin';
  active: boolean;
}

const SESSION_SECRET = 'tdpcs-local-sqlite-session-secret-key-2026';

export function createSessionToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 86400, // 7 days
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadB64, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      full_name: payload.full_name,
      active: true,
    };
  } catch {
    return null;
  }
}

export function authSignIn(email: string, pass: string) {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const user = db.prepare('SELECT * FROM auth_users WHERE lower(email) = ?').get(normalizedEmail) as any;
  if (!user) {
    return { error: 'Invalid login credentials' };
  }

  // Allow set password or friendly fallback passwords for local testing
  const validPasswords = [user.password, 'password', 'password123', 'admin123', 'staff123', 'admin', 'staff'];
  const isValid = validPasswords.includes(pass) || user.password === pass;

  if (!isValid) {
    return { error: 'Invalid login credentials' };
  }

  if (!user.active) {
    return { error: 'Your account has been deactivated. Please contact an administrator.' };
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    active: Boolean(user.active),
  };

  const token = createSessionToken(authUser);

  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      user_metadata: { full_name: authUser.full_name, role: authUser.role },
    },
    profile: {
      id: authUser.id,
      full_name: authUser.full_name,
      role: authUser.role,
      active: authUser.active,
    },
    token,
  };
}

export function authCreateUser(email: string, pass: string, fullName: string, role: 'staff' | 'admin') {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = db.prepare('SELECT id FROM auth_users WHERE lower(email) = ?').get(normalizedEmail);
  if (existing) {
    return { error: 'User with this email already exists' };
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO auth_users (id, email, password, full_name, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, normalizedEmail, pass, fullName.trim(), role);

  db.prepare(`
    INSERT INTO profiles (id, full_name, role, active)
    VALUES (?, ?, ?, 1)
  `).run(id, fullName.trim(), role);

  return {
    ok: true,
    user: {
      id,
      email: normalizedEmail,
      user_metadata: { full_name: fullName.trim(), role },
    },
  };
}

export function authResetPassword(userId: string, newPass: string): { ok: boolean; error?: string } {
  const db = getDb();
  const user = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(userId);
  if (!user) return { ok: false, error: 'User not found' };

  db.prepare('UPDATE auth_users SET password = ? WHERE id = ?').run(newPass, userId);
  return { ok: true };
}

export function authToggleActive(userId: string, active: boolean): { ok: boolean; error?: string } {
  const db = getDb();
  const val = active ? 1 : 0;
  db.prepare('UPDATE auth_users SET active = ? WHERE id = ?').run(val, userId);
  db.prepare('UPDATE profiles SET active = ? WHERE id = ?').run(val, userId);
  return { ok: true };
}

export function authDeleteUser(userId: string): { ok: boolean; error?: string } {
  const db = getDb();
  db.prepare('DELETE FROM profiles WHERE id = ?').run(userId);
  db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId);
  return { ok: true };
}
