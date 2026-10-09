export function isSqliteMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_SQLITE === 'true') return true;
  if (process.env.NEXT_PUBLIC_USE_SQLITE === 'false') return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder') || url.includes('your-project')) {
    return true;
  }
  return false;
}
