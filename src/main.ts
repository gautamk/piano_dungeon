import * as ex from 'excalibur';
import type { GameState } from './types.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { AudioSynth } from './audio/AudioSynth.js';
import { StateMachine } from './game/StateMachine.js';
import { Renderer } from './rendering/Renderer.js';
import { renderTitleScreen, getStartButtonRegion } from './rendering/TitleScreen.js';
import { renderDungeonScreen, getRoomHitRegions } from './rendering/DungeonScreen.js';
import { renderBattleScreen, PIANO_LAYOUT } from './rendering/BattleScreen.js';
import { getPianoKeyRegions } from './rendering/PianoRenderer.js';
import {
  renderRoomClearScreen,
  renderFloorClearScreen,
  renderShopScreen,
  renderGameOverScreen,
  renderVictoryScreen,
  renderPracticeScreen,
  getShopHitRegions,
  getRestartButtonRegion,
  getFloorClearButtonRegion,
  getPracticeHitRegions,
} from './rendering/OverlayScreens.js';

// ─── Engine ───────────────────────────────────────────────────────────────────

const engine = new ex.Engine({
  canvasElementId: 'game',
  width: 1280,
  height: 720,
  displayMode: ex.DisplayMode.FitScreen,
  suppressPlayButton: true,
  backgroundColor: ex.Color.fromHex('#0a0a0f'),
});

// ─── Game objects ─────────────────────────────────────────────────────────────

const audio = new AudioEngine();
const synth = new AudioSynth();
const sm = new StateMachine(audio, synth);
// Excalibur uses WebGL by default; getContext('2d') on engine.canvas returns null.
// Use a detached canvas for Renderer init — ctx gets swapped to ex.Canvas offscreen ctx each frame.
const _dummyCanvas = document.createElement('canvas');
const renderer = new Renderer(_dummyCanvas);

// PIANO_LAYOUT is imported from BattleScreen.js — single source of truth for hit testing

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

const canvas = engine.canvas;

function toLogicalCoords(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = 1280 / rect.width;
  const scaleY = 720 / rect.height;
  const anyE = e as MouseEvent & { touches?: { clientX: number; clientY: number }[] };
  const clientX = anyE.touches ? anyE.touches[0].clientX : anyE.clientX;
  const clientY = anyE.touches ? anyE.touches[0].clientY : anyE.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function hitTest(pos: { x: number; y: number }, region: { x: number; y: number; w: number; h: number }): boolean {
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
  await synth.start(); // initialize Tone.js output (requires user gesture)
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
    if (screen === 'BATTLE' && hitTest(pos, PIANO_LAYOUT)) {
      const regions = getPianoKeyRegions(PIANO_LAYOUT.x, PIANO_LAYOUT.y, PIANO_LAYOUT.w, PIANO_LAYOUT.h);
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

  if (screen === 'PRACTICE') {
    const songs = sm.state.practice?.songs ?? [];
    for (const r of getPracticeHitRegions(songs)) {
      if (hitTest(pos, r)) {
        sm.onSelectPracticeSong(r.songId);
        return;
      }
    }
    return;
  }
});

// ─── Keyboard input ───────────────────────────────────────────────────────────

const heldKeys = new Set<string>(); // prevent key repeat for piano keys

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
  if (e.key === 'Escape' && screen === 'PRACTICE') { sm.onLeavePractice(); return; }

  // Piano keyboard shortcuts (during battle or practice play, ignore held keys)
  if (screen === 'BATTLE' && !e.repeat) {
    const key = e.key.toLowerCase();
    const note = (KEY_NOTE_MAP as Record<string, { semitone: number; octave: number } | undefined>)[key];
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

function render(state: GameState): void {
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
    case 'PRACTICE':  renderPracticeScreen(renderer, state); break;
    case 'GAME_OVER': renderGameOverScreen(renderer, state); break;
    case 'VICTORY':   renderVictoryScreen(renderer, state); break;
  }
}

// ─── Legacy bridge ────────────────────────────────────────────────────────────

class LegacyActor extends ex.Actor {
  constructor() {
    super({ x: 0, y: 0, anchor: ex.Vector.Zero });
    const legacyCanvas = new ex.Canvas({
      width: 1280,
      height: 720,
      cache: false, // redraw every frame
      draw: (ctx) => {
        renderer.ctx = ctx; // swap to offscreen ctx each frame (no dpr scale needed)
        render(sm.state);
      },
    });
    this.graphics.use(legacyCanvas);
  }

  onPreUpdate(_engine: ex.Engine, deltaMs: number): void {
    audio.tick();
    sm.tick(deltaMs);
  }
}

class LegacyScene extends ex.Scene {}

const legacyScene = new LegacyScene();
legacyScene.add(new LegacyActor());
engine.addScene('legacy', legacyScene);
engine.goToScene('legacy');

// ─── Start ────────────────────────────────────────────────────────────────────

engine.start();

// Debug hook — exposes game internals for preview/testing
declare global { interface Window { __game: { sm: StateMachine; audio: AudioEngine; synth: AudioSynth; engine: ex.Engine; startGame: () => void } } }
window.__game = { sm, audio, synth, engine, startGame: () => sm.onStartGame() };
