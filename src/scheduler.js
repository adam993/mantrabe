// Pure scheduling logic — given a mantra config, generate the next N firing times.
//
// Active hours are interpreted as [start, end). If end <= start the window
// is treated as "no active window" (skipped). Frequency is anchored to the
// start of the active window each day, so a 30-minute frequency starting at
// 09:00 fires at 09:00, 09:30, 10:00, ... up to (but not including) `end`.
// `activeDays` is Mon..Sun (index 0 = Monday).
//
// Once-a-day mode (frequencyMinutes === 1440): fires exactly once per
// active day at activeHours.start. The `end` value is ignored — the editor
// hides it for this case so it doesn't matter what it's set to.

export const ONCE_A_DAY = 1440;

function dayIndexFromDate(d) {
  // JS getDay(): 0 = Sunday. We want 0 = Monday.
  return (d.getDay() + 6) % 7;
}

export function computeNextOccurrences(mantra, count = 30, fromDate = new Date()) {
  const out = [];
  const { frequencyMinutes, activeHours, activeDays } = mantra;
  if (!frequencyMinutes || frequencyMinutes <= 0) return out;
  if (!activeDays || !activeDays.some(Boolean)) return out;
  const startMin = activeHours.start * 60;
  const endMin = frequencyMinutes >= ONCE_A_DAY ? startMin + 1 : activeHours.end * 60;
  if (endMin <= startMin) return out;

  // Walk forward day by day. Each day, generate all freq slots within the
  // active window that are strictly after `fromDate`.
  let cursor = new Date(fromDate);
  cursor.setSeconds(0, 0);

  const MAX_DAYS = 60; // safety bound
  for (let day = 0; day < MAX_DAYS && out.length < count; day++) {
    const dayDate = new Date(cursor);
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() + day);

    if (!activeDays[dayIndexFromDate(dayDate)]) continue;

    for (let m = startMin; m < endMin && out.length < count; m += frequencyMinutes) {
      const occurrence = new Date(dayDate);
      occurrence.setMinutes(m);
      if (occurrence.getTime() > fromDate.getTime()) {
        out.push(occurrence);
      }
    }
  }

  return out;
}

export function describeMantra(mantra) {
  const days = formatDays(mantra.activeDays);
  if (mantra.frequencyMinutes >= ONCE_A_DAY) {
    return `once a day at ${pad(mantra.activeHours.start)}:00 · ${days}`;
  }
  const freq = formatFrequency(mantra.frequencyMinutes);
  const hours = `${pad(mantra.activeHours.start)}:00–${pad(mantra.activeHours.end)}:00`;
  return `${freq} · ${hours} · ${days}`;
}

export function formatFrequency(minutes) {
  if (minutes >= ONCE_A_DAY) return 'once a day';
  if (minutes < 60) return `every ${minutes} min`;
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? 'every hour' : `every ${h} hours`;
  }
  return `every ${minutes} min`;
}

export function formatDays(activeDays) {
  if (activeDays.every(Boolean)) return 'every day';
  if (activeDays.slice(0, 5).every(Boolean) && !activeDays[5] && !activeDays[6]) {
    return 'weekdays';
  }
  if (!activeDays.slice(0, 5).some(Boolean) && activeDays[5] && activeDays[6]) {
    return 'weekends';
  }
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return activeDays.map((on, i) => (on ? labels[i] : '·')).join('');
}

function pad(n) {
  return String(n).padStart(2, '0');
}
