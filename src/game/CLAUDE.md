# src/game/ — Game Logic

## Files
| File | Role |
|---|---|
| `StateMachine.js` | All screen transitions, battle tick, virtual note input — single authority |
| `GameState.js` | Creates and mutates the state object; pure helper functions only |
| `DungeonGenerator.js` | Seeded procedural floor generation |
| `ChallengeEngine.js` | Challenge generation and note evaluation |

---

## StateMachine

**The single authority for all state transitions.** No other file calls `sm.go()`.

### Constructor
```js
new StateMachine(audioEngine, audioSynth)
```
Both are stored as `this.audio` and `this.synth`. `audioSynth` may be `null` (game works without sound).

### Public API
| Method | When to call |
|---|---|
| `sm.tick(deltaMs)` | Every animation frame from `main.js` |
| `sm.triggerVirtualNote(semitone, octave)` | On virtual piano key press (click or keyboard) |
| `sm.onStartGame()` | After mic + synth initialised on title screen |
| `sm.onEnterRoom(index)` | On room click in dungeon map |
| `sm.onContinueAfterRoomClear()` | On click/Enter at room clear screen |
| `sm.onNextFloor()` | On floor clear continue |
| `sm.onBuyHp()` | On shop buy |
| `sm.onLeaveShop()` | On shop leave / Escape |
| `sm.onRestartGame()` | On game over / victory restart |

### `triggerVirtualNote(semitone, octave)`
- Sets `this._virtualNote` (consumed next `tick()`)
- Sets `state.audio.virtualNote` immediately (piano strip highlights at once)
- Calls `this.synth?.playNote(semitone, octave)` for speaker output

### Battle phases
```
SHOWING → WAITING → (note evaluated) → RESULT → (timer) → WAITING (new challenge)
                                                         └→ ROOM_CLEAR (enemy dead)
                                                         └→ GAME_OVER (player dead)
```

In `_tickBattle`: virtual note takes priority over mic note for evaluation, but mic note takes visual priority on the piano strip.

### Adding a new screen
1. Add a `go('MY_SCREEN')` call from the appropriate handler
2. Add `if (screen === 'MY_SCREEN') { ... }` in `_onEnter()`
3. Add per-frame logic in `_tickScreen()` if needed
4. Add the render branch in `main.js`

---

## GameState

**Plain mutable object — renderers read it, `StateMachine` writes it.**

### State shape (key fields)
```js
{
  screen: 'TITLE',          // current screen name
  player: { hp, maxHp, score, floor, combo },
  dungeon: { rooms[], currentIndex, runSeed },
  battle: { enemy, challenge, phase, lastResult, resultTimer, timerMs, consecutiveWrong },
  audio: { note, virtualNote, rawFreq, inputMode },
  feedback: [{ text, x, y, color, ttl, vy }],
  micDevices: [],
  micError: null,
}
```

### Mutation helpers (all exported from `GameState.js`)
| Function | Effect |
|---|---|
| `damagePlayer(state, amount)` | Reduces HP, resets combo, returns `true` if dead |
| `healPlayer(state, amount)` | Increases HP, clamped to `maxHp` |
| `scoreHit(state, baseDamage)` | Increments combo + adds to score |
| `spawnFeedback(state, text, x, y, color)` | Adds a floating label |
| `tickFeedback(state, deltaMs)` | Advances and prunes feedback each frame |

**Rules:**
- Use these helpers instead of mutating `state.player.*` directly — they keep combo/clamping consistent
- Never import `GameState.js` from renderers — state is passed as a parameter
- `runSeed` is set once on `createGameState()` and never changes during a run

---

## DungeonGenerator

**Must be deterministic** — same `(floor, seed)` always produces identical output.

### `generateFloor(floor, runSeed)` → `Room[]`
Room layout: `[combat, ...random mix, boss]`

Room type probabilities (post-first room):
- 55% COMBAT
- 15% ELITE (if elite enemies exist for this floor)
- 10% SHOP
- 20% REST
- Always caps with a BOSS room

### Room shape
```js
{
  type: 'COMBAT',        // COMBAT | ELITE | SHOP | REST | BOSS
  index: 0,
  enemy: { ...archetype, currentHp, maxHp, attackPower },
  cleared: false,
  reachable: false,      // true only for index 0 at generation time
}
```

### HP / attack scaling
- `scaleHp(enemy, floor)` = `round(enemy.maxHp × (1 + (floor − 1) × 0.15))`
- `scaleAttack(enemy, floor)` = `round(enemy.attackPower × (1 + (floor − 1) × 0.1))`

### `unlockNextRoom(rooms, clearedIndex)`
Call this after a room is cleared — it sets `rooms[clearedIndex + 1].reachable = true`.

**Tests live in** `src/__tests__/DungeonGenerator.test.js`. Run `bun test` after any changes.

**Do not:**
- Use `Math.random()` — use the seeded RNG created by `createRng(seed)` at the top of the file
- Change the RNG algorithm (mulberry32) — it would break existing saved seeds

---

## ChallengeEngine

**Single evaluation path** — `evaluateNote()` is only called from `StateMachine._evaluateChallengeNote()`.

### Challenge types
| Type | Unlock floor | Description |
|---|---|---|
| `NOTE` | 1 | Play a single target note |
| `INTERVAL` | 3 | Play root then interval target in sequence |
| `SCALE` | 5 | Play all scale degrees in order |
| `CHORD` | 6 | Arpeggiate all chord tones (any order) |

### `generateChallenge(type, floor)` → challenge object
All challenges have: `{ type, label, sequence[], progress, timeMs }`

- `sequence` = array of semitone integers (0–11) to match
- CHORD challenges also have `required` (Set) and `played` (Set)
- NOTE challenges also have `targets[{ semitone, octave }]` for octave-aware preview

### `evaluateNote(challenge, detectedNote)` → result string
| Return | Meaning |
|---|---|
| `'SUCCESS'` | Challenge complete |
| `'FAIL'` | Wrong note (sequence reset for INTERVAL/SCALE) |
| `'NEAR_MISS'` | One semitone off (NOTE only) — partial damage |
| `'PROGRESS'` | Correct note in sequence, more to go |
| `null` | No actionable result (null inputs) |

**Mutates** `challenge.progress` and `challenge.played` in place.

### Adding a new challenge type
1. Add constant to `CHALLENGE_TYPE`
2. Add a branch in `generateChallenge()` returning a valid challenge object
3. Add a branch in `evaluateNote()` returning one of the result strings above
4. Add rendering in `BattleScreen.renderChallengeArea()` (type badge colour, sequence display)
5. Add a branch in `AudioSynth.previewChallenge()` for the audio hint
6. Add tests in `src/__tests__/ChallengeEngine.test.js`

**Tests live in** `src/__tests__/ChallengeEngine.test.js`. Run `bun test` after any changes.
