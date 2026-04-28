// Cross-platform notification layer.
//
// Native (Capacitor): schedule a batch of LocalNotifications with the bundled
// bell.wav sound. We pre-schedule the next ~50 occurrences per mantra and
// reschedule whenever the user changes anything.
//
// Web/Electron: we manage a single in-app setTimeout pointing at the next
// occurrence of *any* mantra. When it fires, we show a Notification, play
// the bell chime, then recompute. The Electron preload bridges the system
// Notification API into the renderer.

import { computeNextOccurrences } from './scheduler.js';
import { playBellChime } from './bell-chime.js';

let CapacitorRef = null;
let LocalNotificationsRef = null;

async function getCapacitor() {
  if (CapacitorRef !== null) return CapacitorRef;
  try {
    const mod = await import('@capacitor/core');
    CapacitorRef = mod.Capacitor;
  } catch {
    CapacitorRef = false;
  }
  return CapacitorRef;
}

async function getLocalNotifications() {
  if (LocalNotificationsRef !== null) return LocalNotificationsRef;
  try {
    const mod = await import('@capacitor/local-notifications');
    LocalNotificationsRef = mod.LocalNotifications;
  } catch {
    LocalNotificationsRef = false;
  }
  return LocalNotificationsRef;
}

function isNative(cap) {
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
}

export async function requestPermission() {
  const cap = await getCapacitor();
  if (isNative(cap)) {
    const LN = await getLocalNotifications();
    if (LN) {
      const res = await LN.requestPermissions();
      return res.display === 'granted';
    }
  }
  if ('Notification' in globalThis) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

export async function getPermissionState() {
  const cap = await getCapacitor();
  if (isNative(cap)) {
    const LN = await getLocalNotifications();
    if (LN) {
      const res = await LN.checkPermissions();
      return res.display; // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
    }
  }
  if ('Notification' in globalThis) return Notification.permission; // 'granted' | 'denied' | 'default'
  return 'denied';
}

// --- Scheduling --------------------------------------------------------------

const PER_MANTRA_LOOKAHEAD = 50; // generous; iOS caps at 64 total, Android up to 500.

export async function rescheduleAll(mantras) {
  const cap = await getCapacitor();
  if (isNative(cap)) {
    await rescheduleNative(mantras);
  } else {
    rescheduleWeb(mantras);
  }
}

async function rescheduleNative(mantras) {
  const LN = await getLocalNotifications();
  if (!LN) return;

  // Cancel everything pending.
  const pending = await LN.getPending();
  if (pending.notifications && pending.notifications.length > 0) {
    await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const enabled = mantras.filter((m) => m.enabled && m.text.trim());
  if (enabled.length === 0) return;

  // Generate, then sort and trim to platform-safe size (iOS: 64).
  let entries = [];
  for (const mantra of enabled) {
    const occ = computeNextOccurrences(mantra, PER_MANTRA_LOOKAHEAD);
    for (const at of occ) entries.push({ at, mantra });
  }
  entries.sort((a, b) => a.at - b.at);
  entries = entries.slice(0, 60); // keep margin under iOS cap

  const notifications = entries.map((e, i) => ({
    id: i + 1,
    title: 'Mantrabe',
    body: e.mantra.text,
    schedule: { at: e.at, allowWhileIdle: true },
    sound: 'bell.wav',
    smallIcon: 'ic_stat_icon_config_sample',
    extra: { mantraId: e.mantra.id },
  }));

  if (notifications.length > 0) {
    await LN.schedule({ notifications });
  }
}

// --- Web / Electron timer-based scheduler ------------------------------------
// We keep a single timer, since recomputing is cheap and avoids drift from
// many overlapping setTimeout calls. The handler re-runs rescheduleWeb after
// firing to chain to the next occurrence.

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
  // setTimeout is capped at ~24.8 days (2^31-1 ms). Cap our delay below that
  // and re-arm if we hit the cap.
  const MAX = 2_000_000_000;
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
      n.onclick = () => {
        try { window.focus(); } catch {}
      };
    } catch {
      // Some browsers (notably mobile Safari) restrict the constructor.
    }
  }
  // Always play the bell when the app has audio context — this is what
  // gives the chime on web/Electron, since system notification sounds
  // are platform-specific.
  playBellChime().catch(() => {});
}

export async function fireTestNotification(mantra) {
  // Play the chime + show a notification immediately.
  const cap = await getCapacitor();
  if (isNative(cap)) {
    const LN = await getLocalNotifications();
    if (LN) {
      // Schedule ~2s out so the OS actually shows it (immediate schedule is
      // unreliable on iOS).
      await LN.schedule({
        notifications: [
          {
            id: 999_999,
            title: 'Mantrabe',
            body: mantra.text || 'This is how a reminder will look.',
            schedule: { at: new Date(Date.now() + 1500) },
            sound: 'bell.wav',
            smallIcon: 'ic_stat_icon_config_sample',
          },
        ],
      });
    }
    return;
  }
  // Web/Electron: fire immediately.
  fireWebNotification(mantra || { text: 'This is how a reminder will look.' });
}
