// Single place for "where am I running?" checks. Capacitor + Electron are
// both detected through guarded calls so a missing global never throws —
// callers can rely on these returning a boolean / known string.

import { Capacitor } from '@capacitor/core';

export type PlatformName = 'web' | 'ios' | 'android';

export interface ElectronBridge {
  isElectron?: boolean;
  notify?: (payload: { title: string; body: string }) => Promise<boolean> | boolean;
}

export function getPlatform(): PlatformName {
  try {
    return Capacitor.getPlatform() as PlatformName;
  } catch {
    return 'web';
  }
}

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/** Returns the Electron preload bridge if we're running inside the desktop
 *  shell, else null. The renderer's window has `mantrabe.isElectron` only
 *  when electron/preload.cjs has executed. */
export function getElectronBridge(): ElectronBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { mantrabe?: ElectronBridge }).mantrabe;
  return bridge && bridge.isElectron ? bridge : null;
}

export function isElectron(): boolean {
  return !!getElectronBridge();
}
