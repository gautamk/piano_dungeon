import { describe, it, expect } from 'vitest';
import { evaluateNote, generateChallenge, generateMelodyChallenge, pickChallengeType, computeEnemyDamage, CHALLENGE_TYPE } from '../game/ChallengeEngine.js';
import { GAME_CONFIG } from '../config.js';
import type { Challenge, Enemy, Song } from '../types.js';
import type { GameState } from '../types.js';

// Helper: create a fake detected note
function note(semitone: number, octave = 4) {
  return { semitone, octave, midi: (octave + 1) * 12 + semitone };
}

describe('evaluateNote — NOTE challenge', () => {
  function makeNoteChallenge(semitone: number) {
    return {
      type: CHALLENGE_TYPE.NOTE,
      sequence: [semitone],
      progress: 0,
      targets: [{ semitone, octave: 4 }],
    } as unknown as Challenge;
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
  function makeIntervalChallenge(root: number, target: number) {
    return {
      type: CHALLENGE_TYPE.INTERVAL,
      sequence: [root, target],
      progress: 0,
    } as unknown as Challenge;
  }

  it('returns PROGRESS on first correct note in sequence', () => {
    const c = makeIntervalChallenge(0, 7); // C then G
    expect(evaluateNote(c, note(0))).toBe('PROGRESS');
    expect((c as { progress: number }).progress).toBe(1);
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
    expect((c as { progress: number }).progress).toBe(0);
  });
});

describe('evaluateNote — CHORD challenge', () => {
  function makeChordChallenge(semitones: number[]) {
    return {
      type: CHALLENGE_TYPE.CHORD,
      sequence: semitones,
      required: new Set(semitones),
      played: new Set<number>(),
      progress: 0,
    } as unknown as Challenge;
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

  it('ignores a tone already played (no penalty for re-pressing)', () => {
    const c = makeChordChallenge([0, 4, 7]);
    evaluateNote(c, note(0));
    // Playing the same tone again should be silently ignored, not penalised
    const result = evaluateNote(c, note(0));
    expect(result).toBeNull();
    expect((c as { played: Set<number> }).played.size).toBe(1); // still only one tone collected
  });
});

describe('evaluateNote — MELODY challenge', () => {
  function makeMelodyChallenge(sequence: number[]) {
    return {
      type: CHALLENGE_TYPE.MELODY,
      sequence,
      progress: 0,
    } as unknown as Challenge;
  }

  it('returns PROGRESS on correct note in sequence', () => {
    const c = makeMelodyChallenge([0, 4, 7]); // C, E, G
    expect(evaluateNote(c, note(0))).toBe('PROGRESS');
    expect((c as { progress: number }).progress).toBe(1);
  });

  it('returns SUCCESS when the last note in the melody is played', () => {
    const c = makeMelodyChallenge([0, 4, 7]);
    evaluateNote(c, note(0)); // C
    evaluateNote(c, note(4)); // E
    expect(evaluateNote(c, note(7))).toBe('SUCCESS');
  });

  it('returns FAIL on wrong note and resets progress', () => {
    const c = makeMelodyChallenge([0, 4, 7]);
    evaluateNote(c, note(0)); // C — correct
    expect(evaluateNote(c, note(2))).toBe('FAIL'); // D — wrong
    expect((c as { progress: number }).progress).toBe(0);
  });

  it('resets and allows restart after a wrong note', () => {
    const c = makeMelodyChallenge([0, 4]);
    evaluateNote(c, note(0)); // progress = 1
    evaluateNote(c, note(2)); // FAIL, progress = 0
    evaluateNote(c, note(0)); // restart — should be PROGRESS again
    expect((c as { progress: number }).progress).toBe(1);
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

  it('generates a CHORD challenge with required and played Sets', () => {
    const c = generateChallenge(CHALLENGE_TYPE.CHORD, 6);
    expect(c.type).toBe(CHALLENGE_TYPE.CHORD);
    expect((c as { required: Set<number> }).required).toBeInstanceOf(Set);
    expect((c as { played: Set<number> }).played).toBeInstanceOf(Set);
    expect((c as { played: Set<number> }).played.size).toBe(0);
  });

  it('falls back to NOTE when INTERVAL is not yet available (floor < 3)', () => {
    const c = generateChallenge(CHALLENGE_TYPE.INTERVAL, 1);
    expect(c.type).toBe(CHALLENGE_TYPE.NOTE);
  });

  it('falls back to NOTE when CHORD not yet available (floor < 6)', () => {
    const c = generateChallenge(CHALLENGE_TYPE.CHORD, 5);
    expect(c.type).toBe(CHALLENGE_TYPE.NOTE);
  });
});

describe('generateMelodyChallenge', () => {
  it('builds a challenge from a song phrase', () => {
    const mockSong = {
      id: 'test',
      title: 'Test Song',
      phrases: [
        [
          { semitone: 0, octave: 4, durationMs: 500 },
          { semitone: 4, octave: 4, durationMs: 500 },
          { semitone: 7, octave: 4, durationMs: 500 },
        ],
      ],
    } as unknown as Song;
    const c = generateMelodyChallenge(mockSong, 0);
    expect(c.type).toBe(CHALLENGE_TYPE.MELODY);
    expect(c.sequence).toEqual([0, 4, 7]);
    expect((c as { octaves: number[] }).octaves).toEqual([4, 4, 4]);
    expect(c.timeMs).toBeGreaterThan(0);
  });

  it('wraps phraseIndex around song phrase count', () => {
    const mockSong = {
      id: 'test',
      title: 'Test',
      phrases: [
        [{ semitone: 0, octave: 4, durationMs: 400 }],
        [{ semitone: 7, octave: 4, durationMs: 400 }],
      ],
    } as unknown as Song;
    const c = generateMelodyChallenge(mockSong, 3); // 3 % 2 = phrase index 1
    expect(c.sequence).toEqual([7]);
  });

  it('sets minimum timeMs to 8000ms', () => {
    const mockSong = {
      id: 'short',
      title: 'Short',
      phrases: [[{ semitone: 0, octave: 4, durationMs: 100 }]],
    } as unknown as Song;
    const c = generateMelodyChallenge(mockSong, 0);
    expect(c.timeMs).toBe(8000); // 100ms * 2.5 = 250ms < 8000ms floor
  });
});

describe('pickChallengeType', () => {
  function makeEnemy(weights: Record<string, number>) {
    return { challengeWeights: weights, song: null } as unknown as Enemy;
  }

  it('always returns NOTE when all other types have zero weight', () => {
    const enemy = makeEnemy({ NOTE: 10, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 0 });
    for (let i = 0; i < 20; i++) {
      expect(pickChallengeType(enemy, 1)).toBe(CHALLENGE_TYPE.NOTE);
    }
  });

  it('blocks INTERVAL on floors below 3', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 10, SCALE: 0, CHORD: 0, MELODY: 0 });
    for (let i = 0; i < 20; i++) {
      // INTERVAL zeroed, total=0 → fallback NOTE
      expect(pickChallengeType(enemy, 2)).toBe(CHALLENGE_TYPE.NOTE);
    }
  });

  it('allows INTERVAL on floor 3+', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 10, SCALE: 0, CHORD: 0, MELODY: 0 });
    let sawInterval = false;
    for (let i = 0; i < 50; i++) {
      if (pickChallengeType(enemy, 3) === CHALLENGE_TYPE.INTERVAL) { sawInterval = true; break; }
    }
    expect(sawInterval).toBe(true);
  });

  it('blocks SCALE on floors below 5', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 0, SCALE: 10, CHORD: 0, MELODY: 0 });
    for (let i = 0; i < 20; i++) {
      expect(pickChallengeType(enemy, 4)).toBe(CHALLENGE_TYPE.NOTE);
    }
  });

  it('allows SCALE on floor 5+', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 0, SCALE: 10, CHORD: 0, MELODY: 0 });
    let sawScale = false;
    for (let i = 0; i < 50; i++) {
      if (pickChallengeType(enemy, 5) === CHALLENGE_TYPE.SCALE) { sawScale = true; break; }
    }
    expect(sawScale).toBe(true);
  });

  it('blocks CHORD on floors below 6', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 0, SCALE: 0, CHORD: 10, MELODY: 0 });
    for (let i = 0; i < 20; i++) {
      expect(pickChallengeType(enemy, 5)).toBe(CHALLENGE_TYPE.NOTE);
    }
  });

  it('blocks MELODY when enemy has no song', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 10 });
    for (let i = 0; i < 20; i++) {
      expect(pickChallengeType(enemy, 5)).toBe(CHALLENGE_TYPE.NOTE);
    }
  });

  it('allows MELODY when enemy has a song', () => {
    const enemy = { challengeWeights: { NOTE: 0, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 10 }, song: 'ode_to_joy' } as unknown as Enemy;
    let sawMelody = false;
    for (let i = 0; i < 50; i++) {
      if (pickChallengeType(enemy, 5) === CHALLENGE_TYPE.MELODY) { sawMelody = true; break; }
    }
    expect(sawMelody).toBe(true);
  });

  it('returns NOTE as fallback when total weight is 0', () => {
    const enemy = makeEnemy({ NOTE: 0, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 0 });
    expect(pickChallengeType(enemy, 10)).toBe(CHALLENGE_TYPE.NOTE);
  });
});

describe('computeEnemyDamage', () => {
  const [t1, t2] = GAME_CONFIG.battle.comboThresholds;   // [3, 5]
  const [m1, m2] = GAME_CONFIG.battle.comboMultipliers;  // [1.5, 2.0]
  const base = GAME_CONFIG.battle.baseDamageToEnemy;     // 20

  function makeState(combo: number) {
    return { player: { combo } } as unknown as Pick<GameState, 'player'>;
  }

  it('returns base damage at combo 0', () => {
    expect(computeEnemyDamage(makeState(0))).toBe(Math.round(base * 1));
  });

  it('returns base damage just below first threshold', () => {
    expect(computeEnemyDamage(makeState(t1 - 1))).toBe(Math.round(base * 1));
  });

  it('applies first multiplier at threshold 1 (combo = t1)', () => {
    expect(computeEnemyDamage(makeState(t1))).toBe(Math.round(base * m1));
  });

  it('applies first multiplier between t1 and t2', () => {
    expect(computeEnemyDamage(makeState(t1 + 1))).toBe(Math.round(base * m1));
  });

  it('applies second multiplier at threshold 2 (combo = t2)', () => {
    expect(computeEnemyDamage(makeState(t2))).toBe(Math.round(base * m2));
  });

  it('applies second multiplier beyond t2', () => {
    expect(computeEnemyDamage(makeState(t2 + 10))).toBe(Math.round(base * m2));
  });
});
