import * as ex from 'excalibur';
import { AudioEngine } from './audio/AudioEngine.js';
import { AudioSynth } from './audio/AudioSynth.js';
import { StateMachine } from './game/StateMachine.js';
import { Renderer } from './rendering/Renderer.js';
import { TitleScene } from './scenes/TitleScene.js';
import { DungeonMapScene } from './scenes/DungeonMapScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { FloorClearScene } from './scenes/FloorClearScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { PracticeScene } from './scenes/PracticeScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';

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

// ─── Scenes ───────────────────────────────────────────────────────────────────

const deps = { sm, audio, synth, renderer };

engine.addScene('title',       new TitleScene(deps));
engine.addScene('dungeon_map', new DungeonMapScene(deps));
engine.addScene('battle',      new BattleScene(deps));
engine.addScene('floor_clear', new FloorClearScene(deps));
engine.addScene('shop',        new ShopScene(deps));
engine.addScene('practice',    new PracticeScene(deps));
engine.addScene('game_over',   new GameOverScene(deps));
engine.addScene('victory',     new VictoryScene(deps));
engine.addScene('settings',    new SettingsScene(deps));

// ─── Start ────────────────────────────────────────────────────────────────────

engine.start().then(() => {
  engine.input.pointers.primary.once('down', () => { void synth.unlockContext(); });

  engine.input.keyboard.on('press', (evt) => {
    const screen = sm.state.screen;

    // Navigation keys — evt.key is ev.code e.g. ex.Keys.Enter
    if (evt.key === ex.Keys.Enter) {
      if (screen === 'ROOM_CLEAR') { sm.onContinueAfterRoomClear(); return; }
      if (screen === 'FLOOR_CLEAR') { sm.onNextFloor(); return; }
      if (screen === 'GAME_OVER' || screen === 'VICTORY') { sm.onRestartGame(); return; }
    }
    if (evt.key === ex.Keys.Escape) {
      if (screen === 'SHOP')     { sm.onLeaveShop(); return; }
      if (screen === 'PRACTICE') { sm.onLeavePractice(); return; }
      if (screen === 'SETTINGS') { sm.onCloseSettings(); return; }
    }

    // Piano keyboard shortcuts (battle only) — evt.value is ev.key e.g. 'a', 's'
    if (screen === 'BATTLE') {
      const key = evt.value?.toLowerCase() ?? '';
      const note = (KEY_NOTE_MAP as Record<string, { semitone: number; octave: number } | undefined>)[key];
      if (note) sm.triggerVirtualNote(note.semitone, note.octave);
    }
  });

  engine.goToScene('title');
});

// Debug hook — exposes game internals for preview/testing
declare global { interface Window { __game: { sm: StateMachine; audio: AudioEngine; synth: AudioSynth; engine: ex.Engine; startGame: () => void } } }
window.__game = { sm, audio, synth, engine, startGame: () => sm.onStartGame() };
