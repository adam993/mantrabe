import { Capacitor } from '@capacitor/core';
import { HAS_ANDROID_APK, ANDROID_APK_BYTES } from '@/build-info';
import { VERSION } from '@/version';
import { Grass } from '@/components/grass';

export function Footer() {
  if (!HAS_ANDROID_APK) return null;
  let isNative = false;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    /* noop */
  }
  const isElectron =
    typeof window !== 'undefined' &&
    !!(window as unknown as { mantrabe?: { isElectron?: boolean } }).mantrabe?.isElectron;
  if (isNative || isElectron) return null;

  const sizeMb = (ANDROID_APK_BYTES / 1024 / 1024).toFixed(1);
  return (
    <footer
      data-id="footer"
      className="relative mt-auto flex justify-center px-5 pb-[calc(80px+var(--safe-bottom))] pt-5"
    >
      <a
        data-id="footer-download-android"
        className="relative z-10 inline-flex flex-col items-center gap-0.5 rounded-md border border-[var(--border-strong)] bg-background px-5 py-3 font-serif-zen tracking-wide text-foreground no-underline shadow-[var(--shadow-soft)] transition-colors hover:bg-card"
        href={`./mantrabe-android.apk?v=${encodeURIComponent(VERSION)}`}
        download={`mantrabe-${VERSION}.apk`}
        rel="noopener"
      >
        <span className="text-[0.95rem] font-medium">Download Android app</span>
        <span className="font-sans text-[0.72rem] tracking-wider text-muted-foreground">
          v{VERSION} · {sizeMb} MB
        </span>
      </a>
      <Grass />
    </footer>
  );
}
