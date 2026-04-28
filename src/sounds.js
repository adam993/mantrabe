// Catalog of bell sounds the user can pick per mantra.
//
// `id` doubles as the resource key on every platform:
//   - web/Electron: HTMLAudioElement loads `${BASE_URL}${id}.wav`
//   - Android: res/raw/<id>.wav (so id must be lowercase + underscores only)
//   - iOS: ios/App/App/public/<id>.wav inside the bundle
// Capacitor's LocalNotifications plugin takes the `sound` field as
// `<id>.wav` everywhere — same string works on all targets.
//
// Attribution for the bundled sounds lives in CREDITS.md.

export const SOUNDS = [
  {
    id: 'clear_bell',
    label: 'Clear bell chime',
    hint: 'Bright, short — the default.',
  },
  {
    id: 'church_bell',
    label: 'Church bell',
    hint: 'Deep, slow, ceremonial.',
  },
  {
    id: 'xylophone',
    label: 'Xylophone',
    hint: 'Warm wooden tones.',
  },
  {
    id: 'dun_dun_duuun',
    label: 'Dun dun duuun',
    hint: 'For when the mantra demands gravitas.',
  },
];

export const DEFAULT_SOUND_ID = 'clear_bell';

export function soundById(id) {
  return SOUNDS.find((s) => s.id === id) || SOUNDS.find((s) => s.id === DEFAULT_SOUND_ID);
}

export function soundFile(id) {
  return `${soundById(id).id}.wav`;
}
