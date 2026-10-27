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

      const isPast = day === todayIST && cur <= nowISTMinutes + Math.max(reportBuffer, 30);

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

    let openDays = db.prepare(`
      SELECT day, s1_start, s1_end, s2_start, s2_end
      FROM open_days
      WHERE status = 'open' AND day >= ?
      ORDER BY day ASC
      LIMIT ?
    `).all(todayIST, advanceDays) as any[];

    if (openDays.length < 3) {
      autoGenerateOpenDaysSqlite(db, Math.max(advanceDays * 2, 45));
      openDays = db.prepare(`
        SELECT day, s1_start, s1_end, s2_start, s2_end
        FROM open_days
        WHERE status = 'open' AND day >= ?
        ORDER BY day ASC
        LIMIT ?
      `).all(todayIST, advanceDays) as any[];
    }

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

    const todayIST = getTodayIST();
    const now = new Date();
    const nowISTMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
    const [startHCheck, startMCheck] = p_start.split('T')[1].split(':').map(Number);
    const startMinsCheck = startHCheck * 60 + startMCheck;
    if (day === todayIST && startMinsCheck <= nowISTMinutes + 30) {
      return { ok: false, error: 'slot_cutoff_passed' };
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
      return { ok: false, error: `Extension limit exceeded (Maximum ${maxExt} minutes allowed)` };
    }

    const [endDay, endTime] = b.slot_end.split('T');
    const [endH, endM] = endTime.split(':').map(Number);
    const newEndMins = endH * 60 + endM + p_minutes;
    const newH = Math.floor(newEndMins / 60).toString().padStart(2, '0');
    const newM = (newEndMins % 60).toString().padStart(2, '0');
    const newSlotEnd = `${endDay}T${newH}:${newM}:00`;

    // Check if extending exceeds session closing hours
    const dayRecord = db.prepare('SELECT * FROM open_days WHERE day = ?').get(b.day) as any;
    if (dayRecord && dayRecord.status === 'open') {
      const timePart = `${newH}:${newM}`;
      if (dayRecord.s1_end && endTime.substring(0, 5) <= dayRecord.s1_end && timePart > dayRecord.s1_end) {
        return {
          ok: false,
          error: `Extension not possible: Cannot extend past Morning Session closing time (${dayRecord.s1_end})`,
        };
      }
      if (dayRecord.s2_end && timePart > dayRecord.s2_end) {
        return {
          ok: false,
          error: `Extension not possible: Cannot extend past closing time (${dayRecord.s2_end})`,
        };
      }
    }

    // Check if there is ANY conflicting booking on the same counter during the extension window
    const conflictBooking = db.prepare(`
      SELECT * FROM bookings
      WHERE counter = ? AND day = ? AND status IN ('booked', 'arrived', 'called') AND id != ?
        AND slot_start < ? AND slot_end > ?
      ORDER BY slot_start ASC
      LIMIT 1
    `).get(b.counter, b.day, b.id, newSlotEnd, b.slot_end) as any;

    if (conflictBooking) {
      const conflictTime = conflictBooking.slot_start.includes('T')
        ? conflictBooking.slot_start.split('T')[1].substring(0, 5)
        : conflictBooking.slot_start.substring(0, 5);
      return {
        ok: false,
        error: `Extension not possible: Counter ${b.counter} has booking ${conflictBooking.token_no || ''} scheduled at ${conflictTime}`,
      };
    }

    db.prepare(`
      UPDATE bookings
      SET slot_end = ?, extended_minutes = extended_minutes + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newSlotEnd, p_minutes, p_id);

    db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES ('staff', 'extend', ?, ?)
    `).run(p_id, JSON.stringify({ minutes: p_minutes, new_slot_end: newSlotEnd }));

    return { ok: true, counter_free_from: newSlotEnd };
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

  if (functionName === 'auto_generate_open_days') {
    const { p_days_ahead = 60, p_working_dows = null } = args;
    return autoGenerateOpenDaysSqlite(db, p_days_ahead, p_working_dows);
  }

  if (functionName === 'sync_working_schedule') {
    const { p_working_dows = [2, 4, 6], p_sat_afternoon = false } = args;
    return syncWorkingScheduleSqlite(db, p_working_dows, p_sat_afternoon);
  }

  if (functionName === 'log_audit_event') {
    const { p_action, p_details = {}, p_booking_id = null, p_actor = 'system' } = args;
    const res = db.prepare(`
      INSERT INTO audit_log (actor, action, booking_id, details)
      VALUES (?, ?, ?, ?)
    `).run(p_actor, p_action, p_booking_id, JSON.stringify(p_details));
    return { ok: true, id: res.lastInsertRowid };
  }

  if (functionName === 'purge_old_records_4months') {
    const linksRes = db.prepare("DELETE FROM booking_links WHERE expires_at < datetime('now')").run();
    const bookingsRes = db.prepare("DELETE FROM bookings WHERE day < date('now', '-4 months')").run();
    const auditRes = db.prepare("DELETE FROM audit_log WHERE at < datetime('now', '-4 months')").run();

    if (bookingsRes.changes > 0 || auditRes.changes > 0 || linksRes.changes > 0) {
      db.prepare(`
        INSERT INTO audit_log (actor, action, details)
        VALUES ('system', 'system:purge_4months', ?)
      `).run(JSON.stringify({
        deleted_bookings: bookingsRes.changes,
        deleted_audit_logs: auditRes.changes,
        deleted_links: linksRes.changes,
      }));
    }

    return {
      ok: true,
      deleted_bookings: bookingsRes.changes,
      deleted_audit_logs: auditRes.changes,
      deleted_links: linksRes.changes,
    };
  }

  return { ok: false, error: 'Unknown RPC function' };
}

function autoGenerateOpenDaysSqlite(
  db: any,
  daysAhead: number = 60,
  workingDows: number[] | null = null
) {
  let dows = workingDows;
  if (!dows || dows.length === 0) {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'auto_calendar_dows'").get();
      if (row?.value) {
        dows = JSON.parse(row.value);
      }
    } catch {
      // ignore
    }
  }
  if (!dows || dows.length === 0) {
    dows = [2, 4, 6];
  }

  let satAfternoon = false;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'saturday_afternoon_session'").get();
    satAfternoon = row?.value === 'true';
  } catch {
    // ignore
  }

  const upsertDay = db.prepare(`
    INSERT INTO open_days (day, status, s1_start, s1_end, s2_start, s2_end, note)
    VALUES (?, 'open', '10:10', '12:30', ?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET
      status = 'open',
      s1_start = '10:10',
      s1_end = '12:30',
      s2_start = excluded.s2_start,
      s2_end = excluded.s2_end,
      note = excluded.note
    WHERE open_days.status = 'open' OR open_days.note LIKE 'Closed (%'
  `);

  const today = new Date();
  let inserted = 0;
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayStr = d.toISOString().split('T')[0];
    const dow = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
    const isodow = dow === 0 ? 7 : dow; // 1=Mon, ..., 6=Sat, 7=Sun

    if (dows.includes(isodow)) {
      const isSat = isodow === 6;
      const s2Start = isSat ? (satAfternoon ? '14:00' : null) : '14:00';
      const s2End = isSat ? (satAfternoon ? '17:00' : null) : '17:00';
      const note = isSat
        ? (satAfternoon ? 'Saturday (Full Day)' : 'Saturday (Morning Only 10:10-12:30)')
        : 'Standard Working Day';

      const res = upsertDay.run(dayStr, s2Start, s2End, note);
      if (res.changes > 0) inserted++;
    }
  }

  return {
    ok: true,
    days_checked: daysAhead,
    days_inserted: inserted,
    working_dows: dows,
    saturday_afternoon: satAfternoon,
    from_date: today.toISOString().split('T')[0],
  };
}

function syncWorkingScheduleSqlite(
  db: any,
  workingDows: number[] = [2, 4, 6],
  satAfternoon: boolean = false
) {
  try {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('auto_calendar_dows', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(workingDows));

    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('saturday_afternoon_session', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(satAfternoon ? 'true' : 'false');
  } catch (e) {
    console.error('Error saving settings in syncWorkingScheduleSqlite', e);
  }

  const today = new Date().toISOString().split('T')[0];

  // Update existing upcoming open days
  const allFuture = db.prepare("SELECT day, status FROM open_days WHERE day >= ?").all(today);
  let updatedOpen = 0;
  let updatedBlocked = 0;

  const updateOpenStmt = db.prepare(`
    UPDATE open_days
    SET status = 'open', s1_start = '10:10', s1_end = '12:30', s2_start = ?, s2_end = ?, note = ?
    WHERE day = ?
  `);

  const blockStmt = db.prepare(`
    UPDATE open_days
    SET status = 'blocked', s1_start = null, s1_end = null, s2_start = null, s2_end = null, note = 'Closed (Non-working day)'
    WHERE day = ?
  `);

  for (const row of allFuture) {
    const d = new Date(row.day + 'T00:00:00');
    const dow = d.getDay();
    const isodow = dow === 0 ? 7 : dow;

    if (workingDows.includes(isodow)) {
      const isSat = isodow === 6;
      const s2Start = isSat ? (satAfternoon ? '14:00' : null) : '14:00';
      const s2End = isSat ? (satAfternoon ? '17:00' : null) : '17:00';
      const note = isSat
        ? (satAfternoon ? 'Saturday (Full Day)' : 'Saturday (Morning Only 10:10-12:30)')
        : 'Standard Working Day';

      const res = updateOpenStmt.run(s2Start, s2End, note, row.day);
      if (res.changes > 0) updatedOpen++;
    } else if (row.status === 'open') {
      const hasBooking = db.prepare(`
        SELECT 1 FROM bookings
        WHERE day = ? AND status IN ('booked', 'arrived', 'called') LIMIT 1
      `).get(row.day);

      if (!hasBooking) {
        const res = blockStmt.run(row.day);
        if (res.changes > 0) updatedBlocked++;
      }
    }
  }

  const autoRes = autoGenerateOpenDaysSqlite(db, 60, workingDows);

  return {
    ok: true,
    working_dows: workingDows,
    saturday_afternoon: satAfternoon,
    updated_open_days: updatedOpen,
    blocked_closed_days: updatedBlocked,
    auto_generation: autoRes,
  };
}
