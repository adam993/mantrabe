// Catalog of bell sounds the user can pick per mantra.
//
// `id` doubles as the resource key on every platform:
//   - web/Electron: HTMLAudioElement loads `${BASE_URL}${id}.wav`
//   - Android: res/raw/<id>.wav (so id must be lowercase + underscores only)
//   - iOS: ios/App/App/public/<id>.wav inside the bundle
// Capacitor's LocalNotifications plugin takes the `sound` field as
// `<id>.wav` everywhere — same string works on all targets.

export interface BellSound {
  id: string;
  label: string;
  hint: string;
}

export const SOUNDS: BellSound[] = [
  { id: 'clear_bell', label: 'Clear bell chime', hint: 'Bright, short — the default.' },
  { id: 'church_bell', label: 'Church bell', hint: 'Deep, slow, ceremonial.' },
  { id: 'xylophone', label: 'Xylophone', hint: 'Warm wooden tones.' },
  { id: 'dun_dun_duuun', label: 'Dun dun duuun', hint: 'For when the mantra demands gravitas.' },
];

export const DEFAULT_SOUND_ID = 'clear_bell';

export function soundById(id: string): BellSound {
  const found = SOUNDS.find((s) => s.id === id);
  if (found) return found;
  const fallback = SOUNDS.find((s) => s.id === DEFAULT_SOUND_ID);
  if (!fallback) throw new Error(`Default sound ${DEFAULT_SOUND_ID} missing from catalog`);
  return fallback;
}

export function soundFile(id: string): string {
  return `${soundById(id).id}.wav`;
}
