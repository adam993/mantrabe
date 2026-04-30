import * as React from "react";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  fireTestNotification,
  requestPermission,
} from "@/lib/notifications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { describeMantra } from "@/lib/scheduler";
import { Enso } from "@/components/enso";
import { AccountMenu } from "@/components/account-menu";
import { VERSION } from "@/version";
import type { Mantra } from "@/types/mantra";

interface Props {
  mantras: Mantra[];
  syncing: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onSyncNow: () => void;
  /**
   * When false, hides the top logo bar (logo + Sign-in/Account menu).
   * Used by the Android first-run flow so the empty state stays focused
   * on getting the user's first mantra in.
   */
  chrome?: boolean;
}

export function MantraList({
  mantras,
  syncing,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onSyncNow,
  chrome = true,
}: Props) {
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const target = mantras.find((m) => m.id === confirmDelete) ?? null;

  return (
    <main
      data-id="list-screen"
      data-chrome={chrome}
      className="screen-fade mx-auto flex w-full max-w-[var(--topbar-width)] flex-1 flex-col gap-5 p-5"
    >
      {chrome && (
        <header
          data-id="list-topbar"
          className="mx-auto flex w-full max-w-[var(--content-width)] items-center gap-3 py-3"
        >
          <div
            data-id="list-topbar-title"
            className="flex flex-1 items-center gap-3 font-serif-zen text-[1.45rem] font-medium tracking-wide"
          >
            <Enso strokeWidth={4.7} />
            <span>Mantrabe</span>
            <span
              data-id="list-topbar-version"
              className="self-end pb-1 text-[0.72rem] font-normal tracking-wider text-muted-foreground/65"
              title={`Mantrabe v${VERSION}`}
            >
              v{VERSION}
            </span>
          </div>
          <DebugTools mantras={mantras} />
          <AccountMenu syncing={syncing} onSyncNow={onSyncNow} />
        </header>
      )}

      {mantras.length === 0 ? (
        <div
          data-id="list-empty"
          className="mx-auto flex w-full max-w-[var(--content-width)] min-h-[40vh] flex-col items-center gap-3 px-5 py-10 text-center text-muted-foreground"
        >
          <Enso strong size={84} className="mb-2 opacity-70" />
          <h2
            data-id="list-empty-title"
            className="m-0 font-serif-zen text-[1.4rem] font-medium tracking-wide text-foreground"
          >
            Remind yourself
          </h2>
          <p data-id="list-empty-body" className="m-0 max-w-[30ch]">
            Add a reminder/mantra you want to hear throughout the day.
          </p>
          <Button data-id="list-empty-cta" onClick={onAdd}>
            Begin
          </Button>
        </div>
      ) : (
        <>
          <ul
            data-id="list-items"
            className="mx-auto m-0 flex w-full max-w-[var(--content-width)] list-none flex-col gap-3 p-0 items-end"
          >
            {mantras.map((m) => (
              <EntryCard
                key={m.id}
                mantra={m}
                onEdit={onEdit}
                onToggle={onToggle}
                onDeleteRequest={(id) => setConfirmDelete(id)}
              />
            ))}
            <Button
              data-id="list-add-button"
              size="icon"
              onClick={onAdd}
              aria-label="Add new entry"
              title="Add new entry"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </ul>
        </>
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent data-id="list-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {target?.kind ?? "mantra"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will stop scheduled reminders and remove it from this device.
              If you're signed in, it will also be removed from your synced
              entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-id="list-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-id="list-delete-confirm"
              onClick={() => {
                if (confirmDelete) onDelete(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// Renders nothing in production builds. Vite tree-shakes the body when
// VITE_DEBUG_TOOLS is "false"/unset because the literal comparison
// becomes a constant-false branch at build time.
function DebugTools({ mantras }: { mantras: Mantra[] }) {
  if (import.meta.env.VITE_DEBUG_TOOLS !== "true") return null;
  return (
    <Button
      data-id="list-topbar-debug-fire"
      variant="ghost"
      size="sm"
      title="Debug: fire a test notification now"
      aria-label="Fire a test notification"
      onClick={async () => {
        const ok = await requestPermission();
        if (!ok) return;
        // Pick the first enabled mantra so the bell sound matches what the
        // user actually configured; fall back to the generic test text.
        const sample = mantras.find((m) => m.enabled && m.text.trim()) ?? null;
        await fireTestNotification(sample);
      }}
    >
      <Bell className="h-4 w-4" />
    </Button>
  );
}

function EntryCard({
  mantra,
  onEdit,
  onToggle,
  onDeleteRequest,
}: {
  mantra: Mantra;
  onEdit: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDeleteRequest: (id: string) => void;
}) {
  // Reminders use the warm clay/amber accent (--warn) so they read as
  // practical/utilitarian. Mantras keep the temple sage (--accent).
  const isReminder = mantra.kind === "reminder";
  const barClass = !mantra.enabled
    ? "bg-[var(--border-strong)]"
    : isReminder
      ? "bg-[var(--warn)] opacity-80"
      : "bg-accent opacity-70";

  return (
    <li
      data-id={`entry-${mantra.id}`}
      data-kind={mantra.kind}
      data-enabled={mantra.enabled}
      className={`relative flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-card-foreground shadow-[var(--shadow-soft)] transition-opacity ${
        mantra.enabled ? "" : "opacity-50"
      } ${isReminder ? "bg-[var(--warn)]/[0.04]" : ""}`}
    >
      <span
        data-id={`entry-${mantra.id}-bar`}
        className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-sm ${barClass}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <div className="mb-1 flex items-center gap-2">
          <span
            data-id={`entry-${mantra.id}-kind-tag`}
            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] ${
              isReminder
                ? "bg-[var(--warn)]/15 text-[var(--warn)]"
                : "bg-accent/15 text-accent"
            }`}
          >
            {mantra.kind}
          </span>
        </div>
        <p
          data-id={`entry-${mantra.id}-text`}
          className={`m-0 mb-1 break-words font-medium leading-snug ${
            isReminder
              ? "font-sans text-[1.05rem]"
              : "font-serif-zen text-[1.1rem]"
          }`}
        >
          {mantra.text || `(empty ${mantra.kind})`}
        </p>
        <p
          data-id={`entry-${mantra.id}-meta`}
          className="m-0 text-[0.85rem] tracking-wide text-muted-foreground"
        >
          {describeMantra(mantra)}
        </p>
      </div>
      <div
        data-id={`entry-${mantra.id}-actions`}
        className="flex flex-shrink-0 basis-full items-center justify-end gap-2 sm:basis-auto"
      >
        <Switch
          data-id={`entry-${mantra.id}-toggle`}
          checked={mantra.enabled}
          onCheckedChange={(checked) => onToggle(mantra.id, checked)}
          aria-label={
            mantra.enabled ? `Pause ${mantra.kind}` : `Resume ${mantra.kind}`
          }
        />
        <Button
          data-id={`entry-${mantra.id}-edit`}
          variant="ghost"
          size="sm"
          onClick={() => onEdit(mantra.id)}
        >
          Edit
        </Button>
        <Button
          data-id={`entry-${mantra.id}-delete`}
          variant="destructive"
          size="sm"
          onClick={() => onDeleteRequest(mantra.id)}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
