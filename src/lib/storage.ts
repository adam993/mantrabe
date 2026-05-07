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
// User clicked "Already done" on the OEM autostart row in the
// reliability dialog — we can't programmatically verify that the OEM
// killer has been turned off, so we trust the user and stop nagging.
const OEM_AUTOSTART_DONE_KEY = 'mantrabe.reliabilityOemDone.v1';

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
    specificTimes: input.specificTimes,
    enabled: input.enabled ?? true,
    soundId: input.soundId || DEFAULT_SOUND_ID,
    createdAt: input.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    remoteSyncedAt: input.remoteSyncedAt,
    slotIndex: input.slotIndex,
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

/** Returns both the saved mantra (with refreshed updatedAt) and the
 *  new list, so callers don't have to re-read storage to refresh state. */
export async function upsertLocal(
  mantra: Mantra,
): Promise<{ saved: Mantra; list: Mantra[] }> {
  const list = await loadLocalMantras();
  const idx = list.findIndex((m) => m.id === mantra.id);
  const saved = { ...mantra, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = { ...list[idx], ...saved };
  else list.push(saved);
  await saveLocalMantras(list);
  return { saved, list };
}

/** Stamp the `remoteSyncedAt` flag on a local row without touching
 *  `updatedAt`. Bumping `updatedAt` here would make the row look newer
 *  than its just-pushed remote twin and force a redundant re-push on the
 *  next sync. */
export async function markLocalSynced(id: string, syncedAt: number): Promise<Mantra[]> {
  const list = await loadLocalMantras();
  const idx = list.findIndex((m) => m.id === id);
  const current = list[idx];
  if (!current) return list;
  list[idx] = { ...current, remoteSyncedAt: syncedAt };
  await saveLocalMantras(list);
  return list;
}

/** Insert/update locally without re-stamping `updatedAt`. Used when a row
 *  arrives from Supabase Realtime — the remote `updated_at` is already
 *  authoritative. Skips the write entirely when our local copy is the
 *  same age or newer, which suppresses echo from our own pushes. */
export async function applyRemoteUpsert(mantra: Mantra): Promise<Mantra[]> {
  const list = await loadLocalMantras();
  const idx = list.findIndex((m) => m.id === mantra.id);
  const existing = idx >= 0 ? list[idx] : undefined;
  if (existing && existing.updatedAt >= mantra.updatedAt) return list;
  if (existing) list[idx] = mantra;
  else list.push(mantra);
  await saveLocalMantras(list);
  return list;
}

/** Returns the new list so callers don't have to re-read storage. */
export async function deleteLocal(id: string): Promise<Mantra[]> {
  const list = await loadLocalMantras();
  const next = list.filter((m) => m.id !== id);
  await saveLocalMantras(next);
  return next;
}

export async function getPermissionAsked(): Promise<boolean> {
  return (await readRaw(PERMISSION_KEY)) === '1';
}
export async function setPermissionAsked(): Promise<void> {
  await writeRaw(PERMISSION_KEY, '1');
}

export async function getOemAutostartDone(): Promise<boolean> {
  return (await readRaw(OEM_AUTOSTART_DONE_KEY)) === '1';
}
export async function setOemAutostartDone(value: boolean): Promise<void> {
  await writeRaw(OEM_AUTOSTART_DONE_KEY, value ? '1' : '0');
}

// --- Supabase sync layer -----------------------------------------------------
//
// Schema (see supabase/schema.sql):
//   create table mantras (
//     id uuid primary key,
//     user_id uuid not null references auth.users(id) on delete cascade,
//     kind text not null check (kind in ('mantra', 'reminder')),
//     text text not null,
//     frequency_minutes int not null,
//     active_hours_start int not null,
//     active_hours_end int not null,
//     active_days bool[] not null,
//     specific_times int[] not null default '{}',
//     enabled bool not null,
//     sound_id text not null,
//     created_at timestamptz not null,
//     updated_at timestamptz not null
//   );
// RLS: user can read/write only rows where user_id = auth.uid().

export interface RemoteRow {
  id: string;
  user_id: string;
  kind: EntryKind;
  text: string;
  frequency_minutes: number;
  active_hours_start: number;
  active_hours_end: number;
  active_days: boolean[];
  /** Array of hours (0–23). Empty = mantra uses frequency / once-a-day mode. */
  specific_times: number[];
  enabled: boolean;
  sound_id: string;
  created_at: string;
  updated_at: string;
  /** Bonsai leaf slot (0–14). Null = no manual override; bonsai page sorts
   *  by created_at. Older rows pre-date this column and arrive as null. */
  slot_index: number | null;
}

export function rowToMantra(row: RemoteRow): Mantra {
  return {
    id: row.id,
    kind: row.kind || 'mantra',
    text: row.text,
    frequencyMinutes: row.frequency_minutes,
    activeHours: { start: row.active_hours_start, end: row.active_hours_end },
    activeDays: row.active_days,
    specificTimes:
      Array.isArray(row.specific_times) && row.specific_times.length > 0
        ? row.specific_times
        : undefined,
    enabled: row.enabled,
    soundId: row.sound_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    remoteSyncedAt: Date.now(),
    slotIndex:
      typeof row.slot_index === 'number' &&
      row.slot_index >= 0 &&
      row.slot_index <= 14
        ? row.slot_index
        : undefined,
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
    specific_times: m.specificTimes ?? [],
    enabled: m.enabled,
    sound_id: m.soundId,
    created_at: new Date(m.createdAt).toISOString(),
    updated_at: new Date(m.updatedAt).toISOString(),
    slot_index: typeof m.slotIndex === 'number' ? m.slotIndex : null,
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

/** Push a mantra to Supabase. Returns the local-form mantra with
 *  `remoteSyncedAt` stamped so the caller can persist that flag — required
 *  for tombstone-style delete propagation in `syncWithRemote`. */
export async function pushRemote(mantra: Mantra, userId: string): Promise<Mantra> {
  if (!supabase) return mantra;
  const { error } = await supabase.from('mantras').upsert(mantraToRow(mantra, userId));
  if (error) throw error;
  return { ...mantra, remoteSyncedAt: Date.now() };
}

export async function deleteRemote(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('mantras').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Last-write-wins merge of local and remote mantras, with delete
 * propagation via the `remoteSyncedAt` tombstone flag.
 *
 * - Row present in both: keep the one with the larger `updatedAt`.
 * - Row only in remote: adopt locally (user signed in on a new device).
 * - Row only in local AND `remoteSyncedAt` is set: it was previously
 *   mirrored to remote and is now gone → it was deleted on another
 *   device. Drop it locally instead of resurrecting it.
 * - Row only in local AND `remoteSyncedAt` is unset: never pushed yet
 *   (offline edit, fresh sign-in) → keep and push to remote.
 *
 * After successful pushes, `remoteSyncedAt` is stamped on the pushed
 * rows and persisted locally so a future sync can correctly tell the
 * difference between "deleted remotely" and "never synced."
 */
export async function syncWithRemote(userId: string): Promise<Mantra[]> {
  if (!supabase) return loadLocalMantras();

  const [local, remote] = await Promise.all([loadLocalMantras(), pullRemote(userId)]);
  const remoteById = new Map(remote.map((r) => [r.id, r]));

  const merged: Mantra[] = [];
  const toPush: Mantra[] = [];

  for (const m of local) {
    const r = remoteById.get(m.id);
    if (r) {
      // Both have it — newer wins.
      merged.push(m.updatedAt > r.updatedAt ? m : r);
    } else if (m.remoteSyncedAt) {
      // Was mirrored before, now gone from remote → tombstone, drop it.
      continue;
    } else {
      // Local-only, never pushed → keep and queue for push.
      merged.push(m);
      toPush.push(m);
    }
  }
  // Pull-only rows (in remote, not in local) → adopt.
  const localIds = new Set(local.map((m) => m.id));
  for (const r of remote) if (!localIds.has(r.id)) merged.push(r);

  // Push first so the post-push stamp is reflected in saved state.
  if (toPush.length > 0) {
    const pushed = await Promise.all(toPush.map((m) => pushRemote(m, userId)));
    const pushedById = new Map(pushed.map((p) => [p.id, p]));
    for (let i = 0; i < merged.length; i++) {
      const row = merged[i];
      if (!row) continue;
      const stamped = pushedById.get(row.id);
      if (stamped) merged[i] = stamped;
    }
  }

  await saveLocalMantras(merged);
  return merged;
}
