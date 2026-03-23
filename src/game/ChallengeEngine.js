import { GAME_CONFIG } from '../config.js';
import { NOTE_NAMES, SCALES, CHORDS, CHALLENGE_ROOTS, getAvailableIntervals } from '../data/music.js';
import { semitoneMatches } from '../audio/NoteMapper.js';

export const CHALLENGE_TYPE = {
  NOTE: 'NOTE',
  INTERVAL: 'INTERVAL',
  SCALE: 'SCALE',
  CHORD: 'CHORD',
};

// Seeded random pick (simple version for challenge gen)
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a challenge object based on type and current floor.
 */
export function generateChallenge(type, floor) {
  const root = randPick(CHALLENGE_ROOTS);

  if (type === CHALLENGE_TYPE.NOTE) {
    // Simple: just play this note
    const roots = floor <= 2
      ? CHALLENGE_ROOTS.filter(r => r.octave === 4 && [0, 2, 4, 5, 7].includes(r.semitone))
      : CHALLENGE_ROOTS;
    const target = randPick(roots);
    return {
      type,
      label: `Play  ${target.name}`,
      targets: [{ semitone: target.semitone, octave: target.octave }],
      sequence: [target.semitone], // expected sequence of semitones
      progress: 0,
      timeMs: GAME_CONFIG.timing.noteWindowMs,
    };
  }

  if (type === CHALLENGE_TYPE.INTERVAL) {
    const availableIntervals = getAvailableIntervals(floor);
    if (availableIntervals.length === 0) return generateChallenge(CHALLENGE_TYPE.NOTE, floor);

    const interval = randPick(availableIntervals);
    const targetSemitone = (root.semitone + interval.semitones) % 12;
    return {
      type,
      label: `${root.name}  →  ${interval.name}`,
      hint: `Play ${NOTE_NAMES[root.semitone]}, then ${NOTE_NAMES[targetSemitone]}`,
      sequence: [root.semitone, targetSemitone],
      progress: 0,
      timeMs: GAME_CONFIG.timing.noteWindowMs + 1500,
    };
  }

  if (type === CHALLENGE_TYPE.SCALE) {
    const availableScales = Object.values(SCALES).filter(s => s.unlockFloor <= floor);
    if (availableScales.length === 0) return generateChallenge(CHALLENGE_TYPE.NOTE, floor);

    const scale = randPick(availableScales);
    const sequence = scale.intervals.map(i => (root.semitone + i) % 12);
    return {
      type,
      label: `${NOTE_NAMES[root.semitone]} ${scale.name} Scale`,
      hint: sequence.map(s => NOTE_NAMES[s]).join('  '),
      sequence,
      progress: 0,
      timeMs: scale.intervals.length * GAME_CONFIG.timing.sequenceNoteWindowMs,
    };
  }

  if (type === CHALLENGE_TYPE.CHORD) {
    const availableChords = Object.values(CHORDS).filter(c => c.unlockFloor <= floor);
    if (availableChords.length === 0) return generateChallenge(CHALLENGE_TYPE.NOTE, floor);

    const chord = randPick(availableChords);
    const required = new Set(chord.intervals.map(i => (root.semitone + i) % 12));
    const noteNames = [...required].map(s => NOTE_NAMES[s]).join(' - ');
    return {
      type,
      label: `${NOTE_NAMES[root.semitone]}${chord.symbol || ''} ${chord.name} Chord`,
      hint: `Arpeggiate: ${noteNames}`,
      sequence: [...required], // order doesn't matter for chords
      required, // Set of semitones to collect
      played: new Set(),
      progress: 0,
      timeMs: chord.intervals.length * GAME_CONFIG.timing.sequenceNoteWindowMs + 1000,
    };
  }

  return generateChallenge(CHALLENGE_TYPE.NOTE, floor);
}

/**
 * Pick a challenge type based on enemy's weight table and floor.
 */
export function pickChallengeType(enemy, floor) {
  const weights = { ...enemy.challengeWeights };

  // Zero out challenge types not yet available on this floor
  if (getAvailableIntervals(floor).length === 0) weights.INTERVAL = 0;
  if (floor < 5) weights.SCALE = 0;
  if (floor < 6) weights.CHORD = 0;

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return CHALLENGE_TYPE.NOTE;

  let roll = Math.random() * total;
  for (const [type, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return CHALLENGE_TYPE.NOTE;
}

/**
 * Evaluate a detected note against the active challenge.
 * Returns: 'SUCCESS' | 'FAIL' | 'NEAR_MISS' | 'PROGRESS' | null (no match, ignore)
 *
 * Mutates challenge.progress and challenge.played.
 */
export function evaluateNote(challenge, detectedNote) {
  if (!detectedNote || !challenge) return null;

  const { semitone } = detectedNote;

  if (challenge.type === CHALLENGE_TYPE.NOTE) {
    const target = challenge.sequence[0];
    if (semitoneMatches(semitone, target)) return 'SUCCESS';
    // Check if within 1 semitone
    const diff = Math.min(
      Math.abs(semitone - target),
      12 - Math.abs(semitone - target)
    );
    if (diff === 1) return 'NEAR_MISS';
    return 'FAIL';
  }

  if (challenge.type === CHALLENGE_TYPE.INTERVAL || challenge.type === CHALLENGE_TYPE.SCALE) {
    const target = challenge.sequence[challenge.progress];
    if (semitoneMatches(semitone, target)) {
      challenge.progress++;
      if (challenge.progress >= challenge.sequence.length) return 'SUCCESS';
      return 'PROGRESS';
    }
    // Wrong note in sequence - reset progress
    challenge.progress = 0;
    return 'FAIL';
  }

  if (challenge.type === CHALLENGE_TYPE.CHORD) {
    for (const req of challenge.required) {
      if (semitoneMatches(semitone, req)) {
        if (challenge.played.has(req)) return null; // already collected — ignore, don't penalise
        challenge.played.add(req);
        challenge.progress = challenge.played.size;
        if (challenge.played.size >= challenge.required.size) return 'SUCCESS';
        return 'PROGRESS';
      }
    }
    // Played a note that is not part of the chord
    return 'FAIL';
  }

  return null;
}

/**
 * Compute damage dealt to enemy on success (scales with combo).
 */
export function computeEnemyDamage(state) {
  const base = GAME_CONFIG.battle.baseDamageToEnemy;
  const { combo } = state.player;
  const [t1, t2] = GAME_CONFIG.battle.comboThresholds;
  const [m1, m2] = GAME_CONFIG.battle.comboMultipliers;
  let mult = 1;
  if (combo >= t2) mult = m2;
  else if (combo >= t1) mult = m1;
  return Math.round(base * mult);
}
