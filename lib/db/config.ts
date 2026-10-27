export const DEFAULT_SUPABASE_URL = 'https://jktoipmsdvcnljogitos.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_7PCJ9vSzaa8ZvH9hSYCkEg_ZH2PAi51';

export function getEffectiveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder') || url.includes('your-project') || url.includes('example.supabase.co')) {
    return DEFAULT_SUPABASE_URL;
  }
  return url;
}

export function getEffectiveSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.includes('placeholder') || key.includes('your_') || key.includes('your-anon')) {
    return DEFAULT_SUPABASE_ANON_KEY;
  }
  return key;
}

export function isSqliteMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_SQLITE === 'true') return true;
  if (process.env.NEXT_PUBLIC_USE_SQLITE === 'false') return false;

  // On Vercel or cloud production, SQLite should never run by default
  // (Serverless lambdas have read-only filesystems without persistent SQLite database files)
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder') || url.includes('your-project')) {
    return true;
  }
  return false;
}
