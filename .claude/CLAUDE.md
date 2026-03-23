# Piano Dungeon — Claude Rules

## Project Overview
Browser-based piano teaching roguelike. Uses Web Audio API for real-time pitch detection
from a USB-C piano microphone. TypeScript + ES modules + Vite + Excalibur.js game engine.

## Architecture
```
src/
├── main.ts              # Entry: game loop, input, render dispatch (Excalibur LegacyScene bridge)
├── config.js            # Constants (GAME_CONFIG, COLORS) — change values here first
├── audio/
│   ├── AudioEngine.js   # Mic input: owns the input AudioContext + MediaStream lifecycle
│   ├── AudioSynth.js    # Audio output: Tone.js piano synth for note playback + previews
│   ├── PitchDetector.js # McLeod Pitch Method detection via pitchy (most critical file)
│   └── NoteMapper.js    # Pure functions: Hz → MIDI → note name
├── game/
│   ├── GameState.js     # Plain mutable object — single source of truth
│   ├── StateMachine.js  # All screen transitions and game logic live here
│   ├── DungeonGenerator.js  # Seeded procedural floor generation
│   └── ChallengeEngine.js   # Challenge generation + note evaluation
├── data/
│   ├── music.js         # Notes, scales, chords, intervals (music theory data)
│   └── enemies.js       # Enemy archetypes and bosses
└── rendering/
    ├── Renderer.js       # Canvas wrapper + utility drawing methods
    ├── BattleScreen.js   # Battle screen layout
    ├── DungeonScreen.js  # Dungeon map layout + click hit regions
    ├── PianoRenderer.js  # Piano keyboard strip (always visible in battle)
    ├── TitleScreen.js    # Title + mic setup screen
    └── OverlayScreens.js # Room clear, floor clear, shop, game over, victory
```

## Rules

### Code Style
1. ES modules throughout (`import`/`export`) — no CommonJS, no dynamic `require()`
2. TypeScript (`.ts`) for all new files. Legacy `.js` files are migrated one per bead. No JSX, no framework.
3. Approved runtime deps: `excalibur` (game engine), `pitchy` (pitch detection), `tone` (audio output). Do not add others without strong justification.
4. Canvas for all game rendering — no DOM manipulation inside game screens
5. Keep functions under 50 lines — extract helpers when they grow

### Architecture
6. `StateMachine.js` is the only file that calls `sm.go()` — never transition from renderers
7. `ChallengeEngine.js` is the only file that calls `evaluateNote()` — single evaluation path
8. `AudioEngine.js` owns the **input** AudioContext (mic pipeline). `AudioSynth.js` owns Tone.js output. Never mix the two contexts.
9. `GameState.js` holds the only mutable game state — renderers receive it as a parameter, never import it directly
10. Renderers are pure render functions `(renderer, state) => void` — no side effects, no state writes
11. `DungeonGenerator.js` must remain deterministic given the same seed

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
- `PitchDetector.js` uses pitchy's McLeod Pitch Method — more accurate than autocorrelation for piano, avoids octave errors. Do not replace without profiling first.
- Challenge preview volume is controlled in `AudioSynth.js` (`_previewSynth` volume, default -14 dB). Virtual piano volume is `_synth` (default -4 dB).

### Adding Content
- New enemy: add to `src/data/enemies.js` `ENEMY_ARCHETYPES` array
- New challenge type: add type constant to `ChallengeEngine.js` `CHALLENGE_TYPE`, implement `generateChallenge` and `evaluateNote` branches, add rendering in `BattleScreen.js`
- New floor theme: add to `DungeonScreen.js` `floorTheme()` function
- New music theory content: add to `src/data/music.js`

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
