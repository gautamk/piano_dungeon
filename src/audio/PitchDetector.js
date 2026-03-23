import { PitchDetector as PitchyDetector } from 'pitchy';
import { GAME_CONFIG } from '../config.js';

/**
 * Detects fundamental pitch from an AnalyserNode using the McLeod Pitch Method
 * (via the pitchy library). More accurate than autocorrelation, especially for
 * avoiding octave errors on piano.
 *
 * Returns { frequency, confidence, stable, midi } each call,
 * or { frequency: null, confidence: 0, stable: false } when no clear pitch.
 */
export class PitchDetector {
  constructor(analyserNode, sampleRate) {
    this.analyser = analyserNode;
    this.sampleRate = sampleRate;
    this.buf = new Float32Array(analyserNode.fftSize);
    this._detector = PitchyDetector.forFloat32Array(analyserNode.fftSize);

    // Stability buffer: require N consecutive frames on the same MIDI note
    this.stableFrames = 0;
    this.lastMidi = null;
    this.requiredFrames = GAME_CONFIG.audio.stabilityFrames;

    this.result = { frequency: null, confidence: 0, stable: false };
  }

  /** Call once per animation frame. Returns stable detected note info. */
  detect() {
    this.analyser.getFloatTimeDomainData(this.buf);

    const [frequency, clarity] = this._detector.findPitch(this.buf, this.sampleRate);

    // Reject silence, unclear signals, and out-of-range detections
    if (!frequency || isNaN(frequency) || clarity < GAME_CONFIG.audio.confidenceThreshold) {
      this.stableFrames = 0;
      this.lastMidi = null;
      this.result = { frequency: null, confidence: clarity ?? 0, stable: false };
      return this.result;
    }

    // Map to nearest MIDI to check stability (ignore fine pitch variation)
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));

    if (midi === this.lastMidi) {
      this.stableFrames++;
    } else {
      this.stableFrames = 1;
      this.lastMidi = midi;
    }

    const stable = this.stableFrames >= this.requiredFrames;
    this.result = { frequency, confidence: clarity, stable, midi };
    return this.result;
  }
}
