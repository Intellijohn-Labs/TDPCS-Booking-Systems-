import { createBrowserClient } from '@supabase/ssr';
import { isSqliteMode } from '@/lib/db/config';

class LocalQueryBuilder {
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
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          options: {
            table: this.table,
            action: this.action,
            filters: this.filters,
            order: this.orderClauses,
            limit: this.limitCount,
            single: this.isSingle,
            data: this.payload,
          },
        }),
      });
      const json = await res.json();
      return { data: json.data, error: json.error };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const localAuth = {
  async signInWithPassword({ email, password }: any) {
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth_sign_in', email, password }),
      });
      const json = await res.json();
      return { data: json.data || { user: null, session: null }, error: json.error };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  },
  async signOut() {
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth_sign_out' }),
      });
      const json = await res.json();
      return { error: json.error };
    } catch (err: any) {
      return { error: { message: err.message } };
    }
  },
  async getUser() {
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth_get_user' }),
      });
      const json = await res.json();
      return { data: json.data || { user: null }, error: json.error };
    } catch (err: any) {
      return { data: { user: null }, error: { message: err.message } };
    }
  },
  async getSession() {
    const { data, error } = await this.getUser();
    return {
      data: {
        session: data?.user ? { user: data.user, access_token: 'local-session-token' } : null,
      },
      error,
    };
  },
  onAuthStateChange(_callback: any) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

async function localRpc(functionName: string, args: any) {
  try {
    const res = await fetch('/api/local-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rpc', functionName, args }),
    });
    const json = await res.json();
    return { data: json.data, error: json.error };
  } catch (err: any) {
    return { data: null, error: { message: err.message } };
  }
}

function localChannel(_name: string) {
  return {
    on(_event: string, _filter: any, _callback: any) {
      return this;
    },
    subscribe() {
      return this;
    },
    unsubscribe() {
      return Promise.resolve('ok');
    },
  };
}

let sqliteClientInstance: any = null;
let browserClientInstance: any = null;

export function createClient(): any {
  if (isSqliteMode()) {
    if (!sqliteClientInstance) {
      sqliteClientInstance = {
        from: (table: string) => new LocalQueryBuilder(table),
        rpc: localRpc,
        auth: localAuth,
        channel: localChannel,
        removeChannel: (_ch: any) => Promise.resolve('ok'),
        removeAllChannels: () => Promise.resolve([]),
        getChannels: () => [],
      };
    }
    return sqliteClientInstance;
  }

  if (!browserClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'placeholder-anon-key';
    browserClientInstance = createBrowserClient(url, anonKey);
  }
  return browserClientInstance;
}
