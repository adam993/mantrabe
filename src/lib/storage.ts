// Local persistence for mantras.
//
// Local storage is the source of truth at all times — the app must work
// fully without an account. Supabase sync is layered on top: when a user
// signs in, we (a) fetch their remote rows and merge with local, and
// (b) upsert local writes to Supabase. Sign-out leaves local data alone.
//
// We import @capacitor/* statically: Vite resolves them at build time, so
// they're bundled into the main chunk. Dynamic imports caused a blank
// screen on Android when the WebView failed to fetch a sub-chunk before
// the app's first render.

import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SOUND_ID } from '@/lib/sounds';
import { isNative } from '@/lib/platform';
import { supabase } from '@/lib/supabase';
import type { EntryKind, Mantra } from '@/types/mantra';

const KEY = 'mantrabe.mantras.v1';
const PERMISSION_KEY = 'mantrabe.notifPermissionAsked.v1';

async function readRaw(key: string): Promise<string | null> {
  if (isNative()) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (isNative()) {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeMantra(input: Partial<Mantra> = {}): Mantra {
  return {
    id: input.id || newId(),
    kind: input.kind || 'mantra',
    text: input.text || '',
    frequencyMinutes: input.frequencyMinutes ?? 60,
    activeHours: input.activeHours || { start: 9, end: 21 },
    activeDays: input.activeDays || [true, true, true, true, true, false, false],
    enabled: input.enabled ?? true,
    soundId: input.soundId || DEFAULT_SOUND_ID,
    createdAt: input.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    remoteSyncedAt: input.remoteSyncedAt,
  };
}

export async function loadLocalMantras(): Promise<Mantra[]> {
  const raw = await readRaw(KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  // Backfill `kind` and `soundId` for entries created before those fields
  // existed. Anything pre-kind is treated as a contemplative mantra.
  return parsed.map((m: Partial<Mantra>) => ({
    ...m,
    kind: (m.kind as EntryKind | undefined) || 'mantra',
    soundId: m.soundId || DEFAULT_SOUND_ID,
  })) as Mantra[];
}

export async function saveLocalMantras(mantras: Mantra[]): Promise<void> {
  await writeRaw(KEY, JSON.stringify(mantras));
}

export async function upsertLocal(mantra: Mantra): Promise<Mantra> {
  const list = await loadLocalMantras();
  const idx = list.findIndex((m) => m.id === mantra.id);
  const next = { ...mantra, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  await saveLocalMantras(list);
  return next;
}

export async function deleteLocal(id: string): Promise<void> {
  const list = await loadLocalMantras();
  await saveLocalMantras(list.filter((m) => m.id !== id));
}

export async function getPermissionAsked(): Promise<boolean> {
  return (await readRaw(PERMISSION_KEY)) === '1';
}
export async function setPermissionAsked(): Promise<void> {
  await writeRaw(PERMISSION_KEY, '1');
}

// --- Supabase sync layer -----------------------------------------------------
//
// Schema (see supabase/schema.sql):
//   create table mantras (
//     id uuid primary key,
//     user_id uuid not null references auth.users(id) on delete cascade,
//     text text not null,
//     frequency_minutes int not null,
//     active_hours_start int not null,
//     active_hours_end int not null,
//     active_days bool[] not null,
//     enabled bool not null,
//     sound_id text not null,
//     created_at timestamptz not null,
//     updated_at timestamptz not null
//   );
// RLS: user can read/write only rows where user_id = auth.uid().

interface RemoteRow {
  id: string;
  user_id: string;
  kind: EntryKind;
  text: string;
  frequency_minutes: number;
  active_hours_start: number;
  active_hours_end: number;
  active_days: boolean[];
  enabled: boolean;
  sound_id: string;
  created_at: string;
  updated_at: string;
}

function rowToMantra(row: RemoteRow): Mantra {
  return {
    id: row.id,
    kind: row.kind || 'mantra',
    text: row.text,
    frequencyMinutes: row.frequency_minutes,
    activeHours: { start: row.active_hours_start, end: row.active_hours_end },
    activeDays: row.active_days,
    enabled: row.enabled,
    soundId: row.sound_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    remoteSyncedAt: Date.now(),
  };
}

function mantraToRow(m: Mantra, userId: string): RemoteRow {
  return {
    id: m.id,
    user_id: userId,
    kind: m.kind,
    text: m.text,
    frequency_minutes: m.frequencyMinutes,
    active_hours_start: m.activeHours.start,
    active_hours_end: m.activeHours.end,
    active_days: m.activeDays,
    enabled: m.enabled,
    sound_id: m.soundId,
    created_at: new Date(m.createdAt).toISOString(),
    updated_at: new Date(m.updatedAt).toISOString(),
  };
}

export async function pullRemote(userId: string): Promise<Mantra[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mantras')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data as RemoteRow[]).map(rowToMantra);
}

export async function pushRemote(mantra: Mantra, userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('mantras').upsert(mantraToRow(mantra, userId));
  if (error) throw error;
}

export async function deleteRemote(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('mantras').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Last-write-wins merge of local and remote mantras.
 *
 * - For each id present in both: keep the one with the larger `updatedAt`.
 * - Rows only in remote → adopt locally (user signed in on a new device).
 * - Rows only in local → push to remote (offline edits, first sync).
 *
 * Returns the merged set so the caller can persist it locally and refresh state.
 */
export async function syncWithRemote(userId: string): Promise<Mantra[]> {
  if (!supabase) return loadLocalMantras();

  const [local, remote] = await Promise.all([loadLocalMantras(), pullRemote(userId)]);

  const byId = new Map<string, Mantra>();
  for (const m of local) byId.set(m.id, m);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || r.updatedAt > existing.updatedAt) byId.set(r.id, r);
  }

  const merged = Array.from(byId.values());
  await saveLocalMantras(merged);

  // Push any local rows that are newer than (or absent from) remote.
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const toPush = merged.filter((m) => {
    const r = remoteById.get(m.id);
    return !r || m.updatedAt > r.updatedAt;
  });
  await Promise.all(toPush.map((m) => pushRemote(m, userId)));

  return merged;
}
