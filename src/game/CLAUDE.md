# src/game/ — Game Logic

## Files
| File | Role |
|---|---|
| `StateMachine.ts` | All screen transitions, battle tick, virtual note input — single authority |
| `GameState.ts` | Creates and mutates the state object; pure helper functions only |
| `DungeonGenerator.ts` | Seeded procedural floor generation |
| `ChallengeEngine.ts` | Challenge generation and note evaluation |

---

## StateMachine

**The single authority for all state transitions.** No other file calls `sm.go()`.

### Constructor
```ts
new StateMachine(audioEngine: AudioEngine, audioSynth: AudioSynth | null)
```
Both are stored as `this.audio` and `this.synth`. `audioSynth` may be `null` (game works without sound).

### Public API
| Method | When to call |
|---|---|
| `sm.tick(deltaMs)` | Every frame from `LegacyActor.onPreUpdate` in `main.ts` |
| `sm.triggerVirtualNote(semitone, octave)` | On virtual piano key press (click or keyboard) |
| `sm.onStartGame()` | After mic + synth initialised on title screen |
| `sm.onEnterRoom(index)` | On room click in dungeon map |
| `sm.onContinueAfterRoomClear()` | On click/Enter at room clear screen |
| `sm.onNextFloor()` | On floor clear continue |
| `sm.onBuyHp()` | On shop buy |
| `sm.onLeaveShop()` | On shop leave / Escape |
| `sm.onRestartGame()` | On game over / victory restart |

### `triggerVirtualNote(semitone, octave)`
- Pushes a `VirtualNote` onto `this._virtualNoteQueue` (capped at 4 — prevents button-mash overflow)
- Sets `state.audio.virtualNote` immediately (piano strip highlights at once)
- Calls `this.synth?.playNote(semitone, octave)` for speaker output
- Queue is drained one note per `tick()` call

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
4. Add the render branch in `main.ts` (legacy) or create a new Excalibur Scene

---

## GameState

**Plain mutable object — renderers read it, `StateMachine` writes it.**

All types are defined in `src/types.ts` (`GameState`, `PlayerState`, `BattleState`, etc.).

### State shape (key fields)
```ts
{
  screen: Screen,           // current screen name (union literal)
  player: PlayerState,      // { hp, maxHp, score, floor, combo }
  dungeon: DungeonState,    // { rooms[], currentIndex, runSeed }
  battle: BattleState,      // { enemy, challenge, phase, lastResult, resultTimer, timerMs, ... }
  audio: AudioState,        // { note, virtualNote, rawFreq, inputMode }
  feedback: FeedbackMessage[],
  micDevices: MediaDeviceInfo[],
  micError: string | null,
}
```

### Mutation helpers (all exported from `GameState.ts`)
| Function | Effect |
|---|---|
| `damagePlayer(state, amount)` | Reduces HP, resets combo, returns `true` if dead |
| `healPlayer(state, amount)` | Increases HP, clamped to `maxHp` |
| `scoreHit(state, baseDamage)` | Increments combo + adds to score |
| `spawnFeedback(state, text, x, y, color)` | Adds a floating label |
| `tickFeedback(state, deltaMs)` | Advances and prunes feedback each frame |

**Rules:**
- Use these helpers instead of mutating `state.player.*` directly — they keep combo/clamping consistent
- Never import `GameState.ts` from renderers — state is passed as a parameter
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
See `Room` interface in `src/types.ts`.

### HP / attack scaling
- `scaleHp(enemy, floor)` = `round(enemy.maxHp × (1 + (floor − 1) × 0.15))`
- `scaleAttack(enemy, floor)` = `round(enemy.attackPower × (1 + (floor − 1) × 0.1))`

### `unlockNextRoom(rooms, clearedIndex)`
Call this after a room is cleared — it sets `rooms[clearedIndex + 1].reachable = true`.

**Tests live in** `src/__tests__/DungeonGenerator.test.ts`. Run `bun test` after any changes.

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
| `MELODY` | any | Play a phrase from a song (boss/practice enemies) |

### `generateChallenge(type, floor)` → `Challenge`
All challenges satisfy the `BaseChallenge` interface: `{ type, label, sequence[], progress, timeMs }`.

- `sequence` = array of semitone integers (0–11) to match
- `ChordChallenge` also has `required: Set<number>` and `played: Set<number>`
- `NoteChallenge` also has `targets: { semitone, octave }[]` for octave-aware preview
- `MelodyChallenge` also has `octaves: number[]` and `song: Song`

The `Challenge` type is a discriminated union; narrow on `challenge.type` to access variant-specific fields.

### `evaluateNote(challenge, detectedNote)` → `EvaluationResult | null`
| Return | Meaning |
|---|---|
| `'SUCCESS'` | Challenge complete |
| `'FAIL'` | Wrong note (sequence reset for INTERVAL/SCALE/MELODY) |
| `'NEAR_MISS'` | One semitone off (NOTE only) — partial damage |
| `'PROGRESS'` | Correct note in sequence, more to go |
| `null` | No actionable result (null inputs, already-played chord tone) |

**Mutates** `challenge.progress` and `challenge.played` in place.

### Adding a new challenge type
1. Add constant to `CHALLENGE_TYPE` and the union in `src/types.ts`
2. Add a branch in `generateChallenge()` returning a valid challenge object
3. Add a branch in `evaluateNote()` returning one of the result strings above
4. Add rendering in `BattleScreen.ts` (type badge colour, sequence display)
5. Add a branch in `AudioSynth.previewChallenge()` for the audio hint
6. Add tests in `src/__tests__/ChallengeEngine.test.ts`

**Tests live in** `src/__tests__/ChallengeEngine.test.ts`. Run `bun test` after any changes.
