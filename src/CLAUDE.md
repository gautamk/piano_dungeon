# src/ — Entry Point & Configuration

## Files
| File | Role |
|---|---|
| `main.js` | Game entry: wires all modules, owns the game loop, handles all input |
| `config.js` | All tunable constants — change values here first before editing logic |

---

## main.js

**This is the only file allowed to:**
- Import and instantiate `AudioEngine`, `AudioSynth`, `StateMachine`, `Renderer`
- Register DOM event listeners (`canvas click`, `keydown`, `keyup`, `resize`)
- Call `requestAnimationFrame` — the loop lives here and nowhere else

**The game loop (`loop`)** must stay synchronous. Pattern:
```js
function loop(now) {
  const delta = Math.min(now - lastTime, 100); // cap at 100ms to survive tab backgrounding
  lastTime = now;
  audio.tick();       // update mic pitch detection
  sm.tick(delta);     // advance game state
  render(sm.state);   // draw current frame
  requestAnimationFrame(loop);
}
```

**Input handling rules:**
- Click coordinates must always be converted via `toLogicalCoords(e)` before any hit testing
- Piano key regions return `{ semitone, octave }` — pass both directly to `sm.triggerVirtualNote()`
- Keyboard piano keys use `KEY_NOTE_MAP`; guard with `heldKeys` to prevent key-repeat spam
- `handleTitleStart()` is the only async call in the input path — it initialises mic + synth

**Coordinate system:** All logical coordinates are 1280×720 regardless of display DPI or window size.
The canvas is CSS-scaled; `toLogicalCoords` undoes the scale transform before hit testing.

**Adding a new screen:**
1. Add a render branch in `render(state)`
2. Add click handling in the `canvas click` listener
3. Add any keyboard shortcuts in `keydown`
4. State transition lives in `StateMachine` — not here

---

## config.js

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
- Never hardcode a colour or timing value outside `config.js`
- Never import `config.js` inside `rendering/` directly from individual draw helpers — import it at the top of the renderer file and pass values down
- To tune challenge difficulty: adjust `GAME_CONFIG.timing.*` — do not touch `ChallengeEngine.js` first
- To tune audio sensitivity: adjust `GAME_CONFIG.audio.confidenceThreshold` and `stabilityFrames` before touching `PitchDetector.js`
