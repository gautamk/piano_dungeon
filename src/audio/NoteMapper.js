import { NOTE_NAMES, A4_MIDI, A4_FREQ } from '../data/music.js';

/** Convert Hz to nearest MIDI note number. */
export function freqToMidi(freq) {
  if (!freq || freq <= 0) return null;
  return Math.round(A4_MIDI + 12 * Math.log2(freq / A4_FREQ));
}

/** Convert MIDI number to { midi, semitone, octave, name }. */
export function midiToNote(midi) {
  const semitone = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { midi, semitone, octave, name: NOTE_NAMES[semitone] };
}

/** Convert Hz to note object. */
export function freqToNote(freq) {
  const midi = freqToMidi(freq);
  if (midi === null) return null;
  return midiToNote(midi);
}

/**
 * How many cents is freq away from the target MIDI note.
 * Returns 0 if freq invalid. Positive = sharp, negative = flat.
 */
export function freqToCents(freq, targetMidi) {
  if (!freq || freq <= 0) return 0;
  const detectedMidi = A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
  return (detectedMidi - targetMidi) * 100;
}

/** Compute frequency of a given semitone + octave. */
export function noteToFreq(semitone, octave) {
  const midi = (octave + 1) * 12 + semitone;
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Check if detected semitone matches target semitone. */
export function semitoneMatches(detectedSemitone, targetSemitone) {
  return ((detectedSemitone - targetSemitone + 12) % 12) === 0;
}

/** Full note name string, e.g. "C4", "F#3". */
export function noteFullName(semitone, octave) {
  return `${NOTE_NAMES[semitone]}${octave}`;
}
