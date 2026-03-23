import type { NoteReference, Scale, Chord, Interval } from '../types.js';

export const NOTE_NAMES: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const A4_MIDI: number = 69;
export const A4_FREQ: number = 440.0;

// Roots used in challenges - comfortable piano range C3-C5
export const CHALLENGE_ROOTS: NoteReference[] = [
  { semitone: 0, octave: 4, name: 'C4' },
  { semitone: 2, octave: 4, name: 'D4' },
  { semitone: 4, octave: 4, name: 'E4' },
  { semitone: 5, octave: 4, name: 'F4' },
  { semitone: 7, octave: 4, name: 'G4' },
  { semitone: 9, octave: 4, name: 'A4' },
  { semitone: 11, octave: 4, name: 'B4' },
  { semitone: 0, octave: 3, name: 'C3' },
  { semitone: 7, octave: 3, name: 'G3' },
];

export const SCALES: Record<string, Scale> = {
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    unlockFloor: 1,
    description: 'The bright, happy scale',
  },
  naturalMinor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    unlockFloor: 5,
    description: 'The dark, melancholic scale',
  },
  pentatonicMajor: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9, 12],
    unlockFloor: 7,
    description: 'Five notes, endless expression',
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11, 12],
    unlockFloor: 9,
    description: 'Minor scale with a raised 7th',
  },
};

export const CHORDS: Record<string, Chord> = {
  major: {
    name: 'Major',
    intervals: [0, 4, 7],
    unlockFloor: 6,
    symbol: '',
  },
  minor: {
    name: 'Minor',
    intervals: [0, 3, 7],
    unlockFloor: 7,
    symbol: 'm',
  },
  dominant7: {
    name: 'Dominant 7th',
    intervals: [0, 4, 7, 10],
    unlockFloor: 9,
    symbol: '7',
  },
};

export const INTERVALS: Interval[] = [
  { name: 'Perfect Unison', semitones: 0, abbr: 'P1' },
  { name: 'Minor 2nd', semitones: 1, abbr: 'm2' },
  { name: 'Major 2nd', semitones: 2, abbr: 'M2' },
  { name: 'Minor 3rd', semitones: 3, abbr: 'm3' },
  { name: 'Major 3rd', semitones: 4, abbr: 'M3' },
  { name: 'Perfect 4th', semitones: 5, abbr: 'P4' },
  { name: 'Tritone', semitones: 6, abbr: 'TT' },
  { name: 'Perfect 5th', semitones: 7, abbr: 'P5' },
  { name: 'Minor 6th', semitones: 8, abbr: 'm6' },
  { name: 'Major 6th', semitones: 9, abbr: 'M6' },
  { name: 'Minor 7th', semitones: 10, abbr: 'm7' },
  { name: 'Major 7th', semitones: 11, abbr: 'M7' },
  { name: 'Perfect Octave', semitones: 12, abbr: 'P8' },
];

// Which intervals are available by floor
export function getAvailableIntervals(floor: number): Interval[] {
  if (floor < 3) return [];
  if (floor < 5) return INTERVALS.filter(i => [7, 12].includes(i.semitones)); // P5, P8
  if (floor < 7) return INTERVALS.filter(i => [5, 7, 12].includes(i.semitones)); // + P4
  return INTERVALS.filter(i => [3, 4, 5, 7, 9, 12].includes(i.semitones)); // major/minor
}
