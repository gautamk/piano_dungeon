import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../game/StateMachine.js';
import { CHALLENGE_TYPE } from '../game/ChallengeEngine.js';
import { ROOM_TYPE } from '../game/DungeonGenerator.js';
import type { AudioEngine } from '../audio/AudioEngine.js';
import type { AudioSynth } from '../audio/AudioSynth.js';
import type { Enemy, Challenge, VirtualNote } from '../types.js';

// Minimal stubs — StateMachine only reads .currentNote, .rawFrequency, .inputMode, .devices
function makeAudio(note: { semitone: number; octave: number; midi: number; name: string } | null = null) {
  return { currentNote: note, rawFrequency: null, inputMode: 'none', devices: [] } as unknown as AudioEngine;
}

function makeSynth() {
  return { playNote: vi.fn(), previewChallenge: vi.fn() } as unknown as AudioSynth;
}

// Build a minimal NOTE challenge
function makeNoteChallenge(semitone = 0): Challenge {
  return {
    type: CHALLENGE_TYPE.NOTE,
    label: 'Play C4',
    targets: [{ semitone, octave: 4 }],
    sequence: [semitone],
    progress: 0,
    timeMs: 4000,
  } as unknown as Challenge;
}

// Build a minimal enemy
function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    name: 'Test Enemy',
    emoji: '👾',
    lore: '',
    currentHp: 40,
    maxHp: 40,
    attackPower: 5,
    isPractice: false,
    song: null,
    challengeWeights: { NOTE: 10, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 0 },
    ...overrides,
  } as Enemy;
}

// Seed battle state directly on sm.state without going through dungeon generation
function setupBattle(sm: StateMachine, enemy: Enemy = makeEnemy(), challenge: Challenge = makeNoteChallenge()): void {
  const s = sm.state;
  // Add a fake room at index 0
  s.dungeon.rooms = [{ type: ROOM_TYPE.COMBAT, index: 0, enemy, cleared: false, reachable: true }];
  s.dungeon.currentIndex = 0;
  s.battle.enemy = enemy;
  s.battle.challenge = challenge;
  s.battle.phase = 'WAITING';
  s.battle.timerMs = challenge.timeMs;
  s.battle.lastResult = null;
  s.battle.resultTimer = 0;
  s.battle.isPractice = false;
  s.screen = 'BATTLE';
}

// ─── Virtual Note Queue ──────────────────────────────────────────────────────

describe('triggerVirtualNote — queue management', () => {
  it('adds a note to the queue', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    sm.triggerVirtualNote(0, 4);
    expect(sm._virtualNoteQueue).toHaveLength(1);
  });

  it('caps queue at 4 (prevents unbounded growth from button-mashing)', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    for (let i = 0; i < 10; i++) sm.triggerVirtualNote(0, 4);
    expect(sm._virtualNoteQueue).toHaveLength(4);
  });

  it('sets state.audio.virtualNote immediately for instant piano highlight', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    sm.triggerVirtualNote(4, 4); // E4
    expect(sm.state.audio.virtualNote).not.toBeNull();
    expect(sm.state.audio.virtualNote!.semitone).toBe(4);
  });

  it('calls synth.playNote when synth is available', () => {
    const synth = makeSynth();
    const sm = new StateMachine(makeAudio(), synth);
    sm.triggerVirtualNote(7, 4);
    expect((synth as unknown as { playNote: ReturnType<typeof vi.fn> }).playNote).toHaveBeenCalledWith(7, 4);
  });

  it('does not throw when synth is null', () => {
    const sm = new StateMachine(makeAudio(), null);
    expect(() => sm.triggerVirtualNote(0, 4)).not.toThrow();
  });
});

// ─── Mic Cooldown After Virtual Note ────────────────────────────────────────

describe('mic cooldown', () => {
  it('sets _micEvalCooldownMs after a virtual note is consumed', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm);
    sm.triggerVirtualNote(0, 4); // push C4 — correct answer
    sm.tick(16);
    // Virtual note consumed → cooldown active
    expect(sm._micEvalCooldownMs).toBeGreaterThan(0);
  });

  it('rejects mic note during active cooldown', () => {
    const audio = makeAudio();
    const sm = new StateMachine(audio, makeSynth());
    setupBattle(sm, makeEnemy(), makeNoteChallenge(4)); // target = E4
    sm._micEvalCooldownMs = 300;

    // Send a mic note matching the target
    (audio as unknown as { currentNote: object }).currentNote = { semitone: 4, octave: 4, midi: 64, name: 'E' };
    sm.tick(16);
    // Mic note was blocked — challenge should still be WAITING
    expect(sm.state.battle.phase).toBe('WAITING');
  });

  it('allows mic note after cooldown expires', () => {
    const audio = makeAudio();
    const sm = new StateMachine(audio, makeSynth());
    setupBattle(sm, makeEnemy(), makeNoteChallenge(4)); // target = E4
    sm._micEvalCooldownMs = 10;

    (audio as unknown as { currentNote: object }).currentNote = { semitone: 4, octave: 4, midi: 64, name: 'E' };
    sm.tick(20); // cooldown decremented by 20 → expired
    // Mic note evaluated — challenge result set
    expect(sm.state.battle.phase).not.toBe('IDLE');
  });
});

// ─── Last Acted MIDI Guard (sustain prevention) ──────────────────────────────

describe('_lastActedMidi sustain guard', () => {
  it('does not double-evaluate the same held MIDI note', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm, makeEnemy(), makeNoteChallenge(0)); // target = C

    // Manually inject the current note
    sm.state.audio.note = { semitone: 0, octave: 4, midi: 48, name: 'C', frequency: 130.81, cents: 0 };
    sm.tick(16); // first evaluation → sets _lastActedMidi = 48

    // Second tick with same MIDI → should be blocked
    const phaseBefore = sm.state.battle.phase;
    sm.state.audio.note = { semitone: 0, octave: 4, midi: 48, name: 'C', frequency: 130.81, cents: 0 };
    sm.tick(16);
    // Phase should not have changed again (already in RESULT after first eval)
    expect(sm.state.battle.phase).toBe(phaseBefore);
  });
});

// ─── Battle Phase Transitions ────────────────────────────────────────────────

describe('battle phase: RESULT timer', () => {
  it('counts down resultTimer and moves to new challenge after expiry', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm);
    // Manually put battle into RESULT phase
    sm.state.battle.phase = 'RESULT';
    sm.state.battle.resultTimer = 500;
    sm.state.battle.lastResult = 'FAIL'; // not SUCCESS so enemy not dead

    sm.tick(600); // exceeds resultTimer

    // Should have left RESULT phase (new challenge started)
    expect(sm.state.battle.phase).toBe('WAITING');
  });

  it('stays in RESULT if timer has not expired', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm);
    sm.state.battle.phase = 'RESULT';
    sm.state.battle.resultTimer = 500;
    sm.state.battle.lastResult = 'FAIL';

    sm.tick(100); // only 100ms used
    expect(sm.state.battle.phase).toBe('RESULT');
    expect(sm.state.battle.resultTimer).toBeCloseTo(400, 0);
  });
});

describe('battle phase: challenge timeout', () => {
  it('in practice mode, resets timer without HP damage', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    const practiceEnemy = makeEnemy({ isPractice: true, attackPower: 5 });
    setupBattle(sm, practiceEnemy);
    const initialHp = sm.state.player.hp;

    sm.state.battle.timerMs = 1; // force timeout on next tick
    sm.tick(100);

    expect(sm.state.player.hp).toBe(initialHp); // no damage
    expect(sm.state.battle.phase).toBe('WAITING'); // stays in WAITING
  });

  it('in normal mode, damages player and enters RESULT phase', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm);
    const initialHp = sm.state.player.hp;

    sm.state.battle.timerMs = 1;
    sm.tick(100);

    expect(sm.state.player.hp).toBeLessThan(initialHp);
    expect(sm.state.battle.phase).toBe('RESULT');
  });
});

// ─── Virtual Note Consumption (one per tick) ─────────────────────────────────

describe('virtual note queue consumption', () => {
  it('drains one virtual note per tick (not the entire queue at once)', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    setupBattle(sm, makeEnemy(), makeNoteChallenge(0));
    // Push 3 virtual notes — C, D, E
    sm._virtualNoteQueue = [
      { semitone: 0, octave: 4, midi: 48, name: 'C', frequency: null, cents: 0, virtual: true } as VirtualNote,
      { semitone: 2, octave: 4, midi: 50, name: 'D', frequency: null, cents: 0, virtual: true } as VirtualNote,
      { semitone: 4, octave: 4, midi: 52, name: 'E', frequency: null, cents: 0, virtual: true } as VirtualNote,
    ];
    sm.tick(16);
    expect(sm._virtualNoteQueue).toHaveLength(2); // only one consumed
  });

  it('clears state.audio.virtualNote after queue is fully drained', () => {
    const sm = new StateMachine(makeAudio(), makeSynth());
    // Use an INTERVAL challenge: first note gives PROGRESS (stays WAITING), not SUCCESS
    const intervalChallenge = {
      type: CHALLENGE_TYPE.INTERVAL,
      label: 'C → G',
      sequence: [0, 7],
      progress: 0,
      timeMs: 5000,
    } as unknown as Challenge;
    setupBattle(sm, makeEnemy(), intervalChallenge);
    sm._virtualNoteQueue = [{ semitone: 0, octave: 4, midi: 48, name: 'C', frequency: null, cents: 0, virtual: true } as VirtualNote];
    sm.state.audio.virtualNote = { semitone: 0, octave: 4, midi: 48, name: 'C', frequency: null, cents: 0, virtual: true };
    sm.tick(16); // consume C → PROGRESS, phase stays WAITING, queue now empty
    sm.tick(16); // queue empty & no virtual note → virtualNote cleared
    expect(sm.state.audio.virtualNote).toBeNull();
  });
});
