import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { isSqliteMode, DEFAULT_SUPABASE_URL } from '@/lib/db/config';
import {
  createUserPg,
  resetUserPasswordPg,
  toggleUserActivePg,
  deleteUserPg,
} from '@/lib/db/pg';

export async function POST(request: Request) {
  try {
    // 1. Authenticate calling user using server session
    const serverSupabase = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if calling user is an active admin
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    const userProfile = profile as { role: string; active: boolean } | null;

    if (!userProfile || userProfile.role !== 'admin' || !userProfile.active) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Handle SQLite Mode
    if (isSqliteMode()) {
      const { authCreateUser, authResetPassword, authToggleActive, authDeleteUser } = await import('@/lib/db/auth');

      if (action === 'create-user') {
        const { email, password, fullName, role } = body;
        if (!email || !password || !fullName || !role) {
          return NextResponse.json(
            { error: 'Missing required fields (email, password, fullName, role)' },
            { status: 400 }
          );
        }
        if (!['staff', 'admin'].includes(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        const res = authCreateUser(email, password, fullName, role);
        if (res.error) {
          return NextResponse.json({ error: res.error }, { status: 400 });
        }
        await logUserAudit(user.email || user.id, 'admin:create_user', { email, fullName, role, userId: res.user?.id });
        return NextResponse.json({ ok: true, user: res.user });
      }

      if (action === 'reset-password') {
        const { userId, newPassword } = body;
        if (!userId || !newPassword) {
          return NextResponse.json({ error: 'Missing userId or newPassword' }, { status: 400 });
        }
        const res = authResetPassword(userId, newPassword);
        if (res.error) {
          return NextResponse.json({ error: res.error }, { status: 400 });
        }
        await logUserAudit(user.email || user.id, 'admin:reset_password', { userId });
        return NextResponse.json({ ok: true });
      }

      if (action === 'toggle-active') {
        const { userId, active } = body;
        if (!userId || typeof active !== 'boolean') {
          return NextResponse.json({ error: 'Missing userId or active boolean' }, { status: 400 });
        }
        if (userId === user.id) {
          return NextResponse.json(
            { error: 'You cannot deactivate your own admin account' },
            { status: 400 }
          );
        }
        const res = authToggleActive(userId, active);
        if (res.error) {
          return NextResponse.json({ error: res.error }, { status: 400 });
        }
        await logUserAudit(user.email || user.id, 'admin:toggle_user_active', { userId, active });
        return NextResponse.json({ ok: true });
      }

      if (action === 'delete-user') {
        const { userId } = body;
        if (!userId) {
          return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }
        if (userId === user.id) {
          return NextResponse.json(
            { error: 'You cannot delete your own admin account' },
            { status: 400 }
          );
        }
        const res = authDeleteUser(userId);
        if (res.error) {
          return NextResponse.json({ error: res.error }, { status: 400 });
        }
        await logUserAudit(user.email || user.id, 'admin:delete_user', { userId });
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // 3. Supabase / Postgres Mode
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const hasServiceRoleKey =
      serviceRoleKey &&
      !serviceRoleKey.includes('placeholder') &&
      serviceRoleKey.trim().length > 20;

    if (action === 'create-user') {
      const { email, password, fullName, role } = body;
      if (!email || !password || !fullName || !role) {
        return NextResponse.json(
          { error: 'Missing required fields (email, password, fullName, role)' },
          { status: 400 }
        );
      }
      if (!['staff', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      if (hasServiceRoleKey) {
        try {
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
          });

          if (!createError && newUser?.user) {
            await adminClient.from('profiles').upsert({
              id: newUser.user.id,
              full_name: fullName,
              role,
              active: true,
            });
            await logUserAudit(user.email || user.id, 'admin:create_user', { email, fullName, role, userId: newUser.user.id });
            return NextResponse.json({ ok: true, user: newUser.user });
          }
        } catch {
          // fallback to PG direct
        }
      }

      // Postgres direct pool
      const result = await createUserPg(email, password, fullName, role);
      await logUserAudit(user.email || user.id, 'admin:create_user', { email, fullName, role, userId: result.id });
      return NextResponse.json({ ok: true, user: { id: result.id, email } });
    }

    if (action === 'reset-password') {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) {
        return NextResponse.json({ error: 'Missing userId or newPassword' }, { status: 400 });
      }

      if (hasServiceRoleKey) {
        try {
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
            password: newPassword,
          });
          if (!updateError) {
            await logUserAudit(user.email || user.id, 'admin:reset_password', { userId });
            return NextResponse.json({ ok: true });
          }
        } catch {
          // fallback to PG direct
        }
      }

      await resetUserPasswordPg(userId, newPassword);
      await logUserAudit(user.email || user.id, 'admin:reset_password', { userId });
      return NextResponse.json({ ok: true });
    }

    if (action === 'toggle-active') {
      const { userId, active } = body;
      if (!userId || typeof active !== 'boolean') {
        return NextResponse.json({ error: 'Missing userId or active boolean' }, { status: 400 });
      }

      if (userId === user.id) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own admin account' },
          { status: 400 }
        );
      }

      if (hasServiceRoleKey) {
        try {
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { error: updateError } = await adminClient
            .from('profiles')
            .update({ active })
            .eq('id', userId);
          if (!updateError) {
            await logUserAudit(user.email || user.id, 'admin:toggle_user_active', { userId, active });
            return NextResponse.json({ ok: true });
          }
        } catch {
          // fallback
        }
      }

      await toggleUserActivePg(userId, active);
      await logUserAudit(user.email || user.id, 'admin:toggle_user_active', { userId, active });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete-user') {
      const { userId } = body;
      if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      }

      if (userId === user.id) {
        return NextResponse.json(
          { error: 'You cannot delete your own admin account' },
          { status: 400 }
        );
      }

      if (hasServiceRoleKey) {
        try {
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await adminClient.auth.admin.deleteUser(userId);
          await adminClient.from('profiles').delete().eq('id', userId);
          await logUserAudit(user.email || user.id, 'admin:delete_user', { userId });
          return NextResponse.json({ ok: true });
        } catch {
          // fallback to PG
        }
      }

      await deleteUserPg(userId);
      await logUserAudit(user.email || user.id, 'admin:delete_user', { userId });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

async function logUserAudit(actor: string, action: string, details: Record<string, any>) {
  try {
    if (isSqliteMode()) {
      const { getDb } = await import('@/lib/db/sqlite');
      const db = getDb();
      db.prepare(`
        INSERT INTO audit_log (actor, action, details)
        VALUES (?, ?, ?)
      `).run(actor, action, JSON.stringify(details));
    } else {
      const serverSupabase = createServerSupabase();
      await (serverSupabase.rpc as any)('log_audit_event', {
        p_action: action,
        p_details: details,
        p_actor: actor,
      });
    }
  } catch (err) {
    console.error('Failed to log user audit:', err);
  }
}
