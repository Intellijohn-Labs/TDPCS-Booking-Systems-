export const DEFAULT_SUPABASE_URL = 'https://jktoipmsdvcnljogitos.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_7PCJ9vSzaa8ZvH9hSYCkEg_ZH2PAi51';

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
