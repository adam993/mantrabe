import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const SOURCE_URL = 'https://mantrabe.netlify.app/altstore-source.json';
// AltStore registers an `altstore://` URL scheme; tapping this on a phone that
// already has AltStore opens it with the "Add Source" sheet pre-filled.
const ALTSTORE_DEEP_LINK = `altstore://source?url=${encodeURIComponent(SOURCE_URL)}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallDialog({ open, onOpenChange }: Props) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SOURCE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked by permissions policy; the URL is still
      // selectable in the input below, so silent failure is acceptable.
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-id="ios-install-dialog"
        className="sm:max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle data-id="ios-install-dialog-title">
            Install on iPhone
          </DialogTitle>
          <DialogDescription data-id="ios-install-dialog-description">
            iPhone installs go through{' '}
            <a
              className="underline underline-offset-2"
              href="https://altstore.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              AltStore
            </a>
            , which sideloads Mantrabe with your own free Apple ID. Apple
            re-signs the app every 7 days; AltStore handles refresh
            automatically over Wi-Fi.
          </DialogDescription>
        </DialogHeader>

        <ol className="ml-5 list-decimal space-y-2 text-[0.95rem] text-foreground">
          <li>
            Install <strong>AltStore</strong> on your iPhone and{' '}
            <strong>AltServer</strong> on a Mac or Windows PC by following{' '}
            <a
              className="underline underline-offset-2"
              href="https://altstore.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              altstore.io
            </a>
            .
          </li>
          <li>
            In AltStore on your phone, open <strong>Browse → ＋</strong> and
            paste the source URL:
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                data-id="ios-install-source-url"
                readOnly
                value={SOURCE_URL}
                className="flex-1 rounded-md border border-[var(--border-strong)] bg-card px-3 py-1.5 font-mono text-[0.78rem] text-foreground"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                data-id="ios-install-copy"
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-2 text-[0.85rem] text-muted-foreground">
              On the phone itself you can also tap{' '}
              <a
                data-id="ios-install-deep-link"
                className="underline underline-offset-2"
                href={ALTSTORE_DEEP_LINK}
              >
                this link
              </a>{' '}
              to open AltStore with the source pre-filled.
            </p>
          </li>
          <li>
            Tap <strong>Mantrabe → Free Download</strong>. AltStore signs and
            installs it.
          </li>
          <li>
            On the iPhone, go to <strong>Settings → General → VPN &amp; Device
            Management</strong> and trust your developer profile.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
