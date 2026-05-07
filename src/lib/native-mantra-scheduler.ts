// JS surface for the in-app Capacitor plugin defined in
// android-native-src/.../MantraSchedulerPlugin.java.
//
// Lives only on Android. The plugin replaces @capacitor/local-notifications
// for ongoing mantra scheduling so that a) reminders survive the JS
// process being killed (the native BroadcastReceiver self-reschedules on
// each fire) and b) reminders survive device reboot (the boot receiver
// re-arms from SharedPreferences). iOS continues to use the upstream
// plugin since iOS local notifications already survive process death.

import { registerPlugin } from '@capacitor/core';

export interface NativeMantra {
  id: string;
  text: string;
  frequencyMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  // Mon=bit0 ... Sun=bit6. Matches src/lib/scheduler.ts day indexing.
  activeDaysMask: number;
  // When non-empty, scheduling fires at exactly these hours (0–23) on each
  // active day; frequencyMinutes / activeHours are ignored. Empty array =
  // frequency / once-a-day mode.
  specificTimes: number[];
  // Filename without extension (e.g. "clear_bell"); the plugin resolves
  // it as a raw resource. Null/empty → channel default sound.
  soundId: string | null;
}

// Snapshot of every Android-side gate that affects whether reminders
// actually fire. The reliability banner reads this on mount and after
// the user returns from any settings deep-link.
export interface ReliabilityStatus {
  manufacturer: string;
  brand: string;
  model: string;
  sdkInt: number;
  exactAlarmsAllowed: boolean;
  ignoringBatteryOptimizations: boolean;
  // True when the OEM-specific "auto-start / protected apps" page
  // resolves on this device. False on stock Android and on OEMs whose
  // package names have rotated past our table — the JS layer falls
  // back to the generic app-info link in that case.
  oemAutostartAvailable: boolean;
  // Hint that this brand is known for aggressive background killing
  // even when permissions are healthy — surface the autostart nudge
  // proactively rather than waiting for a missed reminder.
  isAggressiveOem: boolean;
}

export interface MantraSchedulerPluginI {
  scheduleAll(opts: { mantras: NativeMantra[] }): Promise<{ count: number }>;
  cancelAll(): Promise<void>;
  getReliabilityStatus(): Promise<ReliabilityStatus>;
  requestIgnoreBatteryOptimizations(): Promise<{
    alreadyExempt: boolean;
    launched: boolean;
  }>;
  openExactAlarmSettings(): Promise<{ launched: boolean }>;
  openOemAutostartSettings(): Promise<{
    opened: boolean;
    oemSpecific: boolean;
    manufacturer: string;
  }>;
  openAppNotificationSettings(): Promise<{ launched: boolean }>;
}

export const MantraScheduler =
  registerPlugin<MantraSchedulerPluginI>('MantraScheduler');
