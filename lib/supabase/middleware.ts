import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSqliteMode } from '@/lib/db/config';

function getLocalUserFromCookie(request: NextRequest) {
  try {
    const token = request.cookies.get('tdpcs_session')?.value;
    if (!token || !token.includes('.')) return null;
    const [payloadB64] = token.split('.');
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle SQLite local mode
  if (isSqliteMode()) {
    const localUser = getLocalUserFromCookie(request);

    // Protect /app routes
    if (pathname.startsWith('/app')) {
      if (!localUser) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Role-based protection for /app/admin
      if (pathname.startsWith('/app/admin')) {
        if (localUser.role !== 'admin') {
          return NextResponse.redirect(new URL('/app/dashboard', request.url));
        }
      }
    }

    // If logged-in user visits /login, redirect to /app/dashboard
    if (pathname === '/login' && localUser) {
      return NextResponse.redirect(new URL('/app/dashboard', request.url));
    }

    return NextResponse.next();
  }

  // Supabase Mode
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-anon-key';

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /app routes
  if (pathname.startsWith('/app')) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Role-based protection for /app/admin
    if (pathname.startsWith('/app/admin')) {
      const userRole = user.user_metadata?.role;
      if (userRole) {
        if (userRole !== 'admin') {
          return NextResponse.redirect(new URL('/app/dashboard', request.url));
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, active')
          .eq('id', user.id)
          .single();

        const userProfile = profile as { role: string; active: boolean } | null;
        if (!userProfile || !userProfile.active || userProfile.role !== 'admin') {
          return NextResponse.redirect(new URL('/app/dashboard', request.url));
        }
      }
    }
  }

  // If logged-in user visits /login, redirect to /app/dashboard
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  return response;
}
