import * as React from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isAndroid, isNative } from '@/lib/platform';
import {
  MantraScheduler,
  type ReliabilityStatus,
} from '@/lib/native-mantra-scheduler';

// Polls the native MantraScheduler.getReliabilityStatus on mount and
// whenever the app is resumed from background — that's the moment after
// the user has likely just changed a system setting in response to one
// of our deep-links, so the banner needs to re-render right then. Web /
// iOS return null (the surface is Android-only).
export function useReliabilityStatus(): {
  status: ReliabilityStatus | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = React.useState<ReliabilityStatus | null>(null);

  const refresh = React.useCallback(async () => {
    if (!isNative() || !isAndroid()) return;
    try {
      const next = await MantraScheduler.getReliabilityStatus();
      setStatus(next);
    } catch (err) {
      console.error('getReliabilityStatus failed:', err);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!isNative()) return;
    const handle = CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) void refresh();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [refresh]);

  return { status, refresh };
}
