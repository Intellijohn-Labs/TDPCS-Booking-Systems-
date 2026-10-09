// IST (Asia/Kolkata) Date & Time Formatting Utilities
// In TDPCS-Apt, timestamps are stored as IST wall-clock strings (e.g. 2026-10-10T10:20:00)

/**
 * Format timestamp string to "10:20 AM"
 */
export function formatSlotTime(timestampStr: string | null | undefined): string {
  if (!timestampStr) return '';
  try {
    // timestampStr might be '2026-10-10T10:20:00' or '10:20:00' or with timezone
    let hours: number;
    let minutes: number;

    if (timestampStr.includes('T')) {
      const timePart = timestampStr.split('T')[1];
      const parts = timePart.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else if (timestampStr.includes(':')) {
      const parts = timestampStr.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else {
      const d = new Date(timestampStr);
      hours = d.getHours();
      minutes = d.getMinutes();
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return timestampStr;
  }
}

/**
 * Format date string (YYYY-MM-DD) to "DD-MM-YYYY (Weekday)"
 * e.g. "2026-10-10" -> "10-10-2026 (Saturday)"
 */
export function formatSlotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    // If it contains a time component, take the date part
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const [yearStr, monthStr, dayStr] = cleanDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const d = new Date(year, month, day);
    const weekdayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const weekday = weekdayNames[d.getDay()];

    const formattedDay = day.toString().padStart(2, '0');
    const formattedMonth = (month + 1).toString().padStart(2, '0');

    return `${formattedDay}-${formattedMonth}-${year} (${weekday})`;
  } catch {
    return dateStr;
  }
}

/**
 * Format date string (YYYY-MM-DD) to "DD-MM-YYYY"
 */
export function formatSlotDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const [year, month, day] = cleanDate.split('-');
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format slot time range: "10:20 AM - 11:00 AM"
 */
export function formatSlotRange(
  startStr: string | null | undefined,
  endStr: string | null | undefined
): string {
  const start = formatSlotTime(startStr);
  const end = formatSlotTime(endStr);
  return `${start} - ${end}`;
}

/**
 * Get current date in IST as YYYY-MM-DD
 */
export function getTodayIST(): string {
  const now = new Date();
  // IST is UTC+5:30
  const utcOffset = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utcOffset + 5.5 * 3600000);
  const y = istTime.getFullYear();
  const m = (istTime.getMonth() + 1).toString().padStart(2, '0');
  const d = istTime.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add minutes to an ISO-like timestamp string (YYYY-MM-DDTHH:MM:SS)
 * without timezone drift
 */
export function addMinutesToTimestamp(timestampStr: string, minutesToAdd: number): string {
  if (!timestampStr) return '';
  const [datePart, timePart] = timestampStr.split('T');
  if (!timePart) return timestampStr;
  const parts = timePart.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMins = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const newM = (totalMins % 60).toString().padStart(2, '0');
  const s = parts[2] ? parts[2].slice(0, 2) : '00';
  return `${datePart}T${newH}:${newM}:${s}`;
}

/**
 * Format a slot start and duration to "10:00 AM – 10:35 AM"
 */
export function formatSlotWithDuration(slotStart: string, durationMinutes: number): string {
  const slotEnd = addMinutesToTimestamp(slotStart, durationMinutes);
  return `${formatSlotTime(slotStart)} – ${formatSlotTime(slotEnd)}`;
}

