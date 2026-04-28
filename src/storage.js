// Local persistence for mantras.
// Uses Capacitor Preferences on native platforms, localStorage everywhere
// else. Both are local-only — no cloud sync, no auth.
//
// We import @capacitor/* statically: Vite resolves them at build time, so
// they're bundled into the main chunk. Dynamic imports caused a blank
// screen on Android when the WebView failed to fetch a sub-chunk before
// the app's first render.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SOUND_ID } from './sounds.js';

const KEY = 'mantrabe.mantras.v1';
const PERMISSION_KEY = 'mantrabe.notifPermissionAsked.v1';

function useNative() {
  try {
    return Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function readRaw(key) {
  if (useNative()) {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (err) {
      console.warn('Preferences.get failed, falling back to localStorage:', err);
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeRaw(key, value) {
  if (useNative()) {
    try {
      await Preferences.set({ key, value });
      return;
    } catch (err) {
      console.warn('Preferences.set failed, falling back to localStorage:', err);
    }
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private mode etc. — silently drop.
  }
}

export async function loadMantras() {
  const raw = await readRaw(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Backfill soundId on mantras created before sound choice existed.
    return parsed.map((m) => (m.soundId ? m : { ...m, soundId: DEFAULT_SOUND_ID }));
  } catch {
    return [];
  }
}

export async function saveMantras(mantras) {
  await writeRaw(KEY, JSON.stringify(mantras));
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeMantra(input = {}) {
  return {
    id: input.id || newId(),
    text: input.text || '',
    frequencyMinutes: input.frequencyMinutes ?? 60,
    activeHours: input.activeHours || { start: 9, end: 21 },
    activeDays: input.activeDays || [true, true, true, true, true, false, false],
    enabled: input.enabled ?? true,
    soundId: input.soundId || DEFAULT_SOUND_ID,
    createdAt: input.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

export async function upsertMantra(mantra) {
  const list = await loadMantras();
  const idx = list.findIndex((m) => m.id === mantra.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...mantra, updatedAt: Date.now() };
  else list.push(mantra);
  await saveMantras(list);
  return mantra;
}

export async function deleteMantra(id) {
  const list = await loadMantras();
  const filtered = list.filter((m) => m.id !== id);
  await saveMantras(filtered);
}

export async function getPermissionAsked() {
  return (await readRaw(PERMISSION_KEY)) === '1';
}
export async function setPermissionAsked() {
  await writeRaw(PERMISSION_KEY, '1');
}
