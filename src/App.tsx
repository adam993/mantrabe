import * as React from 'react';
import { Capacitor } from '@capacitor/core';
import { AuthProvider } from '@/lib/auth';
import { useMantras } from '@/hooks/use-mantras';
import { usePermission } from '@/hooks/use-permission';
import { PermissionBanner } from '@/components/permission-banner';
import { MantraList } from '@/components/mantra-list';
import { MantraEditor } from '@/components/mantra-editor';
import { NotificationsIntro } from '@/components/notifications-intro';
import { Footer } from '@/components/footer';
import { SyncErrorToast } from '@/components/sync-error-toast';
import { getPermissionAsked, setPermissionAsked } from '@/lib/storage';
import type { Mantra } from '@/types/mantra';

type Screen = { name: 'intro' } | { name: 'list' } | { name: 'edit'; id: string | null };

function getPlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

function Shell() {
  const {
    mantras,
    loaded,
    saveMantra,
    removeMantra,
    toggleEnabled,
    syncNow,
    syncing,
    syncError,
  } = useMantras();
  const { permission, request, ensure } = usePermission();
  const isAndroid = getPlatform() === 'android';

  // On Android first-run we gate everything behind the notifications intro.
  // We can't decide which screen to show until we've checked Preferences for
  // whether we've already asked, so the shell renders nothing until the
  // initial decision lands.
  const [introResolved, setIntroResolved] = React.useState(!isAndroid);
  const [screen, setScreen] = React.useState<Screen>({ name: 'list' });

  React.useEffect(() => {
    if (!isAndroid) return;
    let cancelled = false;
    getPermissionAsked()
      .then((asked) => {
        if (cancelled) return;
        if (!asked) setScreen({ name: 'intro' });
        setIntroResolved(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('getPermissionAsked failed:', err);
        setIntroResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAndroid]);

  const editing: Mantra | null = React.useMemo(() => {
    if (screen.name !== 'edit' || !screen.id) return null;
    return mantras.find((m) => m.id === screen.id) ?? null;
  }, [screen, mantras]);

  // Hide the topbar logo + AccountMenu and the inline sign-in panel until the
  // user has saved their first entry. Android-only — the web UI keeps its
  // standard chrome at all times.
  const hideChrome = isAndroid && mantras.length === 0;

  if (!loaded || !introResolved) {
    return (
      <div
        data-id="app-shell"
        data-screen="loading"
        className="mx-auto flex min-h-screen w-full flex-1 flex-col pt-[var(--safe-top)]"
      />
    );
  }

  if (screen.name === 'intro') {
    return (
      <div
        data-id="app-shell"
        data-screen="intro"
        className="mx-auto flex min-h-screen w-full flex-1 flex-col pt-[var(--safe-top)]"
      >
        <NotificationsIntro
          showDecline={isAndroid}
          onEnable={async () => {
            await request();
            setScreen({ name: 'list' });
          }}
          onDecline={async () => {
            // Mark as asked so we don't keep gating future launches behind
            // the intro. The permission banner inside the list will still be
            // available if they change their mind.
            await setPermissionAsked();
            setScreen({ name: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-id="app-shell"
      data-screen={screen.name}
      className="mx-auto flex min-h-screen w-full flex-1 flex-col pt-[var(--safe-top)]"
    >
      {!hideChrome && (
        <PermissionBanner permission={permission} onEnable={() => void request()} />
      )}
      <SyncErrorToast error={syncError} />
      {screen.name === 'list' ? (
        <MantraList
          mantras={mantras}
          syncing={syncing}
          chrome={!hideChrome}
          onAdd={() => setScreen({ name: 'edit', id: null })}
          onEdit={(id) => setScreen({ name: 'edit', id })}
          onDelete={(id) => removeMantra(id)}
          onToggle={(id, enabled) => toggleEnabled(id, enabled)}
          onSyncNow={syncNow}
        />
      ) : (
        <MantraEditor
          initial={editing}
          onCancel={() => setScreen({ name: 'list' })}
          onSave={async (m) => {
            await saveMantra(m);
            setScreen({ name: 'list' });
          }}
          onDelete={async (id) => {
            await removeMantra(id);
            setScreen({ name: 'list' });
          }}
          onPermissionGate={ensure}
        />
      )}
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
