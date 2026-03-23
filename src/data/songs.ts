import type { Song } from '../types.js';

/**
 * Song library — each song is a collection of melodic phrases.
 *
 * Format:
 *   phrases: Array of phrase arrays.
 *   Each phrase = Array of { semitone: 0-11, octave: int, durationMs: int }
 *
 * semitone:   0=C  1=C#  2=D  3=D#  4=E  5=F  6=F#  7=G  8=G#  9=A  10=A#  11=B
 * durationMs: used to compute the challenge time window (not rhythm-matched during play)
 *
 * To add songs from MIDI files, use: bun scripts/midi-to-songs.js <file.mid>
 */

const Q = 450; // quarter note ms at ~133 bpm
const E = 225; // eighth note
const H = 900; // half note

export const SONGS: Record<string, Song> = {
  furElise: {
    id: 'furElise',
    title: 'Für Elise',
    composer: 'Beethoven',
    difficulty: 5,
    phrases: [
      // Phrase 1: The famous opening motif (A minor)
      [
        { semitone: 4, octave: 5, durationMs: E },   // E5
        { semitone: 3, octave: 5, durationMs: E },   // D#5
        { semitone: 4, octave: 5, durationMs: E },   // E5
        { semitone: 3, octave: 5, durationMs: E },   // D#5
        { semitone: 4, octave: 5, durationMs: E },   // E5
        { semitone: 11, octave: 4, durationMs: E },  // B4
        { semitone: 2, octave: 5, durationMs: E },   // D5
        { semitone: 0, octave: 5, durationMs: E },   // C5
        { semitone: 9, octave: 4, durationMs: Q },   // A4
      ],
      // Phrase 2: A minor chord walk
      [
        { semitone: 0, octave: 4, durationMs: E },   // C4
        { semitone: 4, octave: 4, durationMs: E },   // E4
        { semitone: 9, octave: 4, durationMs: E },   // A4
        { semitone: 11, octave: 4, durationMs: Q },  // B4
      ],
      // Phrase 3: E major response
      [
        { semitone: 4, octave: 4, durationMs: E },   // E4
        { semitone: 8, octave: 4, durationMs: E },   // G#4
        { semitone: 11, octave: 4, durationMs: E },  // B4
        { semitone: 0, octave: 5, durationMs: Q },   // C5
      ],
    ],
  },

  odeToJoy: {
    id: 'odeToJoy',
    title: 'Ode to Joy',
    composer: 'Beethoven',
    difficulty: 2,
    phrases: [
      // Phrase 1: E E F G  G F E D
      [
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 5, octave: 4, durationMs: Q },   // F4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 5, octave: 4, durationMs: Q },   // F4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
      ],
      // Phrase 2: C C D E  E D D
      [
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 4, octave: 4, durationMs: Q * 1.5 }, // E4 dotted
        { semitone: 2, octave: 4, durationMs: E },   // D4
        { semitone: 2, octave: 4, durationMs: H },   // D4 half
      ],
    ],
  },

  twinkleTwinkle: {
    id: 'twinkleTwinkle',
    title: 'Twinkle Twinkle',
    composer: 'Traditional',
    difficulty: 1,
    phrases: [
      // "Twinkle twinkle little star"  C C G G A A G
      [
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 9, octave: 4, durationMs: Q },   // A4
        { semitone: 9, octave: 4, durationMs: Q },   // A4
        { semitone: 7, octave: 4, durationMs: H },   // G4
      ],
      // "How I wonder what you are"  F F E E D D C
      [
        { semitone: 5, octave: 4, durationMs: Q },   // F4
        { semitone: 5, octave: 4, durationMs: Q },   // F4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 0, octave: 4, durationMs: H },   // C4
      ],
    ],
  },

  maryLamb: {
    id: 'maryLamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    difficulty: 1,
    phrases: [
      // "Mary had a little lamb"  E D C D E E E
      [
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 4, octave: 4, durationMs: H },   // E4
      ],
      // "little lamb, little lamb"  D D D E G G
      [
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 2, octave: 4, durationMs: H },   // D4
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 7, octave: 4, durationMs: H },   // G4
      ],
    ],
  },

  minuetInG: {
    id: 'minuetInG',
    title: 'Minuet in G',
    composer: 'Bach / Petzold',
    difficulty: 3,
    phrases: [
      // Phrase 1: D G A B C D
      [
        { semitone: 2, octave: 4, durationMs: Q },   // D4
        { semitone: 7, octave: 4, durationMs: Q },   // G4
        { semitone: 9, octave: 4, durationMs: E },   // A4
        { semitone: 11, octave: 4, durationMs: E },  // B4
        { semitone: 0, octave: 5, durationMs: Q },   // C5
        { semitone: 2, octave: 5, durationMs: H },   // D5
      ],
      // Phrase 2: E C D E F# G
      [
        { semitone: 4, octave: 4, durationMs: Q },   // E4
        { semitone: 0, octave: 4, durationMs: Q },   // C4
        { semitone: 2, octave: 4, durationMs: E },   // D4
        { semitone: 4, octave: 4, durationMs: E },   // E4
        { semitone: 6, octave: 4, durationMs: Q },   // F#4
        { semitone: 7, octave: 4, durationMs: H },   // G4
      ],
    ],
  },
};

/** Flat list of all songs, sorted by difficulty. */
export const SONGS_LIST: Song[] = Object.values(SONGS).sort((a, b) => a.difficulty - b.difficulty);
