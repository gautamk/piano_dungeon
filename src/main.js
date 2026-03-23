import { AudioEngine } from './audio/AudioEngine.js';
import { StateMachine } from './game/StateMachine.js';
import { Renderer } from './rendering/Renderer.js';
import { renderTitleScreen, getStartButtonRegion } from './rendering/TitleScreen.js';
import { renderDungeonScreen, getRoomHitRegions } from './rendering/DungeonScreen.js';
import { renderBattleScreen } from './rendering/BattleScreen.js';
import { getPianoKeyRegions, PIANO_START_OCTAVE, PIANO_NUM_OCTAVES } from './rendering/PianoRenderer.js';
import {
  renderRoomClearScreen,
  renderFloorClearScreen,
  renderShopScreen,
  renderGameOverScreen,
  renderVictoryScreen,
  getShopHitRegions,
  getRestartButtonRegion,
  getFloorClearButtonRegion,
} from './rendering/OverlayScreens.js';
import { GAME_CONFIG } from './config.js';

// ─── Init ─────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game');
const audio = new AudioEngine();
const sm = new StateMachine(audio);
const renderer = new Renderer(canvas);

// Scale canvas to fill window (letterboxed)
function resizeCanvas() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'top left';
  canvas.style.position = 'absolute';
  canvas.style.left = `${(window.innerWidth - 1280 * scale) / 2}px`;
  canvas.style.top = `${(window.innerHeight - 720 * scale) / 2}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── Piano strip layout (must match BattleScreen.js) ─────────────────────────

const PIANO_X = 60;
const PIANO_Y = GAME_CONFIG.canvas.height - 120;
const PIANO_W = GAME_CONFIG.canvas.width - 120;
const PIANO_H = 90;

// ─── Keyboard → virtual piano mapping ────────────────────────────────────────
// Standard QWERTY piano layout (C4 octave on home row)
const KEY_NOTE_MAP = {
  // White keys: A S D F G H J K = C D E F G A B C(5)
  a: { semitone: 0, octave: 4 }, // C4
  s: { semitone: 2, octave: 4 }, // D4
  d: { semitone: 4, octave: 4 }, // E4
  f: { semitone: 5, octave: 4 }, // F4
  g: { semitone: 7, octave: 4 }, // G4
  h: { semitone: 9, octave: 4 }, // A4
  j: { semitone: 11, octave: 4 }, // B4
  k: { semitone: 0, octave: 5 }, // C5
  // Black keys: W E T Y U = C# D# F# G# A#
  w: { semitone: 1, octave: 4 }, // C#4
  e: { semitone: 3, octave: 4 }, // D#4
  t: { semitone: 6, octave: 4 }, // F#4
  y: { semitone: 8, octave: 4 }, // G#4
  u: { semitone: 10, octave: 4 }, // A#4
  // Lower octave: Z X C V B N M = C D E F G A B (C3)
  z: { semitone: 0, octave: 3 },
  x: { semitone: 2, octave: 3 },
  c: { semitone: 4, octave: 3 },
  v: { semitone: 5, octave: 3 },
  b: { semitone: 7, octave: 3 },
  n: { semitone: 9, octave: 3 },
  m: { semitone: 11, octave: 3 },
};

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function toLogicalCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = 1280 / rect.width;
  const scaleY = 720 / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function hitTest(pos, region) {
  return pos.x >= region.x && pos.x <= region.x + region.w
      && pos.y >= region.y && pos.y <= region.y + region.h;
}

// ─── Mic start (non-blocking — game works without mic) ────────────────────────

async function startMic() {
  const ok = await audio.start();
  sm.state.audio.inputMode = audio.inputMode;
  if (!ok) {
    sm.state.micError = 'Mic not available — using virtual piano. Click keys or use A-S-D-F-G-H-J.';
  }
}

async function handleTitleStart() {
  sm.state.micError = null;
  await startMic(); // always attempt; game starts regardless of outcome
  sm.onStartGame();
}

// ─── Click input ──────────────────────────────────────────────────────────────

canvas.addEventListener('click', async (e) => {
  const pos = toLogicalCoords(e);
  const screen = sm.state.screen;

  if (screen === 'TITLE') {
    if (hitTest(pos, getStartButtonRegion())) await handleTitleStart();
    return;
  }

  if (screen === 'DUNGEON_MAP') {
    const regions = getRoomHitRegions(sm.state.dungeon.rooms);
    for (const r of regions) {
      if (hitTest(pos, r) && r.room.reachable && !r.room.cleared) {
        sm.onEnterRoom(r.index);
        return;
      }
    }
    return;
  }

  if (screen === 'BATTLE' || screen === 'ROOM_CLEAR') {
    // Check if click is on the piano strip (only act in BATTLE phase)
    if (screen === 'BATTLE' && hitTest(pos, { x: PIANO_X, y: PIANO_Y, w: PIANO_W, h: PIANO_H })) {
      const regions = getPianoKeyRegions(PIANO_X, PIANO_Y, PIANO_W, PIANO_H);
      // Test black keys first (on top), then white keys
      for (const key of regions) {
        if (hitTest(pos, key)) {
          sm.triggerVirtualNote(key.semitone, key.octave);
          return;
        }
      }
    }
    if (screen === 'ROOM_CLEAR') sm.onContinueAfterRoomClear();
    return;
  }

  if (screen === 'FLOOR_CLEAR') {
    if (hitTest(pos, getFloorClearButtonRegion())) sm.onNextFloor();
    return;
  }

  if (screen === 'SHOP') {
    const { buyHp, leave } = getShopHitRegions();
    if (hitTest(pos, buyHp)) sm.onBuyHp();
    if (hitTest(pos, leave)) sm.onLeaveShop();
    return;
  }

  if (screen === 'GAME_OVER' || screen === 'VICTORY') {
    if (hitTest(pos, getRestartButtonRegion())) sm.onRestartGame();
    return;
  }
});

// ─── Keyboard input ───────────────────────────────────────────────────────────

const heldKeys = new Set(); // prevent key repeat for piano keys

document.addEventListener('keydown', async (e) => {
  const screen = sm.state.screen;

  // Navigation keys
  if (e.key === 'Enter') {
    if (screen === 'TITLE') { await handleTitleStart(); return; }
    if (screen === 'ROOM_CLEAR') { sm.onContinueAfterRoomClear(); return; }
    if (screen === 'FLOOR_CLEAR') { sm.onNextFloor(); return; }
    if (screen === 'GAME_OVER' || screen === 'VICTORY') { sm.onRestartGame(); return; }
  }
  if (e.key === 'Escape' && screen === 'SHOP') { sm.onLeaveShop(); return; }

  // Piano keyboard shortcuts (only during battle, ignore held keys)
  if (screen === 'BATTLE' && !e.repeat) {
    const key = e.key.toLowerCase();
    const note = KEY_NOTE_MAP[key];
    if (note && !heldKeys.has(key)) {
      heldKeys.add(key);
      sm.triggerVirtualNote(note.semitone, note.octave);
    }
  }
});

document.addEventListener('keyup', (e) => {
  heldKeys.delete(e.key.toLowerCase());
});

// ─── Render ───────────────────────────────────────────────────────────────────

function render(state) {
  switch (state.screen) {
    case 'TITLE':      renderTitleScreen(renderer, state); break;
    case 'DUNGEON_MAP':
      renderDungeonScreen(renderer, state);
      renderer.renderFeedback(state.feedback);
      break;
    case 'BATTLE':
      renderBattleScreen(renderer, state);
      renderer.renderFeedback(state.feedback);
      break;
    case 'ROOM_CLEAR':
      renderBattleScreen(renderer, state);
      renderRoomClearScreen(renderer, state);
      break;
    case 'FLOOR_CLEAR': renderFloorClearScreen(renderer, state); break;
    case 'SHOP':
      renderShopScreen(renderer, state);
      renderer.renderFeedback(state.feedback);
      break;
    case 'GAME_OVER': renderGameOverScreen(renderer, state); break;
    case 'VICTORY':   renderVictoryScreen(renderer, state); break;
  }
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

let lastTime = 0;

function loop(now) {
  const delta = Math.min(now - lastTime, 100);
  lastTime = now;

  audio.tick();
  sm.tick(delta);
  render(sm.state);

  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => { lastTime = now; requestAnimationFrame(loop); });
