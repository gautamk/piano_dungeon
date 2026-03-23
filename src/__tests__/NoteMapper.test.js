import { describe, it, expect } from 'vitest';
import { freqToMidi, midiToNote, freqToNote, noteToFreq, semitoneMatches, freqToCents } from '../audio/NoteMapper.js';

describe('freqToMidi', () => {
  it('returns 69 for A4 (440 Hz)', () => {
    expect(freqToMidi(440)).toBe(69);
  });

  it('returns 60 for C4 (~261.63 Hz)', () => {
    expect(freqToMidi(261.63)).toBe(60);
  });

  it('returns null for non-positive input', () => {
    expect(freqToMidi(0)).toBeNull();
    expect(freqToMidi(-1)).toBeNull();
    expect(freqToMidi(null)).toBeNull();
  });

  it('rounds to nearest semitone', () => {
    // Slightly sharp A4
    expect(freqToMidi(445)).toBe(69);
  });
});

describe('midiToNote', () => {
  it('converts C4 (MIDI 60)', () => {
    const note = midiToNote(60);
    expect(note).toEqual({ midi: 60, semitone: 0, octave: 4, name: 'C' });
  });

  it('converts A4 (MIDI 69)', () => {
    const note = midiToNote(69);
    expect(note).toEqual({ midi: 69, semitone: 9, octave: 4, name: 'A' });
  });

  it('converts C5 (MIDI 72)', () => {
    const note = midiToNote(72);
    expect(note).toEqual({ midi: 72, semitone: 0, octave: 5, name: 'C' });
  });

  it('converts F#3 (MIDI 54)', () => {
    const note = midiToNote(54);
    expect(note).toEqual({ midi: 54, semitone: 6, octave: 3, name: 'F#' });
  });
});

describe('noteToFreq', () => {
  it('returns 440 Hz for A4', () => {
    expect(noteToFreq(9, 4)).toBeCloseTo(440, 2);
  });

  it('returns ~261.63 Hz for C4', () => {
    expect(noteToFreq(0, 4)).toBeCloseTo(261.63, 1);
  });

  it('is inverse of freqToMidi for round-trip', () => {
    const freq = noteToFreq(7, 4); // G4
    expect(freqToMidi(freq)).toBe(67);
  });
});

describe('semitoneMatches', () => {
  it('matches identical semitones', () => {
    expect(semitoneMatches(0, 0)).toBe(true);
    expect(semitoneMatches(7, 7)).toBe(true);
  });

  it('rejects different semitones', () => {
    expect(semitoneMatches(0, 1)).toBe(false);
    expect(semitoneMatches(3, 7)).toBe(false);
  });

  it('handles modulo wrap-around', () => {
    // Semitone 12 wraps to 0 (same pitch class)
    expect(semitoneMatches(12, 0)).toBe(true);
  });
});

describe('freqToCents', () => {
  it('returns 0 when freq is exactly on target MIDI', () => {
    expect(freqToCents(440, 69)).toBeCloseTo(0, 5); // A4 vs MIDI 69
  });

  it('returns ~100 for a semitone sharp', () => {
    const sharpFreq = 440 * Math.pow(2, 1 / 12); // one semitone up from A4
    expect(freqToCents(sharpFreq, 69)).toBeCloseTo(100, 1);
  });

  it('returns 0 for invalid input', () => {
    expect(freqToCents(0, 69)).toBe(0);
    expect(freqToCents(null, 69)).toBe(0);
  });
});
