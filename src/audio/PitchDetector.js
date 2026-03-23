import { GAME_CONFIG } from '../config.js';

/**
 * Detects fundamental pitch from an AnalyserNode using autocorrelation.
 * Returns { frequency, confidence } each call, or { frequency: null, confidence: 0 }.
 *
 * Algorithm: autocorrelation with parabolic interpolation.
 * Works well for monophonic piano audio in the C2-C7 range.
 */
export class PitchDetector {
  constructor(analyserNode, sampleRate) {
    this.analyser = analyserNode;
    this.sampleRate = sampleRate;
    this.fftSize = analyserNode.fftSize;
    this.buf = new Float32Array(this.fftSize);

    // Stability buffer: require N consecutive frames of the same note
    this.stableFrames = 0;
    this.lastMidi = null;
    this.requiredFrames = GAME_CONFIG.audio.stabilityFrames;

    // Result cache - updated once per detect() call
    this.result = { frequency: null, confidence: 0, stable: false };
  }

  /** Call once per animation frame. Returns stable detected note info. */
  detect() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const raw = autocorrelate(this.buf, this.sampleRate);

    if (raw === null) {
      this.stableFrames = 0;
      this.lastMidi = null;
      this.result = { frequency: null, confidence: 0, stable: false };
      return this.result;
    }

    const { frequency, confidence } = raw;

    // Map to nearest MIDI to check stability (ignore fine pitch variation)
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));

    if (midi === this.lastMidi) {
      this.stableFrames++;
    } else {
      this.stableFrames = 1;
      this.lastMidi = midi;
    }

    const stable = this.stableFrames >= this.requiredFrames;
    this.result = { frequency, confidence, stable, midi };
    return this.result;
  }
}

/**
 * Core autocorrelation algorithm.
 * Returns { frequency, confidence } or null if signal is too quiet / no clear pitch.
 */
function autocorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // Gate on RMS - reject silence
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return null;

  // Trim to first upward zero crossing to reduce noise
  let start = 0;
  for (let i = 1; i < SIZE / 2; i++) {
    if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; }
  }

  const trimmed = buf.slice(start, start + Math.floor(SIZE / 2));
  const N = trimmed.length;
  if (N < 64) return null;

  // Compute normalized autocorrelation
  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }
  if (c[0] === 0) return null;

  // Find end of first drop (first local minimum after lag 0)
  let d = 1;
  while (d < N - 1 && c[d] > c[d + 1]) d++;

  // Find the global peak after the first drop
  let maxVal = -Infinity;
  let maxLag = d;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxLag = i; }
  }

  const confidence = maxVal / c[0];
  if (confidence < GAME_CONFIG.audio.confidenceThreshold) return null;

  // Parabolic interpolation for sub-sample accuracy
  let refinedLag = maxLag;
  if (maxLag > 0 && maxLag < N - 1) {
    const x1 = c[maxLag - 1], x2 = c[maxLag], x3 = c[maxLag + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a < 0) refinedLag = maxLag - b / (2 * a);
  }

  if (refinedLag === 0) return null;
  return { frequency: sampleRate / refinedLag, confidence };
}
