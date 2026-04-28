// In-app bell chime player.
// The bundled audio file (public/church_bell.wav) is the same sound the OS
// uses for native local notifications. For in-app preview and web/Electron
// notifications we play it via HTMLAudioElement. If that fails (e.g.
// autoplay-restricted contexts), we synthesize a soft bell with Web Audio
// so the user always hears *something* on test.

let bellAudio = null;
let audioCtx = null;

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

export async function playBellChime() {
  // Prefer the bundled WAV — same sound the OS notifications use.
  // Vite copies public/bell.wav to the dist root, and we set base: './'
  // so a path relative to BASE_URL works in both dev and prod.
  try {
    if (!bellAudio) {
      const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || './';
      bellAudio = new Audio(`${base}church_bell.wav`);
      bellAudio.preload = 'auto';
    }
    bellAudio.currentTime = 0;
    await bellAudio.play();
    return;
  } catch {
    // Fall through to synthesized fallback (Web Audio).
  }
  synthesizeBell();
}

// Additive synthesis of a soft bell: a few inharmonic partials with
// exponentially decaying amplitude envelopes. This is the same shape the
// generate-bell.cjs script produces for the bundled WAV.
function synthesizeBell() {
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
    // Quick attack then exponential decay.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.amp, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  }
}
