// Cross-platform notification layer.
//
// Native (Capacitor): schedules a batch of LocalNotifications with the
// bundled church_bell.wav sound. We pre-schedule the next ~50 occurrences
// per mantra and reschedule whenever the user changes anything.
//
// Web/Electron: a single in-app setTimeout points at the next occurrence
// of any mantra. When it fires we show a Notification, play the bell,
// then recompute. The Electron preload bridges system Notification API
// into the renderer.
//
// All @capacitor/* imports are static: Vite bundles them into the main
// chunk, so we never have to wait on a sub-chunk fetch before the first
// notification call (which used to cause init() to reject before the UI
// rendered, resulting in a blank screen on Android).

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { computeNextOccurrences } from './scheduler.js';
import { playBellChime } from './bell-chime.js';

function isNative() {
  try {
    return Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function requestPermission() {
  if (isNative()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted';
    } catch (err) {
      console.warn('LocalNotifications.requestPermissions failed:', err);
      return false;
    }
  }
  if ('Notification' in globalThis) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export async function getPermissionState() {
  if (isNative()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      return res.display; // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
    } catch (err) {
      console.warn('LocalNotifications.checkPermissions failed:', err);
      return 'prompt';
    }
  }
  if ('Notification' in globalThis) return Notification.permission;
  return 'denied';
}

// --- Scheduling --------------------------------------------------------------

const PER_MANTRA_LOOKAHEAD = 50;

export async function rescheduleAll(mantras) {
  if (isNative()) {
    try {
      await rescheduleNative(mantras);
    } catch (err) {
      console.warn('rescheduleNative failed:', err);
    }
  } else {
    rescheduleWeb(mantras);
  }
}

async function rescheduleNative(mantras) {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications && pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  const enabled = mantras.filter((m) => m.enabled && m.text.trim());
  if (enabled.length === 0) return;

  let entries = [];
  for (const mantra of enabled) {
    const occ = computeNextOccurrences(mantra, PER_MANTRA_LOOKAHEAD);
    for (const at of occ) entries.push({ at, mantra });
  }
  entries.sort((a, b) => a.at - b.at);
  entries = entries.slice(0, 60); // stay below iOS's 64-pending cap

  const notifications = entries.map((e, i) => ({
    id: i + 1,
    title: 'Mantrabe',
    body: e.mantra.text,
    schedule: { at: e.at, allowWhileIdle: true },
    sound: 'church_bell.wav',
    extra: { mantraId: e.mantra.id },
  }));

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

// --- Web / Electron timer-based scheduler ------------------------------------

let webTimerId = null;
let webMantrasCache = [];
let webElectronBridge = null;

function getElectronBridge() {
  if (webElectronBridge !== null) return webElectronBridge;
  webElectronBridge = (typeof window !== 'undefined' && window.mantrabe) || false;
  return webElectronBridge;
}

function rescheduleWeb(mantras) {
  webMantrasCache = mantras.filter((m) => m.enabled && m.text.trim());
  if (webTimerId) {
    clearTimeout(webTimerId);
    webTimerId = null;
  }
  if (webMantrasCache.length === 0) return;

  const now = new Date();
  let nextTime = null;
  let nextMantra = null;
  for (const m of webMantrasCache) {
    const occ = computeNextOccurrences(m, 1, now);
    if (occ.length && (!nextTime || occ[0] < nextTime)) {
      nextTime = occ[0];
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
      fireWebNotification(nextMantra);
      rescheduleWeb(webMantrasCache);
    }
  }, useDelay);
}

function fireWebNotification(mantra) {
  const bridge = getElectronBridge();
  if (bridge && bridge.notify) {
    bridge.notify({ title: 'Mantrabe', body: mantra.text });
  } else if ('Notification' in globalThis && Notification.permission === 'granted') {
    try {
      const n = new Notification('Mantrabe', { body: mantra.text, silent: true });
      n.onclick = () => { try { window.focus(); } catch {} };
    } catch {
      // mobile Safari restricts the constructor — just play the chime.
    }
  }
  playBellChime().catch(() => {});
}

export async function fireTestNotification(mantra) {
  if (isNative()) {
    // Play the chime in-app right away so the user gets immediate feedback
    // regardless of whether the OS notification surfaces. (On Android, a
    // mis-configured notification — e.g. invalid smallIcon — can be silently
    // dropped, so without this the button felt broken.) The fireWebNotification
    // path already plays the chime itself.
    playBellChime().catch(() => {});
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999_999,
            title: 'Mantrabe',
            body: (mantra && mantra.text) || 'This is how a reminder will look.',
            schedule: { at: new Date(Date.now() + 1500) },
            sound: 'church_bell.wav',
          },
        ],
      });
    } catch (err) {
      console.warn('Test notification failed:', err);
    }
    return;
  }
  fireWebNotification(mantra || { text: 'This is how a reminder will look.' });
}
