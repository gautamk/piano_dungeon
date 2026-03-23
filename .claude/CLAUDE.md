# Piano Dungeon — Claude Rules

## Project Overview
Browser-based piano teaching roguelike. Uses Web Audio API for real-time pitch detection
from a USB-C piano microphone. Vanilla JS + ES modules + Vite. No framework, no TypeScript.

## Architecture
```
src/
├── main.js              # Entry: game loop, input, render dispatch
├── config.js            # Constants (GAME_CONFIG, COLORS) — change values here first
├── audio/
│   ├── AudioEngine.js   # Owns AudioContext + MediaStream lifecycle
│   ├── PitchDetector.js # Autocorrelation pitch detection (most critical file)
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
2. Vanilla JS only — no TypeScript, no JSX, no framework
3. No runtime npm dependencies — Vite is the only devDependency
4. Canvas for all game rendering — no DOM manipulation inside game screens
5. Keep functions under 50 lines — extract helpers when they grow

### Architecture
6. `StateMachine.js` is the only file that calls `sm.go()` — never transition from renderers
7. `ChallengeEngine.js` is the only file that calls `evaluateNote()` — single evaluation path
8. `AudioEngine.js` owns the `AudioContext` — never create another one
9. `GameState.js` holds the only mutable game state — renderers receive it as a parameter, never import it directly
10. Renderers are pure render functions `(renderer, state) => void` — no side effects, no state writes
11. `DungeonGenerator.js` must remain deterministic given the same seed

### What NOT To Do
- Do not add TypeScript, JSX, or any compile-to-JS language
- Do not add React, Vue, Svelte, or any UI framework
- Do not add runtime npm dependencies (no lodash, no three.js, etc.)
- Do not use `setTimeout`/`setInterval` for game timing — use delta time from the game loop
- Do not use `async/await` inside the game loop — only at initialization boundaries
- Do not add a CSS framework or preprocessor
- Do not split a working module into more files just for organization — only split when a file grows past ~200 lines of logic

### Audio Tuning
- Confidence threshold is in `GAME_CONFIG.audio.confidenceThreshold` (default 0.88)
- Stability frames in `GAME_CONFIG.audio.stabilityFrames` (default 3 frames ~50ms)
- If piano detection is too sensitive/slow, adjust these values first before changing algorithm
- The autocorrelation algorithm in `PitchDetector.js` works for monophonic piano — do not replace with FFT-based detection without profiling first

### Adding Content
- New enemy: add to `src/data/enemies.js` `ENEMY_ARCHETYPES` array
- New challenge type: add type constant to `ChallengeEngine.js` `CHALLENGE_TYPE`, implement `generateChallenge` and `evaluateNote` branches, add rendering in `BattleScreen.js`
- New floor theme: add to `DungeonScreen.js` `floorTheme()` function
- New music theory content: add to `src/data/music.js`

### Git
- Commit working game states only — the game loop must run without errors
- Never commit with `console.error` left in hot paths (game loop is fine for debug temporarily)
