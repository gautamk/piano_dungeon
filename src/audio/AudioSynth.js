import * as Tone from 'tone';
import { A4_MIDI, A4_FREQ } from '../data/music.js';

/**
 * Manages all audio output (note playback, challenge previews).
 * Uses Tone.js, which manages its own AudioContext for output.
 * Must be started inside a user gesture handler (same rule as AudioEngine).
 */
export class AudioSynth {
  constructor() {
    this._synth = null;
    this._previewSynth = null;
    this._started = false;
  }

  async start() {
    if (this._started) return;
    await Tone.start(); // resumes Tone's AudioContext; requires prior user gesture

    // Shared reverb for warmth
    const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 0.2 }).toDestination();

    // Main synth: piano-like triangle wave with quick attack and natural decay
    this._synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.003, decay: 0.7, sustain: 0.08, release: 1.4 },
    }).connect(reverb);
    this._synth.set({ volume: -4 });

    // Preview synth: softer sine tone for challenge hints
    this._previewSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.3 },
    }).connect(reverb);
    this._previewSynth.set({ volume: -14 });

    this._started = true;
  }

  /**
   * Play a single note (virtual piano key press).
   * semitone: 0-11, octave: integer
   */
  playNote(semitone, octave) {
    if (!this._synth) return;
    const freq = this._toFreq(semitone, octave);
    try {
      this._synth.triggerAttackRelease(freq, '4n');
    } catch { /* silently absorb polyphony overflow */ }
  }

  /**
   * Preview the challenge target note(s) as a teaching prompt.
   * Plays a quiet arpeggio/sequence so the player knows what to aim for.
   */
  previewChallenge(challenge) {
    if (!this._previewSynth || !challenge) return;

    const now = Tone.now() + 0.08; // tiny gap so it doesn't clip transition sounds
    const stepTime = challenge.type === 'CHORD' ? 0.12 : 0.32;
    const noteDur = challenge.type === 'CHORD' ? '16n' : '8n';

    challenge.sequence.forEach((semitone, i) => {
      const octave = challenge.targets?.[i]?.octave ?? 4;
      const freq = this._toFreq(semitone, octave);
      try {
        this._previewSynth.triggerAttackRelease(freq, noteDur, now + i * stepTime);
      } catch { /* ignore */ }
    });
  }

  _toFreq(semitone, octave) {
    const midi = (octave + 1) * 12 + semitone;
    return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
  }
}
