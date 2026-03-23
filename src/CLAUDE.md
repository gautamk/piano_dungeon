# src/ — Entry Point & Configuration

## Files
| File | Role |
|---|---|
| `main.ts` | Game entry: Excalibur engine, LegacyScene bridge, input handlers, render dispatch |
| `types.ts` | Central shared interfaces — all game types defined here; import from here, never redeclare |
| `config.ts` | All tunable constants — change values here first before editing logic |

---

## main.ts

**This is the only file allowed to:**
- Import and instantiate `AudioEngine`, `AudioSynth`, `StateMachine`, `Renderer`
- Create the `ex.Engine` and define `LegacyActor` / `LegacyScene`
- Register DOM event listeners (`canvas click`, `keydown`, `keyup`)

**The game loop** is owned by Excalibur. `LegacyActor.onPreUpdate(deltaMs)` replaces the old RAF loop:
```ts
onPreUpdate(_engine: ex.Engine, deltaMs: number): void {
  audio.tick();       // update mic pitch detection
  sm.tick(deltaMs);   // advance game state (delta already capped by Excalibur)
}
```
Rendering fires via `ex.Canvas.draw(ctx)` — the callback swaps `renderer.ctx` to the offscreen ctx then calls `render(sm.state)`.

**Important:** Excalibur uses WebGL by default. `engine.canvas.getContext('2d')` returns `null`.
Always initialise `Renderer` with a detached canvas: `new Renderer(document.createElement('canvas'))`.
The `renderer.ctx` is replaced each frame inside the `ex.Canvas` draw callback.

**Input handling rules:**
- `canvas` is `engine.canvas` — click listeners attach to it directly
- Click coordinates must always be converted via `toLogicalCoords(e)` before any hit testing
- Piano key regions return `{ semitone, octave }` — pass both directly to `sm.triggerVirtualNote()`
- Keyboard piano keys use `KEY_NOTE_MAP`; guard with `heldKeys` to prevent key-repeat spam
- `handleTitleStart()` is the only async call in the input path — it initialises mic + synth

**Coordinate system:** All logical coordinates are 1280×720 regardless of display DPI or window size.
Excalibur's `DisplayMode.FitScreen` handles letterboxing; `toLogicalCoords` uses `getBoundingClientRect()` for pointer mapping.

**Adding a new screen:**
1. Add a render branch in `render(state)`
2. Add click handling in the `canvas click` listener
3. Add any keyboard shortcuts in `keydown`
4. State transition lives in `StateMachine` — not here

---

## types.ts

Single source of truth for all TypeScript interfaces and union types. Key exports:
- Primitive unions: `ChallengeType`, `EvaluationResult`, `RoomType`, `BattlePhase`, `InputMode`, `Screen`
- Music: `NoteReference`, `Scale`, `Chord`, `Interval`, `Song`, `SongNote`
- Audio: `NoteBase`, `DetectedNote`, `VirtualNote`, `PitchResult`
- Game: `Enemy`, `Room`, `GameState`, `PlayerState`, `BattleState`, `AudioState`, `DungeonState`
- Challenges: `NoteChallenge`, `IntervalChallenge`, `ScaleChallenge`, `ChordChallenge`, `MelodyChallenge`, `Challenge` (union)
- Rendering: `HitRegion`, `KeyRegion`, `RoomHitRegion`, `PracticeHitRegion`

**Do not** define game types in other files — always import from `types.ts`.

---

## config.ts

Single source of truth for every magic number in the game.

```
GAME_CONFIG.audio        — mic sensitivity, FFT size, stability frames
GAME_CONFIG.player       — starting HP, max floors
GAME_CONFIG.battle       — damage values, combo thresholds
GAME_CONFIG.dungeon      — room count range
GAME_CONFIG.timing       — challenge window durations (ms)

COLORS                   — palette for all renderers
COLORS.rooms             — per-room-type fill colours
COLORS.keys              — piano key states
```

**Rules:**
- Never hardcode a colour or timing value outside `config.ts`
- Never import `config.ts` inside `rendering/` directly from individual draw helpers — import it at the top of the renderer file and pass values down
- To tune challenge difficulty: adjust `GAME_CONFIG.timing.*` — do not touch `ChallengeEngine.ts` first
- To tune audio sensitivity: adjust `GAME_CONFIG.audio.confidenceThreshold` and `stabilityFrames` before touching `PitchDetector.ts`
