// Pure scheduling logic — given a mantra config, generate the next N firing times.
//
// Three modes, picked by data shape:
//   - Frequency: frequencyMinutes < 1440. Fires at activeHours.start,
//     +frequencyMinutes, … up to (but not including) activeHours.end on
//     each active day. `activeDays` is Mon..Sun (index 0 = Monday).
//   - Once a day: frequencyMinutes === 1440. Fires once per active day at
//     activeHours.start.
//   - Specific times: specificTimes is non-empty. Fires at each of those
//     hours on each active day; activeHours / frequencyMinutes are ignored.

import type { Mantra } from '@/types/mantra';

export const ONCE_A_DAY = 1440;

function dayIndexFromDate(d: Date): number {
  // JS getDay(): 0 = Sunday. We want 0 = Monday.
  return (d.getDay() + 6) % 7;
}

function hasSpecificTimes(mantra: Mantra): mantra is Mantra & { specificTimes: number[] } {
  return Array.isArray(mantra.specificTimes) && mantra.specificTimes.length > 0;
}

export function computeNextOccurrences(
  mantra: Mantra,
  count = 30,
  fromDate: Date = new Date(),
): Date[] {
  const out: Date[] = [];
  const { activeDays } = mantra;
  if (!activeDays || !activeDays.some(Boolean)) return out;

  const cursor = new Date(fromDate);
  cursor.setSeconds(0, 0);
  const MAX_DAYS = 60;

  if (hasSpecificTimes(mantra)) {
    const sortedHours = [...mantra.specificTimes]
      .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23)
      .sort((a, b) => a - b);
    if (sortedHours.length === 0) return out;

    for (let day = 0; day < MAX_DAYS && out.length < count; day++) {
      const dayDate = new Date(cursor);
      dayDate.setHours(0, 0, 0, 0);
      dayDate.setDate(dayDate.getDate() + day);
      if (!activeDays[dayIndexFromDate(dayDate)]) continue;

      for (const hour of sortedHours) {
        if (out.length >= count) break;
        const occurrence = new Date(dayDate);
        occurrence.setHours(hour, 0, 0, 0);
        if (occurrence.getTime() > fromDate.getTime()) out.push(occurrence);
      }
    }
    return out;
  }

  const { frequencyMinutes, activeHours } = mantra;
  if (!frequencyMinutes || frequencyMinutes <= 0) return out;
  const startMin = activeHours.start * 60;
  const endMin = frequencyMinutes >= ONCE_A_DAY ? startMin + 1 : activeHours.end * 60;
  if (endMin <= startMin) return out;

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

export function describeMantra(mantra: Mantra): string {
  const days = formatDays(mantra.activeDays);
  if (hasSpecificTimes(mantra)) {
    const sorted = [...mantra.specificTimes].sort((a, b) => a - b);
    const times = sorted.map((h) => `${pad(h)}:00`).join(', ');
    return `at ${times} · ${days}`;
  }
  if (mantra.frequencyMinutes >= ONCE_A_DAY) {
    return `once a day at ${pad(mantra.activeHours.start)}:00 · ${days}`;
  }
  const freq = formatFrequency(mantra.frequencyMinutes);
  const hours = `${pad(mantra.activeHours.start)}:00–${pad(mantra.activeHours.end)}:00`;
  return `${freq} · ${hours} · ${days}`;
}

export function formatFrequency(minutes: number): string {
  if (minutes >= ONCE_A_DAY) return 'once a day';
  if (minutes < 60) return `every ${minutes} min`;
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? 'every hour' : `every ${h} hours`;
  }
  return `every ${minutes} min`;
}

export function formatDays(activeDays: boolean[]): string {
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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
