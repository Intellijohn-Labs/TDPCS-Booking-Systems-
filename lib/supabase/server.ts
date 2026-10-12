import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSqliteMode, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from '@/lib/db/config';
import { executeQuery, executeRpc } from '@/lib/db/operations';
import { verifySessionToken } from '@/lib/db/auth';

class ServerLocalQueryBuilder {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private filters: any[] = [];
  private orderClauses: any[] = [];
  private limitCount?: number;
  private isSingle = false;
  private payload: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*') {
    this.action = 'select';
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(data: any) {
    this.action = 'upsert';
    this.payload = data;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ column, op: 'in', value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ column, op: 'ilike', value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderClauses.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async execute() {
    try {
      const data = executeQuery({
        table: this.table,
        action: this.action,
        filters: this.filters,
        order: this.orderClauses,
        limit: this.limitCount,
        single: this.isSingle,
        data: this.payload,
      });
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createClient(): any {
  if (isSqliteMode()) {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('tdpcs_session')?.value;
    const authUser = sessionToken ? verifySessionToken(sessionToken) : null;

    return {
      auth: {
        getUser: async () => {
          return {
            data: {
              user: authUser
                ? {
                    id: authUser.id,
                    email: authUser.email,
                    user_metadata: { full_name: authUser.full_name, role: authUser.role },
                  }
                : null,
            },
            error: null,
          };
        },
      },
      from: (table: string) => new ServerLocalQueryBuilder(table),
      rpc: async (func: string, args: any) => {
        try {
          const res = executeRpc(func, args);
          return { data: res, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
    };
  }

  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Can happen in Server Components if read-only
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Can happen in Server Components if read-only
        }
      },
    },
  });
}
