// Generates public/bell.wav — a serene bell chime, synthesized from a sum
// of slowly-decaying inharmonic partials. No external audio assets needed,
// the WAV file is fully reproducible from this script.
//
// The same partial structure is mirrored by src/bell-chime.js for in-app
// fallback playback (Web Audio).

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 3.0; // seconds; long enough to ring out, short enough not to overlap reminders
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// Bell-like inharmonic partials. Frequencies are loosely modeled after the
// hum, prime, and minor-third partials of a small temple bell, transposed up
// for a brighter "chime" character. Decay times are tuned by ear.
const PARTIALS = [
  { freq: 660,  amp: 0.55, decay: 1.8 }, // hum-like base
  { freq: 880,  amp: 0.85, decay: 1.5 }, // prime / strike
  { freq: 1320, amp: 0.40, decay: 1.0 }, // perfect fifth (gives the "chime" lift)
  { freq: 1760, amp: 0.55, decay: 2.2 }, // octave
  { freq: 2640, amp: 0.22, decay: 1.6 }, // twelfth
  { freq: 3520, amp: 0.13, decay: 1.0 }, // upper sparkle
];

function generate() {
  const samples = new Float32Array(NUM_SAMPLES);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Quick exponential attack so it doesn't click; ~6 ms.
    const attack = 1 - Math.exp(-t / 0.006);

    let s = 0;
    for (const p of PARTIALS) {
      const env = Math.exp(-t / p.decay);
      // Tiny vibrato on the upper partials gives a more organic, breathing
      // bell texture — flat sines sound synthetic.
      const vibrato = p.freq > 2000 ? 1 + 0.0008 * Math.sin(2 * Math.PI * 5.5 * t) : 1;
      s += p.amp * env * Math.sin(2 * Math.PI * p.freq * vibrato * t);
    }

    // Soft tail so the last 200 ms fade smoothly.
    const tailStart = DURATION - 0.2;
    const tail = t > tailStart ? Math.max(0, 1 - (t - tailStart) / 0.2) : 1;

    samples[i] = s * attack * tail * 0.22; // overall headroom
  }

  return samples;
}

function writeWav(filePath, samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const bufferSize = 44 + dataSize;
  const buffer = Buffer.alloc(bufferSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk (PCM)
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

const samples = generate();
const outPath = path.join(__dirname, '..', 'public', 'bell.wav');
writeWav(outPath, samples, SAMPLE_RATE);
console.log(`Wrote ${outPath} (${(NUM_SAMPLES * 2 + 44).toLocaleString()} bytes)`);
