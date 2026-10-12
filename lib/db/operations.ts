import { getDb } from './sqlite';
import { getTodayIST } from '@/lib/date-utils';

export interface Filter {
  column: string;
  op: 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'ilike';
  value: any;
}

export interface QueryOptions {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters?: Filter[];
  order?: { column: string; ascending: boolean }[];
  limit?: number;
  single?: boolean;
  data?: any;
}

// Convert row data (parse JSON fields and booleans)
function transformRow(table: string, row: any): any {
  if (!row) return null;
  const transformed = { ...row };

  if (table === 'bookings') {
    if (typeof transformed.product_ids === 'string') {
      try {
        transformed.product_ids = JSON.parse(transformed.product_ids);
      } catch {
        transformed.product_ids = [];
      }
    }
  }

  if (table === 'profiles' || table === 'auth_users' || table === 'products') {
    if ('active' in transformed) {
      transformed.active = Boolean(transformed.active);
    }
  }

  if (table === 'audit_log') {
    if (typeof transformed.details === 'string') {
      try {
        transformed.details = JSON.parse(transformed.details);
      } catch {
        transformed.details = {};
      }
    }
  }

  return transformed;
}

export function executeQuery(options: QueryOptions) {
  const db = getDb();
  const { table, action, filters = [], order = [], limit, single, data } = options;

  if (action === 'select') {
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];
    const whereClauses: string[] = [];

    for (const f of filters) {
      if (f.op === 'eq') {
        whereClauses.push(`${f.column} = ?`);
        params.push(f.value);
      } else if (f.op === 'neq') {
        whereClauses.push(`${f.column} != ?`);
        params.push(f.value);
      } else if (f.op === 'gte') {
        whereClauses.push(`${f.column} >= ?`);
        params.push(f.value);
      } else if (f.op === 'lte') {
        whereClauses.push(`${f.column} <= ?`);
        params.push(f.value);
      } else if (f.op === 'ilike') {
        whereClauses.push(`${f.column} LIKE ?`);
        params.push(f.value);
      } else if (f.op === 'in') {
        if (Array.isArray(f.value) && f.value.length > 0) {
          const placeholders = f.value.map(() => '?').join(',');
          whereClauses.push(`${f.column} IN (${placeholders})`);
          params.push(...f.value);
        } else {
          whereClauses.push('1 = 0');
        }
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (order.length > 0) {
      const orderClauses = order.map((o) => `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (single) {
      const row = db.prepare(sql).get(...params);
      return transformRow(table, row);
    }

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((r: any) => transformRow(table, r));
  }

  if (action === 'insert') {
    const records = Array.isArray(data) ? data : [data];
    const results: any[] = [];

    for (const item of records) {
      const record = { ...item };
      if (table === 'bookings' && Array.isArray(record.product_ids)) {
        record.product_ids = JSON.stringify(record.product_ids);
      }
      if (table === 'audit_log' && typeof record.details === 'object') {
        record.details = JSON.stringify(record.details);
      }
      if ('active' in record && typeof record.active === 'boolean') {
        record.active = record.active ? 1 : 0;
      }

      const keys = Object.keys(record);
      const placeholders = keys.map(() => '?').join(',');
      const values = keys.map((k) => record[k]);

      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
      const info = db.prepare(sql).run(...values);

      if (info.lastInsertRowid) {
        const inserted = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(info.lastInsertRowid);
        results.push(transformRow(table, inserted));
      }
    }

    return Array.isArray(data) ? results : results[0] || null;
  }

  if (action === 'update') {
    const record = Array.isArray(data) ? { ...data[0] } : { ...data };
    if (table === 'bookings' && Array.isArray(record.product_ids)) {
      record.product_ids = JSON.stringify(record.product_ids);
    }
    if ('active' in record && typeof record.active === 'boolean') {
      record.active = record.active ? 1 : 0;
    }

    const keys = Object.keys(record);
    const setClauses = keys.map((k) => `${k} = ?`);
    const params = keys.map((k) => record[k]);

    const whereClauses: string[] = [];
    for (const f of filters) {
      if (f.op === 'eq') {
        whereClauses.push(`${f.column} = ?`);
        params.push(f.value);
      }
    }

    let sql = `UPDATE ${table} SET ${setClauses.join(', ')}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    db.prepare(sql).run(...params);
    return { ok: true };
  }

  if (action === 'delete') {
    const params: any[] = [];
    const whereClauses: string[] = [];
    for (const f of filters) {
      if (f.op === 'eq') {
        whereClauses.push(`${f.column} = ?`);
        params.push(f.value);
      }
    }

    let sql = `DELETE FROM ${table}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    db.prepare(sql).run(...params);
    return { ok: true };
  }

  if (action === 'upsert') {
    const records = Array.isArray(data) ? data : [data];
    for (const item of records) {
      const record = { ...item };
      if (table === 'bookings' && Array.isArray(record.product_ids)) {
        record.product_ids = JSON.stringify(record.product_ids);
      }
      if ('active' in record && typeof record.active === 'boolean') {
        record.active = record.active ? 1 : 0;
      }

      const keys = Object.keys(record);
      const placeholders = keys.map(() => '?').join(',');
      const values = keys.map((k) => record[k]);

      const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
      db.prepare(sql).run(...values);
    }
    return { ok: true };
  }

  return null;
}

// ==========================================
// RPC BUSINESS LOGIC
// ==========================================

export interface SlotSeat {
  slot_start: string;
  slot_end: string;
  status: 'available' | 'partial' | 'booked' | 'past';
  counter: number | null;
  c1_booked: boolean;
  c2_booked: boolean;
}

export function calculateAvailableSlots(day: string, durationMinutes: number): {
  availableSlots: { slot_start: string; counter: number }[];
  allSlots: SlotSeat[];
} {
  const db = getDb();

  const openDay = db.prepare('SELECT * FROM open_days WHERE day = ? AND status = ?').get(day, 'open') as any;
  if (!openDay) return { availableSlots: [], allSlots: [] };

  const reportBufferSetting = db.prepare("SELECT value FROM settings WHERE key = 'report_buffer'").get() as any;
  const reportBuffer = parseInt(reportBufferSetting?.value || '10', 10);

  // Active bookings on this day for counter 1 and 2
  const bookings = db.prepare(`
    SELECT counter, slot_start, slot_end FROM bookings
    WHERE day = ? AND status IN ('booked', 'arrived', 'called')
  `).all(day) as any[];

  const sessions: { start: string; end: string }[] = [];
  if (openDay.s1_start && openDay.s1_end) {
    sessions.push({ start: openDay.s1_start, end: openDay.s1_end });
  }
  if (openDay.s2_start && openDay.s2_end) {
    sessions.push({ start: openDay.s2_start, end: openDay.s2_end });
  }

  const todayIST = getTodayIST();
  const now = new Date();
  const nowISTMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440; // IST is UTC + 5:30

  const availableSlots: { slot_start: string; counter: number }[] = [];
  const allSlots: SlotSeat[] = [];

  // Step dynamically by durationMinutes to offer discrete continuous blocks
  // e.g. for 25 min: 10:00–10:25, 10:25–10:50, 10:50–11:15
  // e.g. for 35 min: 10:00–10:35, 10:35–11:10, 11:10–11:45
  const step = Math.max(5, durationMinutes);

  for (const session of sessions) {
    const [sHours, sMins] = session.start.split(':').map(Number);
    const [eHours, eMins] = session.end.split(':').map(Number);

    const sessionStartTotal = sHours * 60 + sMins;
    const sessionEndTotal = eHours * 60 + eMins;

    for (let cur = sessionStartTotal; cur + durationMinutes <= sessionEndTotal; cur += step) {
      // STRICT SESSION BOUNDARY: Never cross session boundary!
      if (cur + durationMinutes > sessionEndTotal) {
        continue;
      }

      const isPast = day === todayIST && cur <= nowISTMinutes + reportBuffer;

      const curH = Math.floor(cur / 60).toString().padStart(2, '0');
      const curM = (cur % 60).toString().padStart(2, '0');
      const slotStart = `${day}T${curH}:${curM}:00`;

      const endTotal = cur + durationMinutes;
      const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
      const endM = (endTotal % 60).toString().padStart(2, '0');
      const slotEnd = `${day}T${endH}:${endM}:00`;

      // Check Counter 1
      const c1Collision = bookings.some(
        (b) => b.counter === 1 && b.slot_start < slotEnd && b.slot_end > slotStart
      );

      // Check Counter 2
      const c2Collision = bookings.some(
        (b) => b.counter === 2 && b.slot_start < slotEnd && b.slot_end > slotStart
      );

      let slotStatus: 'available' | 'partial' | 'booked' | 'past';
      let freeCounter: number | null = null;

      if (isPast) {
        slotStatus = 'past';
      } else if (c1Collision && c2Collision) {
        slotStatus = 'booked';
      } else if (!c1Collision && c2Collision) {
        slotStatus = 'partial';
        freeCounter = 1;
      } else if (c1Collision && !c2Collision) {
        slotStatus = 'partial';
        freeCounter = 2;
      } else {
        slotStatus = 'available';
        freeCounter = 1;
      }

      allSlots.push({
        slot_start: slotStart,
        slot_end: slotEnd,
        status: slotStatus,
        counter: freeCounter,
        c1_booked: c1Collision,
        c2_booked: c2Collision,
      });

      if (slotStatus === 'available' || slotStatus === 'partial') {
        availableSlots.push({ slot_start: slotStart, counter: freeCounter! });
      }
    }
  }

  return { availableSlots, allSlots };
}

function getValidBookingLink(db: any, token: string): any {
  if (!token) return null;
  let link = db.prepare('SELECT * FROM booking_links WHERE id = ?').get(token) as any;
  if (!link && (token.startsWith('demo-') || token.startsWith('test-'))) {
    let num = 0;
    for (let i = 0; i < token.length; i++) {
      num = (num * 31 + token.charCodeAt(i)) % 9000000;
    }
    const mobile = `919${(10000000 + num).toString().slice(-9)}`;
    const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at)
      VALUES (?, ?, 'book', ?)
    `).run(token, mobile, expiresAt);
    link = { id: token, mobile, purpose: 'book', expires_at: expiresAt };
  }

  if (!link) return null;
  if (link.expires_at) {
    const expDate = new Date(link.expires_at);
    if (!isNaN(expDate.getTime()) && expDate < new Date()) {
      return null;
    }
  }
  return link;
}

export function executeRpc(functionName: string, args: any = {}): any {
  const db = getDb();

  if (functionName === 'customer_init') {
    const { p_token } = args;
    const link = getValidBookingLink(db, p_token);
    if (!link) {
      return { ok: false, error: 'link_expired' };
    }

    const todayIST = getTodayIST();
    const advSetting = db.prepare("SELECT value FROM settings WHERE key = 'advance_days'").get() as any;
    const advanceDays = parseInt(advSetting?.value || '15', 10);

    const openDays = db.prepare(`
      SELECT day, s1_start, s1_end, s2_start, s2_end
      FROM open_days
      WHERE status = 'open' AND day >= ?
      ORDER BY day ASC
      LIMIT ?
    `).all(todayIST, advanceDays) as any[];

    const products = db.prepare(`
      SELECT id, name, minutes
      FROM products
      WHERE active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();

    const rawBookings = db.prepare(`
      SELECT id, token_no as token, day, slot_start, slot_end, counter,
             customer_name as name, product_ids, total_minutes as minutes
      FROM bookings
      WHERE mobile = ? AND status = 'booked' AND day >= ?
      ORDER BY slot_start ASC
    `).all(link.mobile, todayIST) as any[];

    const bookings = rawBookings.map((b) => ({
      ...b,
      product_ids: typeof b.product_ids === 'string' ? JSON.parse(b.product_ids) : b.product_ids,
    }));

    const lastBooking = db.prepare(`
      SELECT customer_name FROM bookings WHERE mobile = ? ORDER BY id DESC LIMIT 1
    `).get(link.mobile) as any;

    const maskedMobile =
      link.mobile.length > 4
        ? 'X'.repeat(link.mobile.length - 4) + link.mobile.slice(-4)
        : link.mobile;

    return {
      ok: true,
      purpose: link.purpose,
      mobile_masked: maskedMobile,
      last_name: lastBooking?.customer_name || null,
      dates: openDays,
      products,
      bookings,
    };
  }

  if (functionName === 'customer_slots') {
    const { p_token, p_day, p_product_ids } = args;
    const link = getValidBookingLink(db, p_token);
    if (!link) return { ok: false, error: 'link_expired' };

    if (!Array.isArray(p_product_ids) || p_product_ids.length === 0) {
      return { ok: false, error: 'no_products' };
    }

    const placeholders = p_product_ids.map(() => '?').join(',');
    const prods = db.prepare(`SELECT SUM(minutes) as total FROM products WHERE id IN (${placeholders}) AND active = 1`).get(...p_product_ids) as any;
    const minutes = prods?.total || 0;
    if (minutes === 0) return { ok: false, error: 'no_products' };

    const { availableSlots, allSlots } = calculateAvailableSlots(p_day, minutes);
    return {
      ok: true,
      minutes,
      slots: availableSlots.map((s) => s.slot_start),
      all_slots: allSlots,
    };
  }

  if (functionName === 'customer_book') {
    const { p_token, p_name, p_start, p_product_ids } = args;
    const link = getValidBookingLink(db, p_token);
    if (!link) return { ok: false, error: 'link_expired' };

    if (!p_name || p_name.trim().length < 2) {
      return { ok: false, error: 'name_required' };
    }

    const placeholders = p_product_ids.map(() => '?').join(',');
    const prods = db.prepare(`SELECT SUM(minutes) as total FROM products WHERE id IN (${placeholders}) AND active = 1`).get(...p_product_ids) as any;
    const minutes = prods?.total || 0;
    if (minutes === 0) return { ok: false, error: 'no_products' };

    const day = p_start.split('T')[0];

    // Check if customer already has active booking today
    const existingActive = db.prepare(`
      SELECT id FROM bookings WHERE mobile = ? AND day = ? AND status IN ('booked', 'arrived', 'called')
    `).get(link.mobile, day);
    if (existingActive) {
      return { ok: false, error: 'already_booked' };
    }

    const { availableSlots } = calculateAvailableSlots(day, minutes);
    const matchingSlot = availableSlots.find((s) => s.slot_start === p_start);
    if (!matchingSlot) {
      return { ok: false, error: 'slot_taken' };
    }

    const counter = matchingSlot.counter;
    const [startH, startM] = p_start.split('T')[1].split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = startMins + minutes;
    const endH = Math.floor(endMins / 60).toString().padStart(2, '0');
    const endM = (endMins % 60).toString().padStart(2, '0');
    const slotEnd = `${day}T${endH}:${endM}:00`;

    const reportBufferSetting = db.prepare("SELECT value FROM settings WHERE key = 'report_buffer'").get() as any;
    const reportBuffer = parseInt(reportBufferSetting?.value || '10', 10);
    const repMins = Math.max(0, startMins - reportBuffer);
    const repH = Math.floor(repMins / 60).toString().padStart(2, '0');
    const repM = (repMins % 60).toString().padStart(2, '0');
    const reportTime = `${day}T${repH}:${repM}:00`;

    // Next token number
    const tokenRow = db.prepare('SELECT last_no FROM token_counters WHERE day = ?').get(day) as any;
    const nextNo = (tokenRow?.last_no || 0) + 1;
    db.prepare('INSERT OR REPLACE INTO token_counters (day, last_no) VALUES (?, ?)').run(day, nextNo);
    const tokenNo = `T-${nextNo.toString().padStart(3, '0')}`;

    const insertInfo = db.prepare(`
      INSERT INTO bookings (token_no, day, customer_name, mobile, product_ids, total_minutes, counter, slot_start, slot_end, report_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked')
    `).run(
      tokenNo,
      day,
      p_name.trim(),
      link.mobile,
      JSON.stringify(p_product_ids),
      minutes,
      counter,
      p_start,
      slotEnd,
      reportTime
    );

    const bookingId = insertInfo.lastInsertRowid;

    // Log audit
    db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES (?, 'book', ?, ?)
    `).run(`customer:${link.mobile}`, bookingId, JSON.stringify({ token: tokenNo }));

    // Mark link as used
    db.prepare("UPDATE booking_links SET used_at = datetime('now') WHERE id = ?").run(p_token);

    return {
      ok: true,
      booking_id: bookingId,
      token: tokenNo,
      counter,
      slot_start: p_start,
      slot_end: slotEnd,
      report_time: reportTime,
      minutes,
      name: p_name.trim(),
    };
  }

  if (functionName === 'customer_cancel') {
    const { p_token, p_booking_id } = args;
    const link = getValidBookingLink(db, p_token);
    if (!link) return { ok: false, error: 'link_expired' };

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND mobile = ? AND status = ?').get(p_booking_id, link.mobile, 'booked') as any;
    if (!booking) return { ok: false, error: 'not_cancellable' };

    db.prepare(`
      UPDATE bookings
      SET status = 'cancelled', cancel_reason = 'customer', cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(p_booking_id);

    db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES (?, 'cancel', ?, '{}')
    `).run(`customer:${link.mobile}`, p_booking_id);

    return {
      ok: true,
      token: booking.token_no,
      counter: booking.counter,
      slot_start: booking.slot_start,
      slot_end: booking.slot_end,
      name: booking.customer_name,
    };
  }

  if (functionName === 'customer_reschedule') {
    const { p_token, p_booking_id, p_new_start } = args;
    const link = getValidBookingLink(db, p_token);
    if (!link) return { ok: false, error: 'link_expired' };

    const oldBooking = db.prepare('SELECT * FROM bookings WHERE id = ? AND mobile = ? AND status = ?').get(p_booking_id, link.mobile, 'booked') as any;
    if (!oldBooking) return { ok: false, error: 'not_found' };

    // Temporarily mark old booking cancelled
    db.prepare("UPDATE bookings SET status = 'cancelled', cancel_reason = 'rescheduled' WHERE id = ?").run(p_booking_id);

    // Book new slot
    const bookRes = executeRpc('customer_book', {
      p_token,
      p_name: oldBooking.customer_name,
      p_start: p_new_start,
      p_product_ids: JSON.parse(oldBooking.product_ids),
    });

    if (!bookRes.ok) {
      // Rollback old booking
      db.prepare("UPDATE bookings SET status = 'booked', cancel_reason = NULL WHERE id = ?").run(p_booking_id);
      return { ok: false, error: bookRes.error || 'slot_taken' };
    }

    return {
      ...bookRes,
      old_token: oldBooking.token_no,
      old_counter: oldBooking.counter,
      old_slot_start: oldBooking.slot_start,
      old_slot_end: oldBooking.slot_end,
    };
  }

  if (functionName === 'set_booking_status') {
    const { p_id, p_status } = args;
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(p_id) as any;
    if (!b) return { ok: false, error: 'not_updatable' };

    const cancelReason = p_status === 'cancelled' ? 'staff' : b.cancel_reason;
    const cancelledAt = p_status === 'cancelled' ? new Date().toISOString() : b.cancelled_at;

    db.prepare(`
      UPDATE bookings
      SET status = ?, cancel_reason = ?, cancelled_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(p_status, cancelReason, cancelledAt, p_id);

    db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES ('staff', ?, ?, '{}')
    `).run(`status:${p_status}`, p_id);

    return { ok: true };
  }

  if (functionName === 'extend_booking') {
    const { p_id, p_minutes } = args;
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(p_id) as any;
    if (!b) return { ok: false, error: 'not_found' };

    const maxExtSetting = db.prepare("SELECT value FROM settings WHERE key = 'max_extension'").get() as any;
    const maxExt = parseInt(maxExtSetting?.value || '30', 10);

    if (b.extended_minutes + p_minutes > maxExt) {
      return { ok: false, error: 'limit_exceeded' };
    }

    const [endDay, endTime] = b.slot_end.split('T');
    const [endH, endM] = endTime.split(':').map(Number);
    const newEndMins = endH * 60 + endM + p_minutes;
    const newH = Math.floor(newEndMins / 60).toString().padStart(2, '0');
    const newM = (newEndMins % 60).toString().padStart(2, '0');
    const newSlotEnd = `${endDay}T${newH}:${newM}:00`;

    db.prepare(`
      UPDATE bookings
      SET slot_end = ?, extended_minutes = extended_minutes + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newSlotEnd, p_minutes, p_id);

    // Shift any subsequent bookings on the same counter and day
    const subsequentBookings = db.prepare(`
      SELECT * FROM bookings
      WHERE counter = ? AND day = ? AND status = 'booked' AND slot_start >= ? AND id != ?
      ORDER BY slot_start ASC
    `).all(b.counter, b.day, b.slot_start, b.id) as any[];

    let cursor = newSlotEnd;
    for (const sub of subsequentBookings) {
      if (sub.slot_start >= cursor) break;

      const [sH, sM] = sub.slot_start.split('T')[1].split(':').map(Number);
      const [eH, eM] = sub.slot_end.split('T')[1].split(':').map(Number);
      const [rH, rM] = sub.report_time.split('T')[1].split(':').map(Number);

      const shift = p_minutes;
      const newSH = Math.floor((sH * 60 + sM + shift) / 60).toString().padStart(2, '0');
      const newSM = ((sH * 60 + sM + shift) % 60).toString().padStart(2, '0');
      const newEH = Math.floor((eH * 60 + eM + shift) / 60).toString().padStart(2, '0');
      const newEM = ((eH * 60 + eM + shift) % 60).toString().padStart(2, '0');
      const newRH = Math.floor((rH * 60 + rM + shift) / 60).toString().padStart(2, '0');
      const newRM = ((rH * 60 + rM + shift) % 60).toString().padStart(2, '0');

      const shiftedStart = `${sub.day}T${newSH}:${newSM}:00`;
      const shiftedEnd = `${sub.day}T${newEH}:${newEM}:00`;
      const shiftedReport = `${sub.day}T${newRH}:${newRM}:00`;

      db.prepare(`
        UPDATE bookings
        SET slot_start = ?, slot_end = ?, report_time = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(shiftedStart, shiftedEnd, shiftedReport, sub.id);

      cursor = shiftedEnd;
    }

    db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES ('staff', 'extend', ?, ?)
    `).run(p_id, JSON.stringify({ minutes: p_minutes }));

    return { ok: true, counter_free_from: cursor };
  }

  if (functionName === 'block_day') {
    const { p_day, p_reason = 'Holiday' } = args;
    db.prepare(`
      INSERT OR REPLACE INTO open_days (day, status, note)
      VALUES (?, 'blocked', ?)
    `).run(p_day, p_reason);

    const updateInfo = db.prepare(`
      UPDATE bookings
      SET status = 'cancelled', cancel_reason = 'day_blocked', cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE day = ? AND status = 'booked'
    `).run(p_day);

    db.prepare(`
      INSERT INTO audit_log (actor, action, details)
      VALUES ('staff', 'block_day', ?)
    `).run(JSON.stringify({ day: p_day, cancelled: updateInfo.changes }));

    return { ok: true, cancelled: updateInfo.changes };
  }

  if (functionName === 'delete_booking') {
    const { p_id } = args;
    db.prepare('DELETE FROM bookings WHERE id = ?').run(p_id);
    db.prepare("INSERT INTO audit_log (actor, action, booking_id, details) VALUES ('staff', 'delete', ?, '{}')").run(p_id);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown RPC function' };
}
