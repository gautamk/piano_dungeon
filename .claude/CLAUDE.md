# Piano Dungeon — Claude Rules

## Project Overview
Browser-based piano teaching roguelike. Uses Web Audio API for real-time pitch detection
from a USB-C piano microphone. TypeScript + ES modules + Vite + Excalibur.js game engine.

## Task Management
Track all new work in **beads** (`bd create`, `bd list`, `bd close`). Do not maintain inline task lists inside CLAUDE.md files — open a bead instead.

## Architecture
```
src/
├── main.ts              # Entry: game loop, input, render dispatch (Excalibur LegacyScene bridge)
├── types.ts             # Central shared interfaces — all game types defined here
├── config.ts            # Constants (GAME_CONFIG, COLORS) — change values here first
├── audio/
│   ├── AudioEngine.ts   # Mic input: owns the input AudioContext + MediaStream lifecycle
│   ├── AudioSynth.ts    # Audio output: Tone.js piano synth for note playback + previews
│   ├── PitchDetector.ts # McLeod Pitch Method detection via pitchy (most critical file)
│   └── NoteMapper.ts    # Pure functions: Hz → MIDI → note name
├── game/
│   ├── GameState.ts     # Plain mutable object — single source of truth
│   ├── StateMachine.ts  # All screen transitions and game logic live here
│   ├── DungeonGenerator.ts  # Seeded procedural floor generation
│   └── ChallengeEngine.ts   # Challenge generation + note evaluation
├── data/
│   ├── music.ts         # Notes, scales, chords, intervals (music theory data)
│   ├── songs.ts         # Song definitions (SONGS, SONGS_LIST)
│   └── enemies.ts       # Enemy archetypes and bosses
└── rendering/
    ├── Renderer.ts       # Canvas wrapper + utility drawing methods
    ├── BattleScreen.ts   # Battle screen layout
    ├── DungeonScreen.ts  # Dungeon map layout + click hit regions
    ├── PianoRenderer.ts  # Piano keyboard strip (always visible in battle)
    ├── TitleScreen.ts    # Title + mic setup screen
    └── OverlayScreens.ts # Room clear, floor clear, shop, game over, victory
```

## Rules

### Code Style
1. ES modules throughout (`import`/`export`) — no CommonJS, no dynamic `require()`
2. TypeScript (`.ts`) for all files. `tsconfig.json` has `strict: true` and no `allowJs`. No JSX, no framework.
3. Approved runtime deps: `excalibur` (game engine), `pitchy` (pitch detection), `tone` (audio output). Do not add others without strong justification.
4. Canvas for all game rendering — no DOM manipulation inside game screens
5. Keep functions under 50 lines — extract helpers when they grow

### Architecture
6. `StateMachine.ts` is the only file that calls `sm.go()` — never transition from renderers
7. `ChallengeEngine.ts` is the only file that calls `evaluateNote()` — single evaluation path
8. `AudioEngine.ts` owns the **input** AudioContext (mic pipeline). `AudioSynth.ts` owns Tone.js output. Never mix the two contexts.
9. `GameState.ts` holds the only mutable game state — renderers receive it as a parameter, never import it directly
10. Renderers are pure render functions `(renderer: Renderer, state: GameState) => void` — no side effects, no state writes
11. `DungeonGenerator.ts` must remain deterministic given the same seed
12. All shared interfaces live in `src/types.ts` — do not duplicate type definitions across files

### What NOT To Do
- Do not add JSX, or non-TypeScript compile-to-JS languages (CoffeeScript, etc.)
- Do not add React, Vue, Svelte, or any UI framework
- Do not add runtime npm dependencies beyond `excalibur`, `pitchy`, and `tone`
- Do not use `setTimeout`/`setInterval` for game timing — use delta time from the game loop
- Do not use `async/await` inside the game loop — only at initialization boundaries
- Do not add a CSS framework or preprocessor
- Do not split a working module into more files just for organization — only split when a file grows past ~200 lines of logic

### Audio Tuning
- Confidence threshold is in `GAME_CONFIG.audio.confidenceThreshold` (default 0.88)
- Stability frames in `GAME_CONFIG.audio.stabilityFrames` (default 3 frames ~50ms)
- If piano detection is too sensitive/slow, adjust these values first before changing algorithm
- `PitchDetector.ts` uses pitchy's McLeod Pitch Method — more accurate than autocorrelation for piano, avoids octave errors. Do not replace without profiling first.
- Challenge preview volume is controlled in `AudioSynth.ts` (`_previewSynth` volume, default -14 dB). Virtual piano volume is `_synth` (default -4 dB).

### Adding Content
- New enemy: add to `src/data/enemies.ts` `ENEMY_ARCHETYPES` array
- New challenge type: add type constant to `ChallengeEngine.ts` `CHALLENGE_TYPE`, implement `generateChallenge` and `evaluateNote` branches, add rendering in `BattleScreen.ts`
- New floor theme: add to `DungeonScreen.ts` `floorTheme()` function
- New music theory content: add to `src/data/music.ts`

### Runtime
- Project uses **Bun** (not Node.js) — use `bun` for all scripts and package management
- `bun test` runs vitest; `bun scripts/midi-to-songs.js` runs the MIDI converter

### Excalibur + Legacy Bridge
- `main.ts` creates `ex.Engine({ canvasElementId: 'game', displayMode: FitScreen })` and wires up `LegacyScene` + `LegacyActor`
- `LegacyActor.onPreUpdate(deltaMs)` runs the game tick (`audio.tick()`, `sm.tick()`); an `ex.Canvas` graphic (offscreen, `cache: false`) swaps `renderer.ctx` each frame and calls the legacy `render()` dispatcher
- Excalibur uses WebGL by default — **do not** pass `engine.canvas` to `new Renderer()`; use a detached dummy canvas instead (ctx is replaced per frame)
- New game screens should be proper Excalibur Scenes. Legacy screens remain in `LegacyScene` until their migration bead.

### Git
- Commit working game states only — the game loop must run without errors
- Never commit with `console.error` left in hot paths (game loop is fine for debug temporarily)
