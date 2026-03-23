# Piano Dungeon

A roguelike piano teaching game that runs in the browser. Defeat enemies by playing the correct notes, intervals, scales, and chords. Progress through 10 dungeon floors — die and start over.

## Quick Start

```bash
bun install
bun run dev
```

Open `http://localhost:5173` in Chrome or Edge (Web Audio API works best there).

## How to Play

### Input Options (all work simultaneously)

| Method | How |
|---|---|
| **Virtual piano (click)** | Click the piano keys at the bottom of the battle screen |
| **Keyboard shortcuts** | See layout below — no piano needed |
| **Real piano via mic** | Connect via USB-C or built-in mic; grant permission when prompted |

Mic is **optional** — the full game is playable with mouse clicks or keyboard.

### Keyboard Piano Layout

```
Black keys:  W  E     T  Y  U
White keys: A  S  D  F  G  H  J  K
            C  D  E  F  G  A  B  C  (octave 4)

Lower octave (C3): Z X C V B N M
```

### Game Loop

1. **Title screen** — click Start (mic permission prompt appears, you can deny it)
2. **Dungeon map** — click a reachable room to enter
3. **Battle** — enemy presents a musical challenge, play the correct note(s) to deal damage
4. **Win the room** — enemy HP reaches 0; collect score and continue
5. **Floor clear** — defeat the boss to advance to the next floor
6. **Death** — player HP hits 0; score is shown, restart from floor 1

### Challenge Types by Floor

| Floor | Challenges |
|---|---|
| 1–2 | Single notes (white keys, C–G) |
| 3–4 | Notes + Perfect 5th / Perfect 8th intervals |
| 5–6 | All intervals + Major scale |
| 7–8 | Scales + Major/Minor chords (arpeggiated) |
| 9–10 | All types including Dominant 7th and Harmonic Minor |

### Combat

- **Correct note** → deal damage to enemy, build combo
- **Wrong note** → take damage from enemy, combo resets
- **Close (±1 semitone)** → minor damage, retry allowed
- **Timer runs out** → take damage, new challenge
- **3× combo** → 1.5× damage; **5× combo** → 2× damage

### Rooms

| Icon | Type | Effect |
|---|---|---|
| ⚔ | Combat | Fight a regular enemy |
| ☆ | Elite | Harder enemy, better score |
| + | Rest | Recover 2 HP automatically |
| $ | Shop | Spend 50 score for +2 HP |
| ☠ | Boss | Floor boss — defeat to advance |

## Real Piano Setup (optional)

1. Connect your piano via USB-C interface or built-in mic
2. Click Start — browser will ask for microphone permission
3. If you have multiple audio inputs, the game tries your previously selected device first, then falls back to system default
4. The device ID is saved in `localStorage` so it persists across sessions

**Tip:** For best pitch detection, play notes cleanly without heavy sustain pedal. The pitch detector needs ~50ms of stable signal before registering a note.

## Development

```bash
bun run dev      # start dev server with hot reload
bun run build    # production build → dist/
bun run preview  # serve production build locally
```

## Project Structure

```
src/
├── main.js                # Entry point: game loop, input handling, render dispatch
├── config.js              # All tunable constants (timing, colors, damage values)
├── audio/
│   ├── AudioEngine.js     # Mic lifecycle (getUserMedia, AudioContext)
│   ├── PitchDetector.js   # Autocorrelation pitch detection algorithm
│   └── NoteMapper.js      # Hz → MIDI → note name conversions
├── game/
│   ├── GameState.js       # Plain mutable state object + helper mutations
│   ├── StateMachine.js    # All screen transitions and game logic
│   ├── DungeonGenerator.js # Seeded procedural floor generation
│   └── ChallengeEngine.js  # Challenge creation and note evaluation
├── data/
│   ├── music.js           # Notes, scales, chords, intervals
│   └── enemies.js         # Enemy archetypes and bosses
└── rendering/
    ├── Renderer.js         # Canvas wrapper + utility drawing methods
    ├── BattleScreen.js     # Battle layout
    ├── DungeonScreen.js    # Map layout and room click regions
    ├── PianoRenderer.js    # Piano keyboard strip + virtual key hit regions
    ├── TitleScreen.js      # Title screen
    └── OverlayScreens.js   # Room clear, shop, game over, victory
```

## Tuning Pitch Detection

Edit values in `src/config.js`:

```js
audio: {
  confidenceThreshold: 0.88,  // lower = more sensitive, more false positives
  stabilityFrames: 3,          // frames note must be stable (~50ms at 60fps)
}
```

If the mic isn't detecting your piano: lower `confidenceThreshold` to `0.80`.
If getting too many false triggers: raise to `0.92` or increase `stabilityFrames` to `5`.
