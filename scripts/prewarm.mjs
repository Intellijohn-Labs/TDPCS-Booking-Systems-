async function prewarm() {
  console.log('Logging in to get session cookie...');
  const loginRes = await fetch('http://localhost:3002/login');
  
  // Use supabase auth directly to get cookies
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    'https://jktoipmsdvcnljogitos.supabase.co',
    'sb_publishable_7PCJ9vSzaa8ZvH9hSYCkEg_ZH2PAi51'
  );
  const { data: authData } = await sb.auth.signInWithPassword({
    email: 'admin@tdpcs.org',
    password: 'admin123'
  });

  const session = authData.session;
  const cookieHeader = `sb-jktoipmsdvcnljogitos-auth-token=${encodeURIComponent(JSON.stringify(session))}`;

  const routes = [
    '/app/dashboard',
    '/app/queue',
    '/app/bookings',
    '/app/admin/calendar',
    '/app/admin/products',
    '/app/admin/settings',
    '/app/admin/users',
    '/app/admin/reports',
    '/app/admin/audit'
  ];

  for (const r of routes) {
    const t0 = Date.now();
    console.log(`Pre-warming ${r}...`);
    const res = await fetch(`http://localhost:3002${r}`, {
      headers: {
        'Cookie': cookieHeader
      }
    });
    console.log(`  -> ${r} status: ${res.status} (${Date.now() - t0}ms)`);
  }
}

prewarm().catch(console.error);
