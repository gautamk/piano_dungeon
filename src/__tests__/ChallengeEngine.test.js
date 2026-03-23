import { describe, it, expect } from 'vitest';
import { evaluateNote, generateChallenge, CHALLENGE_TYPE } from '../game/ChallengeEngine.js';

// Helper: create a fake detected note
function note(semitone, octave = 4) {
  return { semitone, octave, midi: (octave + 1) * 12 + semitone };
}

describe('evaluateNote — NOTE challenge', () => {
  function makeNoteChallenge(semitone) {
    return {
      type: CHALLENGE_TYPE.NOTE,
      sequence: [semitone],
      progress: 0,
      targets: [{ semitone, octave: 4 }],
    };
  }

  it('returns SUCCESS for correct semitone', () => {
    const c = makeNoteChallenge(0); // C
    expect(evaluateNote(c, note(0))).toBe('SUCCESS');
  });

  it('returns FAIL for wrong semitone (> 1 away)', () => {
    const c = makeNoteChallenge(0); // C
    expect(evaluateNote(c, note(3))).toBe('FAIL'); // D# is 3 semitones away
  });

  it('returns NEAR_MISS for semitone 1 away', () => {
    const c = makeNoteChallenge(0); // C
    expect(evaluateNote(c, note(1))).toBe('NEAR_MISS'); // C# is 1 away
    expect(evaluateNote(c, note(11))).toBe('NEAR_MISS'); // B wraps to 1 away
  });

  it('returns null for null inputs', () => {
    expect(evaluateNote(null, note(0))).toBeNull();
    expect(evaluateNote(makeNoteChallenge(0), null)).toBeNull();
  });
});

describe('evaluateNote — INTERVAL challenge', () => {
  function makeIntervalChallenge(root, target) {
    return {
      type: CHALLENGE_TYPE.INTERVAL,
      sequence: [root, target],
      progress: 0,
    };
  }

  it('returns PROGRESS on first correct note in sequence', () => {
    const c = makeIntervalChallenge(0, 7); // C then G
    expect(evaluateNote(c, note(0))).toBe('PROGRESS');
    expect(c.progress).toBe(1);
  });

  it('returns SUCCESS on completing the sequence', () => {
    const c = makeIntervalChallenge(0, 7);
    evaluateNote(c, note(0)); // first note
    expect(evaluateNote(c, note(7))).toBe('SUCCESS');
  });

  it('resets progress on wrong note', () => {
    const c = makeIntervalChallenge(0, 7);
    evaluateNote(c, note(0)); // correct first note
    evaluateNote(c, note(3)); // wrong second note
    expect(c.progress).toBe(0);
  });
});

describe('evaluateNote — CHORD challenge', () => {
  function makeChordChallenge(semitones) {
    return {
      type: CHALLENGE_TYPE.CHORD,
      sequence: semitones,
      required: new Set(semitones),
      played: new Set(),
      progress: 0,
    };
  }

  it('accumulates PROGRESS as chord tones are played', () => {
    const c = makeChordChallenge([0, 4, 7]); // C major
    expect(evaluateNote(c, note(0))).toBe('PROGRESS');
    expect(evaluateNote(c, note(4))).toBe('PROGRESS');
  });

  it('returns SUCCESS when all chord tones are played', () => {
    const c = makeChordChallenge([0, 4, 7]);
    evaluateNote(c, note(0));
    evaluateNote(c, note(4));
    expect(evaluateNote(c, note(7))).toBe('SUCCESS');
  });

  it('returns FAIL for non-chord tones', () => {
    const c = makeChordChallenge([0, 4, 7]);
    expect(evaluateNote(c, note(2))).toBe('FAIL'); // D is not in C major
  });

  it('does not double-count a tone already played', () => {
    const c = makeChordChallenge([0, 4, 7]);
    evaluateNote(c, note(0));
    // Playing the same tone again shouldn't count
    const result = evaluateNote(c, note(0));
    expect(result).toBe('FAIL'); // treated as wrong (not a remaining tone)
  });
});

describe('generateChallenge', () => {
  it('generates a NOTE challenge with correct structure', () => {
    const c = generateChallenge(CHALLENGE_TYPE.NOTE, 1);
    expect(c.type).toBe(CHALLENGE_TYPE.NOTE);
    expect(Array.isArray(c.sequence)).toBe(true);
    expect(c.sequence.length).toBeGreaterThan(0);
    expect(c.timeMs).toBeGreaterThan(0);
  });

  it('generates an INTERVAL challenge on higher floors', () => {
    const c = generateChallenge(CHALLENGE_TYPE.INTERVAL, 5);
    expect(c.type).toBe(CHALLENGE_TYPE.INTERVAL);
    expect(c.sequence.length).toBe(2);
  });

  it('generates a SCALE challenge with multiple notes', () => {
    const c = generateChallenge(CHALLENGE_TYPE.SCALE, 5);
    expect(c.type).toBe(CHALLENGE_TYPE.SCALE);
    expect(c.sequence.length).toBeGreaterThan(2);
  });
});
