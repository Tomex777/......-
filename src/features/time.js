const units = Object.freeze({
  s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
  m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
  h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
  d: 86400000, day: 86400000, days: 86400000,
  w: 604800000, week: 604800000, weeks: 604800000
});

export function parseDuration(input) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return null;
  let total = 0;
  let matched = false;
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)) {
    const factor = units[match[2]];
    if (!factor) continue;
    total += Number(match[1]) * factor;
    matched = true;
  }
  return matched && Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}

function nextAt(hour, minute = 0, base = new Date()) {
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function parseWhen(input, { now = Date.now() } = {}) {
  const raw = String(input || '').trim();
  const text = raw.toLowerCase();
  if (!text) return null;

  const duration = parseDuration(text.replace(/^in\s+/, ''));
  if (/^in\s+/.test(text) && duration) return now + duration;

  if (text === 'tomorrow' || text === 'tomorrow morning') {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(text.endsWith('morning') ? 8 : 9, 0, 0, 0); return d.getTime();
  }
  if (text === 'tonight') return nextAt(19, 0, new Date(now));
  if (text === 'this evening') return nextAt(19, 0, new Date(now));
  if (text === 'this afternoon') return nextAt(15, 0, new Date(now));
  if (text === 'tomorrow afternoon') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(15,0,0,0); return d.getTime(); }
  if (text === 'tomorrow evening' || text === 'tomorrow night') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(19,0,0,0); return d.getTime(); }

  const clock = text.match(/^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (clock) {
    let hour = Number(clock[1]); const minute = Number(clock[2] || 0); const ap = clock[3]?.toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return nextAt(hour, minute, new Date(now));
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed) && parsed > now) return parsed;
  return null;
}

export function parseReminderArgs(input, { now = Date.now() } = {}) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const relative = raw.match(/^in\s+((?:\d+(?:\.\d+)?\s*[a-z]+\s*)+)\s+(.+)$/i);
  if (relative) {
    const ms = parseDuration(relative[1]);
    if (ms) return { dueAt: now + ms, text: relative[2].trim(), recurrenceMs: null };
  }

  const every = raw.match(/^every\s+((?:\d+(?:\.\d+)?\s*)?[a-z]+)\s+(.+)$/i);
  if (every) {
    const ms = parseDuration(/^\d/.test(every[1]) ? every[1] : `1 ${every[1]}`);
    if (ms) return { dueAt: now + ms, text: every[2].trim(), recurrenceMs: ms };
  }

  const tomorrow = raw.match(/^tomorrow(?:\s+(morning|afternoon|evening|night))?\s+(.+)$/i);
  if (tomorrow) {
    const when = `tomorrow${tomorrow[1] ? ` ${tomorrow[1]}` : ''}`;
    return { dueAt: parseWhen(when, { now }), text: tomorrow[2].trim(), recurrenceMs: null };
  }

  const at = raw.match(/^at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(.+)$/i);
  if (at) return { dueAt: parseWhen(at[1], { now }), text: at[2].trim(), recurrenceMs: null };

  return null;
}

export function formatWhen(value) {
  const d = new Date(Number(value));
  return Number.isFinite(d.getTime()) ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown time';
}
