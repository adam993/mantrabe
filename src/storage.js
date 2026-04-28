// Local persistence for mantras.
// Uses Capacitor Preferences on native platforms (survives app reinstall data
// purges better than localStorage in some edge cases) and localStorage on web/Electron.
// Both are local-only — no cloud sync, no auth.

const KEY = 'mantrabe.mantras.v1';
const PERMISSION_KEY = 'mantrabe.notifPermissionAsked.v1';

let cachedNative = null;
async function getNative() {
  if (cachedNative !== null) return cachedNative;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      cachedNative = Preferences;
      return Preferences;
    }
  } catch {
    // Capacitor not available — running in plain web/Electron.
  }
  cachedNative = false;
  return false;
}

async function readRaw(key) {
  const native = await getNative();
  if (native) {
    const { value } = await native.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

async function writeRaw(key, value) {
  const native = await getNative();
  if (native) {
    await native.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function loadMantras() {
  const raw = await readRaw(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveMantras(mantras) {
  await writeRaw(KEY, JSON.stringify(mantras));
}

function newId() {
  // crypto.randomUUID is available in modern browsers and Node.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeMantra(input = {}) {
  return {
    id: input.id || newId(),
    text: input.text || '',
    frequencyMinutes: input.frequencyMinutes ?? 60,
    activeHours: input.activeHours || { start: 9, end: 21 },
    // Mon..Sun. Default: weekdays only.
    activeDays: input.activeDays || [true, true, true, true, true, false, false],
    enabled: input.enabled ?? true,
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
