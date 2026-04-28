# Bundled sounds

Each sound is shipped both as the original `.mp3` (for licensing /
attribution) and a converted mono 16-bit `.wav` at 44.1 kHz (used at
runtime — universally compatible across Android `res/raw/`, the iOS
bundle, and HTMLAudioElement).

| File                                                  | Used as              | Source                                                             |
| ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `universfield-clear-bell-chime-487898.mp3`            | `clear_bell.wav`     | universfield via Pixabay — Pixabay Content License (commercial OK) |
| `freesound_community-xylophone-a-45818.mp3`           | `xylophone.wav`      | freesound community via Pixabay — Pixabay Content License          |
| `freesound_community-dun-dun-duuun-v01-105105.mp3`    | `dun_dun_duuun.wav`  | freesound community via Pixabay — Pixabay Content License          |
| `church-bell.mp3`                                     | `church_bell.wav`    | (provided by repo author)                                          |

If you replace or add sounds, drop the source `.mp3` into `public/`,
re-run the conversion in `scripts/build-android.sh` style
(`ffmpeg -i <in.mp3> -ac 1 -ar 44100 -acodec pcm_s16le <out.wav>`),
and add a `{ id, label, hint }` entry to `src/sounds.js`.
