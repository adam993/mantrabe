import * as React from 'react';
import {
  loadLocalMantras,
  upsertLocal,
  deleteLocal,
  pushRemote,
  deleteRemote,
  syncWithRemote,
} from '@/lib/storage';
import { rescheduleAll, subscribeNotificationLifecycle } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import type { Mantra } from '@/types/mantra';

export interface UseMantras {
  mantras: Mantra[];
  loaded: boolean;
  saveMantra: (mantra: Mantra) => Promise<void>;
  removeMantra: (id: string) => Promise<void>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  syncing: boolean;
  syncError: string | null;
}

export function useMantras(): UseMantras {
  const { user } = useAuth();
  const [mantras, setMantras] = React.useState<Mantra[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  const userId = user?.id ?? null;

  // Native scheduling pre-schedules only the *next* occurrence per mantra
  // so a fresh fire replaces the previous tray entry. Lifecycle events —
  // notification fired in foreground, user tapped, or app resumed —
  // trigger a re-schedule using the freshest mantra list via this ref.
  const mantrasRef = React.useRef<Mantra[]>([]);
  React.useEffect(() => {
    mantrasRef.current = mantras;
  }, [mantras]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalMantras();
      if (cancelled) return;
      setMantras(local);
      setLoaded(true);
      // Reschedule on load so reminders survive app restarts.
      rescheduleAll(local).catch((err) => console.error('rescheduleAll failed:', err));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return subscribeNotificationLifecycle(() => mantrasRef.current);
  }, []);

  // When the user signs in (or changes), pull from remote and merge locally.
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setSyncing(true);
    setSyncError(null);
    syncWithRemote(userId)
      .then((merged) => {
        if (cancelled) return;
        setMantras(merged);
        rescheduleAll(merged).catch((err) => console.error('rescheduleAll failed:', err));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('syncWithRemote failed:', err);
        setSyncError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveMantra = React.useCallback(
    async (mantra: Mantra) => {
      const { saved, list } = await upsertLocal(mantra);
      setMantras(list);
      await rescheduleAll(list);
      if (userId) {
        try {
          await pushRemote(saved, userId);
        } catch (err: unknown) {
          console.error('pushRemote failed:', err);
          setSyncError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [userId],
  );

  const removeMantra = React.useCallback(
    async (id: string) => {
      const list = await deleteLocal(id);
      setMantras(list);
      await rescheduleAll(list);
      if (userId) {
        try {
          await deleteRemote(id);
        } catch (err: unknown) {
          console.error('deleteRemote failed:', err);
          setSyncError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [userId],
  );

  const toggleEnabled = React.useCallback(
    async (id: string, enabled: boolean) => {
      const current = (await loadLocalMantras()).find((m) => m.id === id);
      if (!current) return;
      await saveMantra({ ...current, enabled });
    },
    [saveMantra],
  );

  const syncNow = React.useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const merged = await syncWithRemote(userId);
      setMantras(merged);
      await rescheduleAll(merged);
    } catch (err: unknown) {
      console.error('syncNow failed:', err);
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  return { mantras, loaded, saveMantra, removeMantra, toggleEnabled, syncNow, syncing, syncError };
}
