import { describe, it, expect } from 'vitest';
import {
  createGameState,
  damagePlayer,
  healPlayer,
  scoreHit,
  spawnFeedback,
  tickFeedback,
} from '../game/GameState.js';
import type { GameState } from '../types.js';

function makeState(overrides: { player?: Partial<GameState['player']>; feedback?: GameState['feedback'] } = {}): GameState {
  const s = createGameState();
  s.player = { ...s.player, ...overrides.player };
  if (overrides.feedback) s.feedback = overrides.feedback;
  return s;
}

describe('damagePlayer', () => {
  it('reduces HP by the given amount', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 3, score: 0, floor: 1 } });
    damagePlayer(s, 2);
    expect(s.player.hp).toBe(3);
  });

  it('clamps HP to 0 (never goes negative)', () => {
    const s = makeState({ player: { hp: 1, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    damagePlayer(s, 10);
    expect(s.player.hp).toBe(0);
  });

  it('returns true when player dies (hp reaches 0)', () => {
    const s = makeState({ player: { hp: 1, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    expect(damagePlayer(s, 1)).toBe(true);
  });

  it('returns false when player survives', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    expect(damagePlayer(s, 2)).toBe(false);
  });

  it('resets combo to 0 on damage', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 7, score: 0, floor: 1 } });
    damagePlayer(s, 1);
    expect(s.player.combo).toBe(0);
  });

  it('resets combo even when HP was already 0', () => {
    const s = makeState({ player: { hp: 0, maxHp: 5, combo: 5, score: 0, floor: 1 } });
    damagePlayer(s, 1);
    expect(s.player.combo).toBe(0);
  });
});

describe('healPlayer', () => {
  it('increases HP by the given amount', () => {
    const s = makeState({ player: { hp: 2, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    healPlayer(s, 2);
    expect(s.player.hp).toBe(4);
  });

  it('clamps HP to maxHp (never exceeds cap)', () => {
    const s = makeState({ player: { hp: 4, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    healPlayer(s, 10);
    expect(s.player.hp).toBe(5);
  });

  it('is a no-op when HP is already at max', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    healPlayer(s, 3);
    expect(s.player.hp).toBe(5);
  });
});

describe('scoreHit', () => {
  it('increments combo by 1', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 2, score: 100, floor: 1 } });
    scoreHit(s, 20);
    expect(s.player.combo).toBe(3);
  });

  it('adds baseDamage to score', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 0, score: 50, floor: 1 } });
    scoreHit(s, 30);
    expect(s.player.score).toBe(80);
  });

  it('accumulates combo over multiple calls', () => {
    const s = makeState({ player: { hp: 5, maxHp: 5, combo: 0, score: 0, floor: 1 } });
    scoreHit(s, 10);
    scoreHit(s, 10);
    scoreHit(s, 10);
    expect(s.player.combo).toBe(3);
    expect(s.player.score).toBe(30);
  });
});

describe('spawnFeedback', () => {
  it('adds a feedback entry to state.feedback', () => {
    const s = createGameState();
    spawnFeedback(s, 'Test!', 100, 200, '#fff');
    expect(s.feedback).toHaveLength(1);
    expect(s.feedback[0]).toMatchObject({ text: 'Test!', x: 100, y: 200, color: '#fff' });
  });

  it('spawns with a positive TTL and downward velocity', () => {
    const s = createGameState();
    spawnFeedback(s, 'Hi', 0, 0, 'red');
    expect(s.feedback[0].ttl).toBeGreaterThan(0);
    expect(s.feedback[0].vy).toBeLessThan(0); // floats upward (negative y)
  });

  it('supports multiple simultaneous feedback items', () => {
    const s = createGameState();
    spawnFeedback(s, 'A', 0, 0, 'red');
    spawnFeedback(s, 'B', 10, 10, 'blue');
    spawnFeedback(s, 'C', 20, 20, 'green');
    expect(s.feedback).toHaveLength(3);
  });
});

describe('tickFeedback', () => {
  it('decrements TTL by deltaMs', () => {
    const s = createGameState();
    spawnFeedback(s, 'X', 0, 0, '#fff');
    const initialTtl = s.feedback[0].ttl;
    tickFeedback(s, 100);
    expect(s.feedback[0].ttl).toBe(initialTtl - 100);
  });

  it('moves the feedback upward each tick (y += vy where vy < 0)', () => {
    const s = createGameState();
    spawnFeedback(s, 'X', 0, 300, '#fff');
    const initialY = s.feedback[0].y;
    tickFeedback(s, 16);
    expect(s.feedback[0].y).toBeLessThan(initialY); // moved up
  });

  it('removes entries whose TTL hits 0 or below', () => {
    const s = createGameState();
    spawnFeedback(s, 'dying', 0, 0, 'red');
    s.feedback[0].ttl = 50;
    tickFeedback(s, 50); // ttl becomes 0 → filtered out
    expect(s.feedback).toHaveLength(0);
  });

  it('keeps entries that still have TTL remaining', () => {
    const s = createGameState();
    spawnFeedback(s, 'alive', 0, 0, 'red');
    s.feedback[0].ttl = 200;
    tickFeedback(s, 50);
    expect(s.feedback).toHaveLength(1);
  });

  it('filters expired entries while keeping alive ones', () => {
    const s = createGameState();
    spawnFeedback(s, 'alive', 0, 0, 'green');
    spawnFeedback(s, 'dead', 0, 0, 'red');
    s.feedback[0].ttl = 500;
    s.feedback[1].ttl = 10;
    tickFeedback(s, 20); // second entry expires
    expect(s.feedback).toHaveLength(1);
    expect(s.feedback[0].text).toBe('alive');
  });
});
