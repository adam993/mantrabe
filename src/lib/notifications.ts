// Cross-platform notification layer.
//
// Native (Capacitor): schedules a batch of LocalNotifications with the
// chosen bell sound. We pre-schedule the next ~50 occurrences per mantra
// and reschedule whenever the user changes anything.
//
// Web/Electron: a single in-app setTimeout points at the next occurrence
// of any mantra. When it fires we show a Notification, play the bell,
// then recompute. The Electron preload bridges system Notification API
// into the renderer.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { computeNextOccurrences } from '@/lib/scheduler';
import { playBellChime } from '@/lib/bell-chime';
import { soundFile, DEFAULT_SOUND_ID } from '@/lib/sounds';
import type { Mantra } from '@/types/mantra';

interface ElectronBridge {
  isElectron?: boolean;
  notify?: (payload: { title: string; body: string }) => Promise<boolean> | boolean;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function requestPermission(): Promise<boolean> {
  if (isNative()) {
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  }
  if ('Notification' in globalThis) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

export async function getPermissionState(): Promise<NotificationPermission | 'prompt'> {
  if (isNative()) {
    const res = await LocalNotifications.checkPermissions();
    return res.display as NotificationPermission | 'prompt';
  }
  if ('Notification' in globalThis) return Notification.permission;
  return 'denied';
}

const PER_MANTRA_LOOKAHEAD = 50;

export async function rescheduleAll(mantras: Mantra[]): Promise<void> {
  if (isNative()) {
    await rescheduleNative(mantras);
  } else {
    rescheduleWeb(mantras);
  }
}

async function rescheduleNative(mantras: Mantra[]): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications && pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  const enabled = mantras.filter((m) => m.enabled && m.text.trim());
  if (enabled.length === 0) return;

  let entries: { at: Date; mantra: Mantra }[] = [];
  for (const mantra of enabled) {
    const occ = computeNextOccurrences(mantra, PER_MANTRA_LOOKAHEAD);
    for (const at of occ) entries.push({ at, mantra });
  }
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  entries = entries.slice(0, 60); // stay below iOS's 64-pending cap

  const notifications = entries.map((e, i) => ({
    id: i + 1,
    title: 'Mantrabe',
    body: e.mantra.text,
    schedule: { at: e.at, allowWhileIdle: true },
    sound: soundFile(e.mantra.soundId),
    extra: { mantraId: e.mantra.id },
  }));

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

let webTimerId: ReturnType<typeof setTimeout> | null = null;
let webMantrasCache: Mantra[] = [];
let webElectronBridge: ElectronBridge | false | null = null;

function getElectronBridge(): ElectronBridge | false {
  if (webElectronBridge !== null) return webElectronBridge;
  webElectronBridge =
    (typeof window !== 'undefined' &&
      (window as unknown as { mantrabe?: ElectronBridge }).mantrabe) || false;
  return webElectronBridge;
}

function rescheduleWeb(mantras: Mantra[]): void {
  webMantrasCache = mantras.filter((m) => m.enabled && m.text.trim());
  if (webTimerId) {
    clearTimeout(webTimerId);
    webTimerId = null;
  }
  if (webMantrasCache.length === 0) return;

  const now = new Date();
  let nextTime: Date | null = null;
  let nextMantra: Mantra | null = null;
  for (const m of webMantrasCache) {
    const occ = computeNextOccurrences(m, 1, now);
    if (occ.length && (!nextTime || occ[0]! < nextTime)) {
      nextTime = occ[0]!;
      nextMantra = m;
    }
  }
  if (!nextTime) return;

  const delay = Math.max(0, nextTime.getTime() - Date.now());
  const MAX = 2_000_000_000; // setTimeout cap (~24.8 days)
  const useDelay = Math.min(delay, MAX);
  webTimerId = setTimeout(() => {
    if (delay > MAX) {
      rescheduleWeb(webMantrasCache);
    } else {
      if (nextMantra) fireWebNotification(nextMantra);
      rescheduleWeb(webMantrasCache);
    }
  }, useDelay);
}

function fireWebNotification(mantra: Mantra): void {
  const bridge = getElectronBridge();
  if (bridge && bridge.notify) {
    bridge.notify({ title: 'Mantrabe', body: mantra.text });
  } else if ('Notification' in globalThis && Notification.permission === 'granted') {
    try {
      const n = new Notification('Mantrabe', { body: mantra.text, silent: true });
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* noop */
        }
      };
    } catch {
      // mobile Safari restricts the constructor — just play the chime.
    }
  }
  playBellChime(mantra.soundId).catch(() => {
    /* noop */
  });
}

export async function fireTestNotification(mantra?: Partial<Mantra> | null): Promise<void> {
  const soundId = mantra?.soundId || DEFAULT_SOUND_ID;
  if (isNative()) {
    playBellChime(soundId).catch(() => {
      /* noop */
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999_999,
          title: 'Mantrabe',
          body: mantra?.text || 'This is how a reminder will look.',
          schedule: { at: new Date(Date.now() + 1500) },
          sound: soundFile(soundId),
        },
      ],
    });
    return;
  }
  fireWebNotification({
    id: 'test',
    kind: mantra?.kind ?? 'mantra',
    text: mantra?.text || 'This is how a reminder will look.',
    soundId,
    frequencyMinutes: 60,
    activeHours: { start: 0, end: 24 },
    activeDays: [true, true, true, true, true, true, true],
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  });
}
