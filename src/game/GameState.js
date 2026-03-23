/**
 * Single mutable store for all game state.
 * Renderers read from here; game logic writes to here via the state machine.
 * Never import this directly in renderers — pass it as a parameter.
 */

export function createGameState() {
  return {
    screen: 'TITLE', // current screen name

    player: {
      hp: 5,
      maxHp: 5,
      score: 0,
      floor: 1,
      combo: 0,
    },

    dungeon: {
      rooms: [],        // array of room objects
      currentIndex: -1, // index of room player is in (-1 = on map)
      runSeed: Math.floor(Math.random() * 99999),
    },

    battle: {
      enemy: null,          // enemy archetype + current hp
      challenge: null,      // active challenge object
      phase: 'IDLE',        // IDLE | SHOWING | WAITING | RESULT
      lastResult: null,     // 'SUCCESS' | 'FAIL' | 'NEAR_MISS'
      resultTimer: 0,       // ms remaining to show result feedback
      timerMs: 0,           // ms remaining for current challenge
      consecutiveWrong: 0,
    },

    // Live audio data (set by AudioEngine each frame)
    audio: {
      note: null,      // { semitone, octave, name, midi, frequency, cents }
      rawFreq: null,   // raw detected frequency (for tuning display)
    },

    // Floating feedback messages (damage numbers, text popups)
    feedback: [], // [{ text, x, y, color, ttl, vy }]

    // Mic device selection (used on title screen)
    micDevices: [],
    micError: null,
  };
}

/** Mutate player HP, clamping to [0, maxHp]. Returns true if player died. */
export function damagePlayer(state, amount) {
  state.player.hp = Math.max(0, state.player.hp - amount);
  state.player.combo = 0;
  return state.player.hp === 0;
}

/** Heal player, clamping to maxHp. */
export function healPlayer(state, amount) {
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
}

/** Add score and advance combo. */
export function scoreHit(state, baseDamage) {
  state.player.combo++;
  state.player.score += baseDamage;
}

/** Spawn a floating feedback label on the canvas. */
export function spawnFeedback(state, text, x, y, color) {
  state.feedback.push({ text, x, y, color, ttl: 1200, vy: -1.5 });
}

/** Advance feedback animations each frame (deltaMs). */
export function tickFeedback(state, deltaMs) {
  for (const f of state.feedback) {
    f.ttl -= deltaMs;
    f.y += f.vy;
  }
  state.feedback = state.feedback.filter(f => f.ttl > 0);
}
