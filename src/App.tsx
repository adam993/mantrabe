import * as React from 'react';
import { AuthProvider } from '@/lib/auth';
import { useMantras } from '@/hooks/use-mantras';
import { usePermission } from '@/hooks/use-permission';
import { PermissionBanner } from '@/components/permission-banner';
import { MantraList } from '@/components/mantra-list';
import { MantraEditor } from '@/components/mantra-editor';
import { Footer } from '@/components/footer';
import { SyncErrorToast } from '@/components/sync-error-toast';
import type { Mantra } from '@/types/mantra';

type Screen = { name: 'list' } | { name: 'edit'; id: string | null };

function Shell() {
  const { mantras, saveMantra, removeMantra, toggleEnabled, syncNow, syncing, syncError } =
    useMantras();
  const { permission, request, ensure } = usePermission();
  const [screen, setScreen] = React.useState<Screen>({ name: 'list' });

  const editing: Mantra | null = React.useMemo(() => {
    if (screen.name !== 'edit' || !screen.id) return null;
    return mantras.find((m) => m.id === screen.id) ?? null;
  }, [screen, mantras]);

  return (
    <div
      data-id="app-shell"
      data-screen={screen.name}
      className="mx-auto flex min-h-screen w-full flex-1 flex-col pt-[var(--safe-top)]"
    >
      <PermissionBanner permission={permission} onEnable={() => void request()} />
      <SyncErrorToast error={syncError} />
      {screen.name === 'list' ? (
        <MantraList
          mantras={mantras}
          syncing={syncing}
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
