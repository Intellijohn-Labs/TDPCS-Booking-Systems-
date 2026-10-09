import { calculateAvailableSlots, executeRpc, executeQuery } from '../lib/db/operations';
import { getDb } from '../lib/db/sqlite';
import { formatSlotTime, formatSlotDate, addMinutesToTimestamp, formatSlotWithDuration } from '../lib/date-utils';

console.log('================================================================');
console.log('     TDPCS-APT EXHAUSTIVE EDGE CASE & END CASE VERIFICATION     ');
console.log('================================================================\n');

const db = getDb();
let totalPassed = 0;
let totalFailed = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
    totalFailed++;
  }
}

const TEST_DAY_1 = '2026-11-20';
const TEST_DAY_2 = '2026-11-21';

// Setup Test Days
db.prepare("INSERT OR IGNORE INTO open_days (day, status, s1_start, s1_end, s2_start, s2_end, note) VALUES (?, 'open', '10:00', '13:00', '14:00', '17:00', 'Edge Test')").run(TEST_DAY_1);
db.prepare("INSERT OR IGNORE INTO open_days (day, status, s1_start, s1_end, s2_start, s2_end, note) VALUES (?, 'open', '10:00', '13:00', '14:00', '17:00', 'Edge Test')").run(TEST_DAY_2);

// Clean bookings on test days
db.prepare("DELETE FROM bookings WHERE day IN (?, ?)").run(TEST_DAY_1, TEST_DAY_2);
db.prepare("DELETE FROM token_counters WHERE day IN (?, ?)").run(TEST_DAY_1, TEST_DAY_2);
db.prepare("DELETE FROM booking_links WHERE id LIKE 'test-edge-%'").run();

// Create test booking links
db.prepare("INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at) VALUES ('test-edge-user1', '919000000001', 'book', '2026-12-01T00:00:00')").run();
db.prepare("INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at) VALUES ('test-edge-user2', '919000000002', 'book', '2026-12-01T00:00:00')").run();
db.prepare("INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at) VALUES ('test-edge-user3', '919000000003', 'book', '2026-12-01T00:00:00')").run();
db.prepare("INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at) VALUES ('test-edge-manage', '919000000001', 'manage', '2026-12-01T00:00:00')").run();
db.prepare("INSERT OR REPLACE INTO booking_links (id, mobile, purpose, expires_at) VALUES ('test-edge-expired', '919000000099', 'book', '2026-01-01T00:00:00')").run(); // expired in past

// -----------------------------------------------------------------------------
// CATEGORY 1: Dynamic Duration Calculations & Boundaries
// -----------------------------------------------------------------------------
console.log('--- CATEGORY 1: Dynamic Duration Calculations & Steps ---');

// 1.1 Minimum 5-minute single service (e.g. Emergency Loan = 5 mins)
const slots5m = calculateAvailableSlots(TEST_DAY_1, 5);
check(slots5m.allSlots.length > 0, '5-minute duration generates slots');
check(slots5m.allSlots[0].slot_start.endsWith('10:00:00') && slots5m.allSlots[0].slot_end.endsWith('10:05:00'), '5-minute slot 1: 10:00 to 10:05');
check(slots5m.allSlots[1].slot_start.endsWith('10:05:00') && slots5m.allSlots[1].slot_end.endsWith('10:10:00'), '5-minute slot 2: 10:05 to 10:10');

// 1.2 Combined 25-minute (20m + 5m)
const slots25m = calculateAvailableSlots(TEST_DAY_1, 25);
check(slots25m.allSlots[0].slot_start.endsWith('10:00:00') && slots25m.allSlots[0].slot_end.endsWith('10:25:00'), '25-minute slot 1: 10:00 to 10:25');
check(slots25m.allSlots[1].slot_start.endsWith('10:25:00') && slots25m.allSlots[1].slot_end.endsWith('10:50:00'), '25-minute slot 2: 10:25 to 10:50');

// 1.3 35-minute (5m + 10m + 20m)
const slots35m = calculateAvailableSlots(TEST_DAY_1, 35);
check(slots35m.allSlots[0].slot_start.endsWith('10:00:00') && slots35m.allSlots[0].slot_end.endsWith('10:35:00'), '35-minute slot 1: 10:00 to 10:35');
check(slots35m.allSlots[1].slot_start.endsWith('10:35:00') && slots35m.allSlots[1].slot_end.endsWith('11:10:00'), '35-minute slot 2: 10:35 to 11:10');

// 1.4 Large combined 70-minute multi-loan
const slots70m = calculateAvailableSlots(TEST_DAY_1, 70);
check(slots70m.allSlots[0].slot_start.endsWith('10:00:00') && slots70m.allSlots[0].slot_end.endsWith('11:10:00'), '70-minute slot 1: 10:00 to 11:10');
check(slots70m.allSlots[1].slot_start.endsWith('11:10:00') && slots70m.allSlots[1].slot_end.endsWith('12:20:00'), '70-minute slot 2: 11:10 to 12:20');
// Notice: 12:20 + 70m = 13:30, crosses 13:00, so slot 3 must NOT exist in morning!
const morning70m = slots70m.allSlots.filter(s => s.slot_start < `${TEST_DAY_1}T13:00:00`);
check(morning70m.length === 2, '70-minute morning session strictly stops after 2 slots (cannot fit 3rd slot before 13:00)');

// 1.5 Edge case: Zero products or empty array
const resZero = executeRpc('customer_slots', { p_token: 'test-edge-user1', p_day: TEST_DAY_1, p_product_ids: [] });
check(resZero.ok === false && resZero.error === 'no_products', 'Empty products array rejected gracefully');

const resNonExistent = executeRpc('customer_slots', { p_token: 'test-edge-user1', p_day: TEST_DAY_1, p_product_ids: [9999] });
check(resNonExistent.ok === false && resNonExistent.error === 'no_products', 'Non-existent product IDs rejected gracefully');

// -----------------------------------------------------------------------------
// CATEGORY 2: Session Boundary & Lunch Break Enforcement
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 2: Session Boundary & Lunch Break Enforcement ---');

// Check across multiple durations (5, 15, 20, 25, 30, 35, 45, 60 mins)
const testDurations = [5, 15, 20, 25, 30, 35, 45, 60];
let anyCrossesLunch = false;
let anyInLunchBreak = false;
let anyCrossesClosing = false;

for (const d of testDurations) {
  const { allSlots } = calculateAvailableSlots(TEST_DAY_1, d);
  for (const s of allSlots) {
    // Cannot end after 13:00:00 if started before 13:00:00
    if (s.slot_start < `${TEST_DAY_1}T13:00:00` && s.slot_end > `${TEST_DAY_1}T13:00:00`) {
      anyCrossesLunch = true;
    }
    // Cannot start during 13:00 to 14:00
    if (s.slot_start >= `${TEST_DAY_1}T13:00:00` && s.slot_start < `${TEST_DAY_1}T14:00:00`) {
      anyInLunchBreak = true;
    }
    // Cannot end after 17:00:00
    if (s.slot_end > `${TEST_DAY_1}T17:00:00`) {
      anyCrossesClosing = true;
    }
  }
}

check(!anyCrossesLunch, 'Zero slots cross 1:00 PM lunch break boundary across all tested durations');
check(!anyInLunchBreak, 'Zero slots start inside 1:00 PM – 2:00 PM lunch break window');
check(!anyCrossesClosing, 'Zero slots cross 5:00 PM closing time boundary');

// -----------------------------------------------------------------------------
// CATEGORY 3: Theater Seat Transitions & Multi-User Concurrency
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 3: Theater Seat Multi-User Occupancy & Lock ---');

const DURATION_25 = 25;
const targetSlot = `${TEST_DAY_1}T10:00:00`;

// 3.1 Initial state: Both counters available
let state0 = calculateAvailableSlots(TEST_DAY_1, DURATION_25).allSlots.find(s => s.slot_start === targetSlot);
check(state0?.status === 'available' && state0?.counter === 1 && !state0?.c1_booked && !state0?.c2_booked, 'Initial 10:00 slot is "available" with Counter 1 free');

// 3.2 User 1 books Counter 1 at 10:00 AM
const bookU1 = executeRpc('customer_book', {
  p_token: 'test-edge-user1',
  p_name: 'Edge Tester One',
  p_start: targetSlot,
  p_product_ids: [1, 2] // 25 mins
});
check(bookU1.ok === true && bookU1.counter === 1, `User 1 booked Counter 1 at 10:00 AM (Token: ${bookU1.token})`);

// Check state after User 1: Status must be "partial" (1 Counter Left)
let state1 = calculateAvailableSlots(TEST_DAY_1, DURATION_25).allSlots.find(s => s.slot_start === targetSlot);
check(state1?.status === 'partial' && state1?.counter === 2 && state1?.c1_booked && !state1?.c2_booked, 'After User 1: Slot is "partial" (Counter 2 open, Counter 1 taken)');

// 3.3 User 2 books Counter 2 at 10:00 AM
const bookU2 = executeRpc('customer_book', {
  p_token: 'test-edge-user2',
  p_name: 'Edge Tester Two',
  p_start: targetSlot,
  p_product_ids: [1, 2] // 25 mins
});
check(bookU2.ok === true && bookU2.counter === 2, `User 2 booked Counter 2 at 10:00 AM (Token: ${bookU2.token})`);

// Check state after User 2: Status must be "booked" (🔒 ALREADY BOOKED)
const resultAfterBoth = calculateAvailableSlots(TEST_DAY_1, DURATION_25);
let state2 = resultAfterBoth.allSlots.find(s => s.slot_start === targetSlot);
check(state2?.status === 'booked' && state2?.c1_booked && state2?.c2_booked, 'After User 2: Slot is 🔒 "booked" (Both counters taken)');
check(!resultAfterBoth.availableSlots.some(s => s.slot_start === targetSlot), 'Slot is excluded from selectable availableSlots');

// 3.4 User 3 attempts to book the same 10:00 AM slot -> MUST FAIL with slot_taken
const bookU3Fail = executeRpc('customer_book', {
  p_token: 'test-edge-user3',
  p_name: 'Edge Tester Three',
  p_start: targetSlot,
  p_product_ids: [1, 2]
});
check(bookU3Fail.ok === false && bookU3Fail.error === 'slot_taken', 'Double-booking locked slot rejected with "slot_taken"');

// 3.5 User 3 books next available slot: 10:25 AM -> MUST SUCCEED
const nextSlot = `${TEST_DAY_1}T10:25:00`;
const bookU3Success = executeRpc('customer_book', {
  p_token: 'test-edge-user3',
  p_name: 'Edge Tester Three',
  p_start: nextSlot,
  p_product_ids: [1, 2]
});
check(bookU3Success.ok === true && bookU3Success.slot_start === nextSlot, `User 3 successfully booked next slot at 10:25 AM (Token: ${bookU3Success.token})`);

// -----------------------------------------------------------------------------
// CATEGORY 4: Customer Restrictions & Validation Edge Cases
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 4: Customer Restrictions & Validations ---');

// 4.1 Same user attempts second active booking on the same day -> MUST FAIL
const bookSameDayTwice = executeRpc('customer_book', {
  p_token: 'test-edge-user1',
  p_name: 'Edge Tester One Duplicate',
  p_start: `${TEST_DAY_1}T10:50:00`,
  p_product_ids: [1, 2]
});
check(bookSameDayTwice.ok === false && bookSameDayTwice.error === 'already_booked', 'Same customer second booking on same day rejected with "already_booked"');

// 4.2 Same user booking on a DIFFERENT open day (TEST_DAY_2) -> MUST BE ALLOWED
const bookDifferentDay = executeRpc('customer_book', {
  p_token: 'test-edge-user1',
  p_name: 'Edge Tester One Future',
  p_start: `${TEST_DAY_2}T10:00:00`,
  p_product_ids: [1, 2]
});
check(bookDifferentDay.ok === true, 'Same customer booking on a DIFFERENT date allowed successfully');

// 4.3 Validation: Customer name too short (< 2 characters)
const bookShortName = executeRpc('customer_book', {
  p_token: 'test-edge-user2',
  p_name: 'A',
  p_start: `${TEST_DAY_2}T10:25:00`,
  p_product_ids: [1, 2]
});
check(bookShortName.ok === false && bookShortName.error === 'name_required', 'Short customer name (< 2 chars) rejected with "name_required"');

// 4.4 Expired token validation
const initExpiredLink = executeRpc('customer_init', { p_token: 'test-edge-expired' });
check(initExpiredLink.ok === false && initExpiredLink.error === 'link_expired', 'customer_init: Expired link rejected with "link_expired"');

const slotsExpiredLink = executeRpc('customer_slots', { p_token: 'test-edge-expired', p_day: TEST_DAY_1, p_product_ids: [1] });
check(slotsExpiredLink.ok === false && slotsExpiredLink.error === 'link_expired', 'customer_slots: Expired link rejected with "link_expired"');

const bookExpiredToken = executeRpc('customer_book', { p_token: 'test-edge-expired', p_name: 'Test', p_start: `${TEST_DAY_1}T10:00:00`, p_product_ids: [1] });
check(bookExpiredToken.ok === false && bookExpiredToken.error === 'link_expired', 'customer_book: Expired link rejected with "link_expired"');

const cancelExpiredToken = executeRpc('customer_cancel', { p_token: 'test-edge-expired', p_booking_id: 999 });
check(cancelExpiredToken.ok === false && cancelExpiredToken.error === 'link_expired', 'customer_cancel: Expired link rejected with "link_expired"');

const reschedExpiredToken = executeRpc('customer_reschedule', { p_token: 'test-edge-expired', p_booking_id: 999, p_new_start: `${TEST_DAY_1}T10:00:00` });
check(reschedExpiredToken.ok === false && reschedExpiredToken.error === 'link_expired', 'customer_reschedule: Expired link rejected with "link_expired"');

const bookInvalidLink = executeRpc('customer_init', { p_token: 'totally-invalid-uuid-token' });
check(bookInvalidLink.ok === false && bookInvalidLink.error === 'link_expired', 'Non-existent link rejected with "link_expired"');

// -----------------------------------------------------------------------------
// CATEGORY 5: Token Generation & Consecutive Numbering
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 5: Token Sequencing Across Days ---');

// Tokens on TEST_DAY_1 should be T-001, T-002, T-003
check(bookU1.token === 'T-001', 'First booking of day gets token T-001');
check(bookU2.token === 'T-002', 'Second booking of day gets token T-002');
check(bookU3Success.token === 'T-003', 'Third booking of day gets token T-003');

// First booking on TEST_DAY_2 must reset to T-001
check(bookDifferentDay.token === 'T-001', 'New day tokens reset and start clean from T-001');

// -----------------------------------------------------------------------------
// CATEGORY 6: Reporting Buffer & Time Format
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 6: Reporting Buffer & Timing Rules ---');

// Slot start: 10:00:00. Report buffer: 10 mins. Expected report: 09:50:00
check(bookU1.report_time?.endsWith('09:50:00'), 'Report buffer correctly calculates report time (10:00 slot -> 09:50 report)');

// Slot start: 10:25:00. Report buffer: 10 mins. Expected report: 10:15:00
check(bookU3Success.report_time?.endsWith('10:15:00'), 'Report buffer correctly calculates report time (10:25 slot -> 10:15 report)');

// Slot end calculation: 10:00:00 + 25m = 10:25:00
check(bookU1.slot_end?.endsWith('10:25:00'), 'Continuous slot end matches duration (10:00 + 25m = 10:25)');

// -----------------------------------------------------------------------------
// CATEGORY 7: Reschedule & Cancellation Workflows
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 7: Reschedule & Cancellation Slot Release ---');

// 7.1 Cancellation: User 2 cancels Counter 2 at 10:00 AM
const cancelU2 = executeRpc('customer_cancel', {
  p_token: 'test-edge-user2',
  p_booking_id: bookU2.booking_id
});
check(cancelU2.ok === true, 'User 2 cancelled appointment successfully');

// After cancel, 10:00 slot must return to "partial" (Counter 2 is free again!)
const slotsAfterCancel = calculateAvailableSlots(TEST_DAY_1, DURATION_25);
const stateAfterCancel = slotsAfterCancel.allSlots.find(s => s.slot_start === targetSlot);
check(stateAfterCancel?.status === 'partial' && stateAfterCancel?.counter === 2, 'Cancelled slot releases Counter 2 back to "partial" status');
check(slotsAfterCancel.availableSlots.some(s => s.slot_start === targetSlot), 'Released slot reappears in selectable availableSlots');

// 7.2 Reschedule: User 3 reschedules from 10:25 to 10:50
const rescheduleU3 = executeRpc('customer_reschedule', {
  p_token: 'test-edge-user3',
  p_booking_id: bookU3Success.booking_id,
  p_new_start: `${TEST_DAY_1}T10:50:00`
});
check(rescheduleU3.ok === true && rescheduleU3.slot_start === `${TEST_DAY_1}T10:50:00`, 'User 3 successfully rescheduled to 10:50 AM');

// The old slot (10:25 AM) must now be released and free!
const stateOldSlot = calculateAvailableSlots(TEST_DAY_1, DURATION_25).allSlots.find(s => s.slot_start === nextSlot);
check(stateOldSlot?.status === 'available', 'Old slot (10:25 AM) released back to "available" after reschedule');

// -----------------------------------------------------------------------------
// CATEGORY 8: Queue State Transitions
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 8: Queue State Machine Transitions ---');

const activeBk = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookU1.booking_id) as any;
check(activeBk.status === 'booked', 'Initial booking status is "booked"');

// Mark arrived
db.prepare("UPDATE bookings SET status = 'arrived' WHERE id = ?").run(bookU1.booking_id);
const arrivedBk = db.prepare("SELECT status FROM bookings WHERE id = ?").get(bookU1.booking_id) as any;
check(arrivedBk.status === 'arrived', 'Status transition to "arrived"');

// Mark called
db.prepare("UPDATE bookings SET status = 'called' WHERE id = ?").run(bookU1.booking_id);
const calledBk = db.prepare("SELECT status FROM bookings WHERE id = ?").get(bookU1.booking_id) as any;
check(calledBk.status === 'called', 'Status transition to "called"');

// Mark served
db.prepare("UPDATE bookings SET status = 'served' WHERE id = ?").run(bookU1.booking_id);
const servedBk = db.prepare("SELECT status FROM bookings WHERE id = ?").get(bookU1.booking_id) as any;
check(servedBk.status === 'served', 'Status transition to "served"');

// -----------------------------------------------------------------------------
// CATEGORY 9: Date Formatting & IST Time Consistency
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 9: Date & Time Utilities ---');

const formatted10 = formatSlotTime('2026-11-20T10:00:00');
check(formatted10 === '10:00 AM', `formatSlotTime("10:00:00") -> "${formatted10}"`);

const formatted14 = formatSlotTime('2026-11-20T14:35:00');
check(formatted14 === '2:35 PM', `formatSlotTime("14:35:00") -> "${formatted14}"`);

const added = addMinutesToTimestamp('2026-11-20T10:00:00', 35);
check(added === '2026-11-20T10:35:00', `addMinutesToTimestamp("10:00:00", 35) -> "${added}" (no timezone shift)`);

const addedOverHour = addMinutesToTimestamp('2026-11-20T10:45:00', 30);
check(addedOverHour === '2026-11-20T11:15:00', `addMinutesToTimestamp("10:45:00", 30) -> "${addedOverHour}" (rolls hour cleanly)`);

// -----------------------------------------------------------------------------
// CATEGORY 10: Bulk Database Operations & Array Handling
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 10: Bulk Database Operations & Array Handling ---');

const bulkDays = [
  { day: '2026-11-28', status: 'open', s1_start: '10:00', s1_end: '13:00', s2_start: '14:00', s2_end: '17:00', note: 'Bulk 1' },
  { day: '2026-11-29', status: 'blocked', s1_start: '10:00', s1_end: '13:00', s2_start: '14:00', s2_end: '17:00', note: 'Bulk 2' }
];

const upsertRes = executeQuery({
  table: 'open_days',
  action: 'upsert',
  data: bulkDays
});
check(upsertRes?.ok === true, 'Bulk array upsert executes without SQL syntax error');

const verifyBulk = db.prepare("SELECT COUNT(*) as c FROM open_days WHERE day IN ('2026-11-28', '2026-11-29')").get() as any;
check(verifyBulk.c === 2, 'Bulk upserted rows persisted correctly');

db.prepare("DELETE FROM open_days WHERE day IN ('2026-11-28', '2026-11-29')").run();

// Cleanup edge test bookings
db.prepare("DELETE FROM bookings WHERE day IN (?, ?)").run(TEST_DAY_1, TEST_DAY_2);
db.prepare("DELETE FROM token_counters WHERE day IN (?, ?)").run(TEST_DAY_1, TEST_DAY_2);
db.prepare("DELETE FROM booking_links WHERE id LIKE 'test-edge-%'").run();

console.log('\n================================================================');
console.log(`TOTAL EDGE CASE CHECKS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
console.log('================================================================');
