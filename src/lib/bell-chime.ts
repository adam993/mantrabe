// In-app bell chime player.
//
// Plays one of the bundled WAVs (catalog in @/lib/sounds). On native
// platforms the OS notification uses the same file via LocalNotifications,
// so what you hear here in-app matches what fires at reminder time. The
// Web Audio fallback only kicks in if HTMLAudio playback is blocked.

import { soundById, DEFAULT_SOUND_ID } from '@/lib/sounds';

const audioCache = new Map<string, HTMLAudioElement>();
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function audioFor(soundId: string): HTMLAudioElement {
  const sound = soundById(soundId);
  let el = audioCache.get(sound.id);
  if (!el) {
    const base = import.meta.env.BASE_URL || './';
    el = new Audio(`${base}${sound.id}.wav`);
    el.preload = 'auto';
    audioCache.set(sound.id, el);
  }
  return el;
}

export async function playBellChime(soundId: string = DEFAULT_SOUND_ID): Promise<void> {
  try {
    const el = audioFor(soundId);
    el.currentTime = 0;
    await el.play();
    return;
  } catch {
    // Fall through to synthesized fallback.
  }
  synthesizeBell();
}

function synthesizeBell(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const partials = [
    { freq: 880, amp: 0.6, decay: 1.6 },
    { freq: 1320, amp: 0.3, decay: 1.0 },
    { freq: 1760, amp: 0.4, decay: 2.0 },
    { freq: 2640, amp: 0.18, decay: 1.4 },
    { freq: 3520, amp: 0.1, decay: 1.0 },
  ];

  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  for (const p of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = p.freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.amp, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  }
}
