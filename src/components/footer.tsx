import { Capacitor } from '@capacitor/core';
import { VERSION } from '@/version';
import { Grass } from '@/components/grass';

export function Footer() {
  let isNative = false;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    /* noop */
  }
  const isElectron =
    typeof window !== 'undefined' &&
    !!(window as unknown as { mantrabe?: { isElectron?: boolean } }).mantrabe?.isElectron;
  // Download button is web-only. The footer itself still renders on every
  // platform so the grass strip has a host element with bottom breathing
  // room above the safe-area inset.
  //
  // The href is a stable in-domain URL handled by netlify.toml — it 302s
  // to the rolling `android-latest` GitHub Release asset. That decouples
  // the web deploy from the Android workflow finishing first.
  const showDownload = !isNative && !isElectron;

  return (
    <footer
      data-id="footer"
      className="relative mt-auto flex justify-center px-5 pb-[calc(80px+var(--safe-bottom))] pt-5"
    >
      {showDownload && (
        <a
          data-id="footer-download-android"
          className="relative z-10 inline-flex flex-col items-center gap-0.5 rounded-md border border-[var(--border-strong)] bg-background px-5 py-3 font-serif-zen tracking-wide text-foreground no-underline shadow-[var(--shadow-soft)] transition-colors hover:bg-card"
          href="/mantrabe-android.apk"
          rel="noopener"
        >
          <span className="text-[0.95rem] font-medium">Download Android app</span>
          <span className="font-sans text-[0.72rem] tracking-wider text-muted-foreground">
            latest · web v{VERSION}
          </span>
        </a>
      )}
      <Grass />
    </footer>
  );
}
