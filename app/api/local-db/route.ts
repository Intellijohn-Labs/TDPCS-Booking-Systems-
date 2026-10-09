import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeRpc } from '@/lib/db/operations';
import { authSignIn, verifySessionToken } from '@/lib/db/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Auth Sign In
    if (action === 'auth_sign_in') {
      const { email, password } = body;
      const res = authSignIn(email, password);
      if (res.error || !res.token) {
        return NextResponse.json({ data: null, error: { message: res.error || 'Login failed' } }, { status: 400 });
      }

      const response = NextResponse.json({
        data: {
          user: res.user,
          session: { access_token: res.token, user: res.user },
        },
        error: null,
      });

      // Set session cookie
      response.cookies.set('tdpcs_session', res.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 86400,
      });

      return response;
    }

    // 2. Auth Sign Out
    if (action === 'auth_sign_out') {
      const response = NextResponse.json({ error: null });
      response.cookies.set('tdpcs_session', '', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 0,
      });
      return response;
    }

    // 3. Auth Get User
    if (action === 'auth_get_user') {
      const token = req.cookies.get('tdpcs_session')?.value;
      if (!token) {
        return NextResponse.json({ data: { user: null }, error: null });
      }
      const user = verifySessionToken(token);
      return NextResponse.json({
        data: {
          user: user
            ? {
                id: user.id,
                email: user.email,
                user_metadata: { full_name: user.full_name, role: user.role },
              }
            : null,
        },
        error: null,
      });
    }

    // 4. RPC
    if (action === 'rpc') {
      const { functionName, args } = body;
      const rpcResult = executeRpc(functionName, args);
      return NextResponse.json({ data: rpcResult, error: null });
    }

    // 5. Database queries
    if (action === 'query') {
      const { options } = body;
      const queryResult = executeQuery(options);
      return NextResponse.json({ data: queryResult, error: null });
    }

    return NextResponse.json({ error: { message: 'Invalid action' } }, { status: 400 });
  } catch (err: any) {
    console.error('API /api/local-db error:', err);
    return NextResponse.json({ data: null, error: { message: err.message || 'Server error' } }, { status: 500 });
  }
}
