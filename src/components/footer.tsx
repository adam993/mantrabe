import * as React from 'react';
import { VERSION } from '@/version';
import { Grass } from '@/components/grass';
import { isElectron, isNative } from '@/lib/platform';
import { IOSInstallDialog } from '@/components/ios-install-dialog';

export function Footer() {
  // Download buttons are web-only. The footer itself still renders on every
  // platform so the grass strip has a host element with bottom breathing
  // room above the safe-area inset.
  //
  // Android: the href is a stable in-domain URL handled by netlify.toml — it
  // 302s to the rolling `android-latest` GitHub Release asset. That decouples
  // the web deploy from the Android workflow finishing first.
  //
  // iOS: opens a dialog with AltStore install instructions instead of a
  // direct download — sideloading needs a one-time AltStore + AltServer
  // setup, so a raw .ipa link would just confuse first-time users.
  const showDownloads = !isNative() && !isElectron();
  const [iosDialogOpen, setIosDialogOpen] = React.useState(false);

  return (
    <footer
      data-id="footer"
      className="relative mt-auto flex flex-col items-center gap-3 px-5 pb-[calc(80px+var(--safe-bottom))] pt-5"
    >
      {showDownloads && (
        <div
          data-id="footer-downloads"
          className="relative z-10 flex flex-wrap items-stretch justify-center gap-3"
        >
          <a
            data-id="footer-download-android"
            className="inline-flex flex-col items-center gap-0.5 rounded-md border border-[var(--border-strong)] bg-background px-5 py-3 font-serif-zen tracking-wide text-foreground no-underline shadow-[var(--shadow-soft)] transition-colors hover:bg-card"
            href="/mantrabe-android.apk"
            rel="noopener"
          >
            <span className="text-[0.95rem] font-medium">Download Android app</span>
            <span className="font-sans text-[0.72rem] tracking-wider text-muted-foreground">
              latest · web v{VERSION}
            </span>
          </a>
          <button
            type="button"
            data-id="footer-download-ios"
            onClick={() => setIosDialogOpen(true)}
            className="inline-flex flex-col items-center gap-0.5 rounded-md border border-[var(--border-strong)] bg-background px-5 py-3 font-serif-zen tracking-wide text-foreground no-underline shadow-[var(--shadow-soft)] transition-colors hover:bg-card"
          >
            <span className="text-[0.95rem] font-medium">Install on iPhone</span>
            <span className="font-sans text-[0.72rem] tracking-wider text-muted-foreground">
              via AltStore · web v{VERSION}
            </span>
          </button>
        </div>
      )}
      <Grass />
      {showDownloads && (
        <IOSInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
      )}
    </footer>
  );
}
