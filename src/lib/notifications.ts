// Cross-platform notification layer.
//
// Android: uses our in-app MantraScheduler Capacitor plugin (native code
// in android-native-src/). Each enabled mantra gets ONE alarm at a time,
// keyed by a stable per-mantra notification id. When that alarm fires:
//   - Android's NotificationManager replaces the previous tray entry
//     for that mantra (same id → same slot), so a new fire of "Drink
//     water" overwrites the old one instead of stacking.
//   - The native BroadcastReceiver immediately schedules the next
//     occurrence — runs even if the JS process is dead. Reboot is
//     handled by the boot receiver re-arming from SharedPreferences.
//
// iOS: continues to use @capacitor/local-notifications. iOS schedules
// UNUserNotifications natively which fire as scheduled even with the app
// killed, so we pre-schedule N occurrences with stable ids and let the
// system handle them.
//
// Web/Electron: a single in-app setTimeout points at the next occurrence
// of any mantra. When it fires we show a Notification, play the bell,
// then recompute.

import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapacitorApp } from '@capacitor/app';
import { computeNextOccurrences } from '@/lib/scheduler';
import { playBellChime } from '@/lib/bell-chime';
import { soundFile, DEFAULT_SOUND_ID } from '@/lib/sounds';
import { getElectronBridge, isAndroid, isIOS, isNative } from '@/lib/platform';
import { MantraScheduler, type NativeMantra } from '@/lib/native-mantra-scheduler';
import type { Mantra } from '@/types/mantra';

// iOS channel — unused on Android (the native plugin manages its own
// per-sound channels). Channels are immutable after first create on
// the device, so bumping the suffix is the only way to apply changed
// importance/sound settings to existing installs.
const IOS_CHANNEL_ID = 'mantras-default-v1';

let iosChannelEnsured = false;
async function ensureIOSChannel(): Promise<void> {
  if (iosChannelEnsured || !isNative() || !isIOS()) return;
  await LocalNotifications.createChannel({
    id: IOS_CHANNEL_ID,
    name: 'Mantras',
    description: 'Scheduled mantras and reminders',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });
  iosChannelEnsured = true;
}

// Stable 31-bit positive int derived from a mantra's UUID; same hash as
// MantraScheduler.notificationId in the Java side so the iOS-vs-Android
// id space stays consistent even though only Android uses the value as
// an AlarmManager request code.
function mantraNotificationId(mantraId: string): number {
  let h = 5381;
  for (let i = 0; i < mantraId.length; i++) {
    h = ((h << 5) + h + mantraId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 0x7fffffff || 1;
}

function activeDaysMask(days: boolean[]): number {
  let mask = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i]) mask |= 1 << i;
  }
  return mask;
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

// Normalized to the three web NotificationPermission states. Capacitor
// can return 'prompt' / 'prompt-with-rationale' on Android; both fold
// into 'default' so banner/intro consumers don't have to care.
export async function getPermissionState(): Promise<NotificationPermission> {
  if (isNative()) {
    const res = await LocalNotifications.checkPermissions();
    if (res.display === 'granted') return 'granted';
    if (res.display === 'denied') return 'denied';
    return 'default';
  }
  if ('Notification' in globalThis) return Notification.permission;
  return 'denied';
}

export async function rescheduleAll(mantras: Mantra[]): Promise<void> {
  if (isAndroid()) {
    await rescheduleAndroid(mantras);
  } else if (isIOS()) {
    await rescheduleIOS(mantras);
  } else {
    rescheduleWeb(mantras);
  }
}

async function rescheduleAndroid(mantras: Mantra[]): Promise<void> {
  const enabled = mantras.filter((m) => m.enabled && m.text.trim());
  const native: NativeMantra[] = enabled.map((m) => ({
    id: m.id,
    text: m.text,
    frequencyMinutes: m.frequencyMinutes,
    activeHoursStart: m.activeHours.start,
    activeHoursEnd: m.activeHours.end,
    activeDaysMask: activeDaysMask(m.activeDays),
    specificTimes: m.specificTimes ?? [],
    soundId: m.soundId || null,
  }));
  await MantraScheduler.scheduleAll({ mantras: native });
}

async function rescheduleIOS(mantras: Mantra[]): Promise<void> {
  await ensureIOSChannel();

  // Cancel everything pending. iOS notifications scheduled with `at`
  // don't repeat from the OS side, so we pre-schedule a window of
  // future occurrences with stable per-mantra ids — same id → same
  // notification slot on iOS, replacing prior fires.
  const pending = await LocalNotifications.getPending();
  if (pending.notifications && pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  const enabled = mantras.filter((m) => m.enabled && m.text.trim());
  if (enabled.length === 0) return;

  const now = new Date();
  const notifications = [];
  for (const mantra of enabled) {
    const occ = computeNextOccurrences(mantra, 1, now);
    if (occ.length === 0) continue;
    notifications.push({
      id: mantraNotificationId(mantra.id),
      title: 'Mantrabe',
      body: mantra.text,
      largeBody: mantra.text,
      schedule: { at: occ[0]!, allowWhileIdle: true },
      sound: soundFile(mantra.soundId),
      channelId: IOS_CHANNEL_ID,
      autoCancel: true,
      extra: { mantraId: mantra.id },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

// Wire native lifecycle events into a single rescheduler. On iOS this
// matters because the JS-side single-occurrence pre-schedule needs
// rerunning when the user returns to the app. On Android the native
// receiver self-reschedules so this is a no-op fallback there, but we
// keep it wired so app-resume still triggers a refresh after settings
// changes outside the app's notice.
export function subscribeNotificationLifecycle(
  getMantras: () => Mantra[],
): () => void {
  if (!isNative()) return () => {};

  let disposed = false;
  const removers: Array<() => void> = [];

  const reschedule = () => {
    if (disposed) return;
    rescheduleAll(getMantras()).catch((err) =>
      console.error('reschedule (lifecycle) failed:', err),
    );
  };

  (async () => {
    const received = await LocalNotifications.addListener(
      'localNotificationReceived',
      reschedule,
    );
    const tapped = await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      reschedule,
    );
    const resumed = await CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) reschedule();
    });
    if (disposed) {
      received.remove();
      tapped.remove();
      resumed.remove();
      return;
    }
    removers.push(
      () => received.remove(),
      () => tapped.remove(),
      () => resumed.remove(),
    );
  })().catch((err) => console.error('subscribeNotificationLifecycle:', err));

  return () => {
    disposed = true;
    for (const r of removers) {
      try {
        r();
      } catch {
        /* noop */
      }
    }
  };
}

let webTimerId: ReturnType<typeof setTimeout> | null = null;
let webMantrasCache: Mantra[] = [];

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
  if (bridge?.notify) {
    bridge.notify({ title: 'Mantrabe', body: mantra.text });
  } else if ('Notification' in globalThis && Notification.permission === 'granted') {
    try {
      // tag = stable per-mantra so a fresh fire replaces the previous one
      // in browser/desktop trays too.
      const n = new Notification('Mantrabe', {
        body: mantra.text,
        silent: true,
        tag: `mantra-${mantra.id}`,
      });
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
  const body = mantra?.text || 'This is how a reminder will look.';
  if (isNative()) {
    if (isIOS()) await ensureIOSChannel();
    playBellChime(soundId).catch(() => {
      /* noop */
    });
    // Tests still go through @capacitor/local-notifications on both
    // native targets — it's a one-shot, no scheduling state to track,
    // and the upstream plugin handles `at: <near future>` cleanly.
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999_999,
          title: 'Mantrabe',
          body,
          largeBody: body,
          schedule: { at: new Date(Date.now() + 1500) },
          sound: soundFile(soundId),
          channelId: isAndroid() ? `mantras-${soundId}-v1` : IOS_CHANNEL_ID,
          autoCancel: true,
        },
      ],
    });
    return;
  }
  fireWebNotification({
    id: 'test',
    kind: mantra?.kind ?? 'mantra',
    text: body,
    soundId,
    frequencyMinutes: 60,
    activeHours: { start: 0, end: 24 },
    activeDays: [true, true, true, true, true, true, true],
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  });
}
