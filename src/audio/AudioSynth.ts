import * as Tone from 'tone';
import { A4_MIDI, A4_FREQ } from '../data/music.js';

/**
 * Manages all audio output (note playback via virtual piano).
 * Uses Tone.js, which manages its own AudioContext for output.
 * Must be started inside a user gesture handler (same rule as AudioEngine).
 */
export class AudioSynth {
  private _synth: Tone.PolySynth | null;
  private _started: boolean;

  constructor() {
    this._synth = null;
    this._started = false;
  }

  async unlockContext(): Promise<void> {
    await Tone.start();
  }

  async start(): Promise<void> {
    if (this._started) return;
    await Tone.start(); // resumes Tone's AudioContext; requires prior user gesture

    const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 0.2 }).toDestination();

    this._synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.003, decay: 0.7, sustain: 0.08, release: 1.4 },
    }).connect(reverb);
    this._synth.set({ volume: -4 });

    this._started = true;
  }

  /**
   * Play a single note (virtual piano key press).
   * semitone: 0-11, octave: integer
   */
  playNote(semitone: number, octave: number): void {
    if (!this._synth) return;
    const freq = this._toFreq(semitone, octave);
    try {
      this._synth.triggerAttackRelease(freq, '4n');
    } catch { /* silently absorb polyphony overflow */ }
  }

  /**
   * Route Tone.js output to a specific speaker device (Chrome/Edge 110+ only).
   * Silently no-ops on unsupported browsers.
   */
  async setOutputDevice(deviceId: string | null): Promise<void> {
    if (!this._started) return;
    try {
      const rawCtx = Tone.getContext().rawContext as AudioContext & { setSinkId?: (id: string) => Promise<void> };
      if (typeof rawCtx.setSinkId === 'function') {
        await rawCtx.setSinkId(deviceId ?? '');
      }
    } catch { /* unsupported or permission denied */ }
  }

  private _toFreq(semitone: number, octave: number): number {
    const midi = (octave + 1) * 12 + semitone;
    return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
  }
}
