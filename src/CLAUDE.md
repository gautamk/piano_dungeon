# src/ — Entry Point & Configuration

## Files
| File | Role |
|---|---|
| `main.ts` | Game entry: Excalibur engine setup, keyboard input, scene registration |
| `types.ts` | Central shared interfaces — all game types defined here; import from here, never redeclare |
| `config.ts` | All tunable constants — change values here first before editing logic |

---

## main.ts

**This is the only file allowed to:**
- Import and instantiate `AudioEngine`, `AudioSynth`, `StateMachine`, `Renderer`
- Create the `ex.Engine` and register all scenes
- Register global DOM keyboard listeners (`keydown`, `keyup`)

**The game loop** is owned by Excalibur. Each scene's `onPreUpdate(engine, elapsed)` runs the tick:
```ts
audio.tick();       // update mic pitch detection
sm.tick(elapsed);   // advance game state (delta already capped by Excalibur)
```
Rendering fires via `ex.Canvas.draw(ctx)` in `GameScene.onInitialize` — the callback swaps `renderer.ctx` to the offscreen context then calls `renderFrame()`.

**Important:** Excalibur uses WebGL by default. `engine.canvas.getContext('2d')` returns `null`.
Always initialise `Renderer` with a detached canvas: `new Renderer(document.createElement('canvas'))`.
The `renderer.ctx` is replaced each frame inside the `ex.Canvas` draw callback.

**Keyboard input:**
- Navigation keys (`Enter`, `Escape`) are handled with a `document keydown` listener that reads `sm.state.screen` and calls the appropriate SM handler
- Piano keys use `KEY_NOTE_MAP` (QWERTY layout); guarded with `heldKeys` Set to prevent key-repeat spam
- Only `triggerVirtualNote()` calls are made from the keyboard handler — no rendering or state writes

**Coordinate system:** All logical coordinates are 1280×720 regardless of display DPI or window size.
Excalibur's `DisplayMode.FitScreen` handles letterboxing; `GameScene._toLogical()` uses `getBoundingClientRect()` for pointer mapping.

**Adding a new screen:**
1. Create `src/scenes/MyScreen.ts` extending `GameScene` — implement `renderFrame()` and `handleClick()`
2. Add a renderer in `src/rendering/` if needed (pure function called from `renderFrame()`)
3. Register the scene in `main.ts`: `engine.addScene('my_screen', new MyScene(deps))`
4. Add `MY_SCREEN` to the `Screen` union in `types.ts`
5. Map it in `SCREEN_TO_SCENE` in `GameScene.ts`
6. Wire the transition in `StateMachine.ts` via `go()`

---

## types.ts

Single source of truth for all TypeScript interfaces and union types. Key exports:
- Primitive unions: `ChallengeType`, `EvaluationResult`, `RoomType`, `BattlePhase`, `InputMode`, `Screen`
- Music: `NoteReference`, `Scale`, `Chord`, `Interval`, `Song`, `SongNote`
- Audio: `NoteBase`, `DetectedNote`, `VirtualNote`, `PitchResult`
- Game: `Enemy`, `Room`, `GameState`, `PlayerState`, `BattleState`, `AudioState`, `DungeonState`
- Challenges: `NoteChallenge`, `IntervalChallenge`, `ScaleChallenge`, `ChordChallenge`, `MelodyChallenge`, `Challenge` (union)
- Scene payloads: `SceneActivationData` union — typed data passed to `engine.goToScene()`
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
