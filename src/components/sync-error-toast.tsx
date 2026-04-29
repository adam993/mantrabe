import { CloudOff } from 'lucide-react';

interface Props {
  error: string | null;
}

export function SyncErrorToast({ error }: Props) {
  if (!error) return null;
  return (
    <div
      data-id="sync-error-toast"
      className="mx-5 mt-3 flex items-start gap-3 rounded-md border border-[var(--warn)] bg-card px-4 py-3 text-sm"
      role="alert"
    >
      <CloudOff className="mt-0.5 h-4 w-4 text-[var(--warn)]" />
      <div>
        <strong className="font-medium">Cloud sync unavailable.</strong>{' '}
        <span className="text-muted-foreground">
          Your changes are saved on this device. {error}
        </span>
      </div>
    </div>
  );
}
