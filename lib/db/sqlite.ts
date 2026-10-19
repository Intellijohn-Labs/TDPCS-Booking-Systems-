import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'tdpcs.sqlite');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchemaAndSeed(dbInstance);
  }
  return dbInstance;
}

function initSchemaAndSeed(db: DatabaseSync) {
  // Execute table creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      minutes INTEGER NOT NULL CHECK (minutes > 0),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS open_days (
      day TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked')),
      s1_start TEXT,
      s1_end TEXT,
      s2_start TEXT,
      s2_end TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_counters (
      day TEXT PRIMARY KEY,
      last_no INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS booking_links (
      id TEXT PRIMARY KEY,
      mobile TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('book', 'manage')),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_no TEXT NOT NULL,
      day TEXT NOT NULL,
      customer_name TEXT,
      mobile TEXT NOT NULL,
      product_ids TEXT NOT NULL,
      total_minutes INTEGER NOT NULL,
      counter INTEGER NOT NULL CHECK (counter IN (1, 2)),
      slot_start TEXT NOT NULL,
      slot_end TEXT NOT NULL,
      report_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'arrived', 'called', 'served', 'cancelled', 'no_show')),
      extended_minutes INTEGER NOT NULL DEFAULT 0,
      cancel_reason TEXT,
      rescheduled_from INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT,
      UNIQUE (day, token_no)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT,
      action TEXT NOT NULL,
      booking_id INTEGER,
      details TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // 1. Seed Users (staff & admin)
  const defaultUsers = [
    { id: 'a1111111-1111-1111-1111-111111111111', email: 'admin@tdpcs.coop', pass: 'admin123', name: 'System Administrator', role: 'admin' },
    { id: 'a1111111-1111-1111-1111-111111111112', email: 'admin@tdpcs.org', pass: 'admin123', name: 'System Administrator', role: 'admin' },
    { id: 'b2222222-2222-2222-2222-222222222221', email: 'staff@tdpcs.coop', pass: 'staff123', name: 'Branch Counter Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222222', email: 'staff@tdpcs.org', pass: 'staff123', name: 'Branch Counter Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222223', email: 'staff1@tdpcs.coop', pass: 'staff123', name: 'Counter 1 Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222224', email: 'staff1@tdpcs.org', pass: 'staff123', name: 'Counter 1 Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222225', email: 'staff2@tdpcs.coop', pass: 'staff123', name: 'Counter 2 Operator', role: 'staff' },
    { id: 'b2222222-2222-2222-2222-222222222226', email: 'staff2@tdpcs.org', pass: 'staff123', name: 'Counter 2 Operator', role: 'staff' },
  ];

  for (const u of defaultUsers) {
    db.prepare(`
      INSERT OR REPLACE INTO auth_users (id, email, password, full_name, role, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(u.id, u.email, u.pass, u.name, u.role);
    db.prepare(`
      INSERT OR REPLACE INTO profiles (id, full_name, role, active)
      VALUES (?, ?, ?, 1)
    `).run(u.id, u.name, u.role);
  }

  // 2. Seed Products
  const prodCount = (db.prepare('SELECT count(*) as count FROM products').get() as any)?.count || 0;
  if (prodCount === 0) {
    const insertProd = db.prepare('INSERT INTO products (name, minutes, sort_order) VALUES (?, ?, ?)');
    insertProd.run('Simple Loan', 20, 1);
    insertProd.run('Emergency Loan', 5, 2);
    insertProd.run('Education Loan', 5, 3);
    insertProd.run('Professional Edu. Loan', 15, 4);
    insertProd.run('Vehicle Loan', 20, 5);
    insertProd.run('Hire Purchase Loan', 15, 6);
    insertProd.run('Chitty Prized Withdrawal', 10, 7);
  }

  // 3. Seed Settings
  const settingsCount = (db.prepare('SELECT count(*) as count FROM settings').get() as any)?.count || 0;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('slot_step', '5');
    insertSetting.run('report_buffer', '10');
    insertSetting.run('max_extension', '30');
    insertSetting.run('advance_days', '15');
    insertSetting.run('client_notify_number', '914712345678');
    insertSetting.run('n8n_webhook_url', '');
  }

  // 4. Seed Open Days (ensure current 30 days have open slots)
  const daysCount = (db.prepare('SELECT count(*) as count FROM open_days').get() as any)?.count || 0;
  if (daysCount === 0) {
    const insertDay = db.prepare(`
      INSERT OR IGNORE INTO open_days (day, status, s1_start, s1_end, s2_start, s2_end, note)
      VALUES (?, 'open', ?, ?, ?, ?, ?)
    `);

    const today = new Date();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayStr = d.toISOString().split('T')[0];
      const dow = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat

      // Working hours: Morning 10:10 - 12:30, Afternoon 14:00 - 17:00
      if (i === 0 || i === 1 || dow === 2 || dow === 4 || dow === 6) {
        insertDay.run(dayStr, '10:10', '12:30', '14:00', '17:00', 'Society Working Day');
      }
    }
  }

  // Ensure all existing open_days have the specified working hours: 10:10-12:30 and 14:00-17:00
  db.exec("UPDATE open_days SET s1_start = '10:10', s1_end = '12:30', s2_start = '14:00', s2_end = '17:00' WHERE status = 'open';");

  // 5. Seed Demo Booking Links (for WhatsApp test links & multiple persona testing)
  const defaultLinks = [
    { id: 'demo-booking-token', mobile: '919876543210', purpose: 'book' },
    { id: 'demo-user-1', mobile: '919876543211', purpose: 'book' },
    { id: 'demo-user-2', mobile: '919876543212', purpose: 'book' },
    { id: 'demo-user-3', mobile: '919876543213', purpose: 'book' },
    { id: 'demo-user-4', mobile: '919876543214', purpose: 'book' },
    { id: 'demo-user-5', mobile: '919876543215', purpose: 'book' },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', mobile: '919876543210', purpose: 'book' },
    { id: 'demo-manage-token', mobile: '919876543210', purpose: 'manage' },
  ];
  for (const l of defaultLinks) {
    db.prepare(`
      INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at)
      VALUES (?, ?, ?, datetime('now', '+30 days'))
    `).run(l.id, l.mobile, l.purpose);
  }

  // 6. Seed Demo Bookings if empty (for live monitor and queue terminal demo)
  const bookingsCount = (db.prepare('SELECT count(*) as count FROM bookings').get() as any)?.count || 0;
  if (bookingsCount === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const insertBk = db.prepare(`
      INSERT INTO bookings (token_no, day, customer_name, mobile, product_ids, total_minutes, counter, slot_start, slot_end, report_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBk.run('T-001', todayStr, 'K. Radhakrishnan', '919876543210', '[1]', 20, 1, `${todayStr}T10:00:00`, `${todayStr}T10:20:00`, `${todayStr}T09:50:00`, 'arrived');
    insertBk.run('T-002', todayStr, 'Sujatha Kumari', '919447123456', '[5]', 20, 2, `${todayStr}T10:00:00`, `${todayStr}T10:20:00`, `${todayStr}T09:50:00`, 'called');
    insertBk.run('T-003', todayStr, 'M. Anilkumar', '919846011223', '[2, 3]', 10, 1, `${todayStr}T10:20:00`, `${todayStr}T10:30:00`, `${todayStr}T10:10:00`, 'booked');
    db.prepare('INSERT OR REPLACE INTO token_counters (day, last_no) VALUES (?, 3)').run(todayStr);
  }
}
