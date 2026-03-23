# src/rendering/ — Canvas Renderers

## Files
| File | Role |
|---|---|
| `Renderer.ts` | Canvas wrapper: DPI scaling, utility draw methods |
| `BattleScreen.ts` | Battle layout: enemy panel, player panel, challenge area, piano strip |
| `DungeonScreen.ts` | Dungeon map: room tiles, floor theme, click hit regions |
| `PianoRenderer.ts` | Piano keyboard strip: layout, hit regions, key highlighting |
| `TitleScreen.ts` | Title + mic setup screen |
| `OverlayScreens.ts` | Room clear, floor clear, shop, game over, victory overlays |

---

## Core contract

**All render functions are pure:** `(renderer: Renderer, state: GameState) => void`
- Read from `state`, draw to canvas — nothing else
- No imports of `GameState.ts`
- No writes to state
- No calls to `sm.go()` or any StateMachine methods
- No `setTimeout`, `setInterval`, or `requestAnimationFrame`

---

## Renderer (canvas wrapper)

### Coordinate system
- Logical canvas: **1280 × 720** regardless of device DPI
- `Renderer._resize()` applies `devicePixelRatio` scaling internally — draw at logical coords always
- **With Excalibur:** `renderer.ctx` is swapped to the `ex.Canvas` offscreen ctx each frame in `LegacyActor.draw`. The offscreen ctx is already at 1:1 scale (no DPR transform needed). `Renderer` must be initialised with a detached canvas (`document.createElement('canvas')`), not `engine.canvas` (which is WebGL).

### Utility methods
| Method | Use for |
|---|---|
| `renderer.clear()` | Fill background at frame start |
| `renderer.text(str, x, y, opts)` | Any text label |
| `renderer.centeredText(str, y, opts)` | Horizontally centred text |
| `renderer.rect(x, y, w, h, color, radius?)` | Filled rectangle or rounded rect |
| `renderer.rectStroke(x, y, w, h, color, lw, radius?)` | Outlined rectangle |
| `renderer.line(x1, y1, x2, y2, color, lw?)` | Single line |
| `renderer.bar(x, y, w, h, value, max, fillColor, bgColor?, radius?)` | HP / timer progress bar |
| `renderer.renderFeedback(feedback[])` | Floating damage numbers and popups |

`renderer.ctx` is the raw `CanvasRenderingContext2D` — use directly for arcs, emoji, or anything not covered by helpers.

**Extending `Renderer`:** Add a method only if it will be used in ≥ 2 renderer files. Otherwise draw inline.

---

## BattleScreen

### Layout regions (logical pixels)
```
Enemy panel:     x:40    y:40    w:320  h:200
Player panel:    x:960   y:40    w:220  h:120
Challenge area:  cx:640  y:260   w:600  h:280  (centred)
Melody roll:     x:60    y:544   w:1160 h:48   (MELODY challenges only)
Piano strip:     x:60    y:600   w:1160 h:90
Floor label:     cx:640  y:18
```

**Piano strip coordinates** must match `PIANO_LAYOUT` in `config.ts` — single source of truth imported by both `BattleScreen.ts` and `main.ts`.

### Challenge type badge colours
Defined in `CHALLENGE_TYPE_COLORS` in `config.ts`:
```ts
{ NOTE: '#6366f1', INTERVAL: '#8b5cf6', SCALE: '#0ea5e9', CHORD: '#f59e0b', MELODY: '#10b981' }
```
Add a new entry there when adding a new challenge type.

### Sequence progress dots
`renderSequenceProgress` draws one dot per `challenge.sequence` entry. CHORD challenges use `challenge.played` to determine completion; others use `challenge.progress`.

---

## DungeonScreen

### `renderDungeonScreen(renderer, state)`
Draws the room row, floor title, HP hearts, and score.

### `getRoomHitRegions(rooms)` → `RoomHitRegion[]`
Returns click targets for each room tile. Each region includes the room reference:
```ts
{ x, y, w, h, room: Room, index: number }
```
`main.ts` iterates these to handle room entry clicks.

### Floor themes (`floorTheme(floor)`) → `string`
Returns the theme name string for the current floor. Add new entries here for additional floors.

**Room tile layout:** Rooms are arranged in a single horizontal row centred on the canvas. Gap between tiles is fixed. Do not reflow to multiple rows without also updating `getRoomHitRegions`.

---

## PianoRenderer

### `getPianoKeyRegions(x, y, width, height)` → `KeyRegion[]`
Returns hit regions for all keys (black keys first — they sit on top visually and must be tested first):
```ts
{ semitone: number, octave: number, isBlack: boolean, x: number, y: number, w: number, h: number }
```

### `renderPianoStrip(renderer, { audioNote, virtualNote, challenge, x, y, width, height, inputMode })`
Key highlight priority:
1. Active note (mic or virtual) — green (mic) or lime (virtual)
2. Challenge target(s) — amber/gold
3. Default — white or black

`audioNote` takes visual priority over `virtualNote` when both are present (mic player sees their real input). For note evaluation, virtual notes take priority in `StateMachine._tickBattle()`.

**Octave range:** `PIANO_START_OCTAVE = 3`, `PIANO_NUM_OCTAVES = 2` → C3–B4. Expanding the range requires updating both layout calculations and `KEY_NOTE_MAP` in `main.ts`.

---

## TitleScreen

### `renderTitleScreen(renderer, state)`
Draws logo, feature list, mic status, and Start button.

### `getStartButtonRegion()` → `HitRegion`
Returns the hit region for the Start button. Used in `main.ts` for click handling.

**Mic status line:** Shows `state.micError` if set (warning), or "Virtual piano (no mic)" if `inputMode === 'none'`.

---

## OverlayScreens

Full-screen overlays drawn on top of the previous screen or standalone.

| Function | Screen | Notes |
|---|---|---|
| `renderRoomClearScreen` | ROOM_CLEAR | Drawn over `renderBattleScreen` |
| `renderFloorClearScreen` | FLOOR_CLEAR | Standalone |
| `renderShopScreen` | SHOP | Standalone |
| `renderGameOverScreen` | GAME_OVER | Standalone |
| `renderVictoryScreen` | VICTORY | Standalone |
| `renderPracticeScreen` | PRACTICE | Song selection list |

### Hit regions
| Function | Returns |
|---|---|
| `getShopHitRegions()` | `{ buyHp: HitRegion; leave: HitRegion }` |
| `getRestartButtonRegion()` | Used on GAME_OVER and VICTORY screens |
| `getFloorClearButtonRegion()` | Used on FLOOR_CLEAR screen |
| `getPracticeHitRegions(songs)` | `PracticeHitRegion[]` (includes `songId`) |

**Adding a new overlay screen:**
1. Add `renderXxxScreen(renderer: Renderer, state: GameState)` here
2. Add `getXxxHitRegion()` if it has interactive buttons
3. Wire both into `main.ts` render switch and click handler
4. Add the transition in `StateMachine`
