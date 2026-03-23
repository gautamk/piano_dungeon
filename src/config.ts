import type { GameConfig, PianoLayout, ColorPalette } from './types.js';

export const GAME_CONFIG: GameConfig = {
  canvas: { width: 1280, height: 720 },
  audio: {
    fftSize: 2048,
    confidenceThreshold: 0.88,
    stabilityFrames: 3,
  },
  player: {
    maxHp: 5,
    maxFloors: 10,
  },
  battle: {
    baseDamageToEnemy: 20,
    nearMissDamageToPlayer: 3,
    comboThresholds: [3, 5],
    comboMultipliers: [1.5, 2.0],
  },
  dungeon: {
    minRooms: 6,
    maxRooms: 9,
  },
  timing: {
    noteWindowMs: 4000,
    sequenceNoteWindowMs: 2500,
  },
};

// Piano strip layout — single source of truth for rendering and hit-testing.
// startOctave / numOctaves define the visible key range (C3–B4 by default).
export const PIANO_LAYOUT: PianoLayout = {
  x: 60,
  y: GAME_CONFIG.canvas.height - 120, // 600
  w: GAME_CONFIG.canvas.width - 120,  // 1160
  h: 90,
  startOctave: 3,
  numOctaves: 2,
};

// Badge colours for each challenge type — used in BattleScreen type badge.
// Add a new entry here when adding a new challenge type to ChallengeEngine.js.
export const CHALLENGE_TYPE_COLORS: Record<string, string> = {
  NOTE:     '#6366f1',
  INTERVAL: '#8b5cf6',
  SCALE:    '#0ea5e9',
  CHORD:    '#f59e0b',
  MELODY:   '#10b981',
};

export const COLORS: ColorPalette = {
  bg: '#0a0a0f',
  bgLight: '#12121a',
  surface: '#1a1a2e',
  border: '#2a2a4a',
  text: '#e8d5b7',
  textDim: '#8a7a6a',
  accent: '#f5c842',
  success: '#4ade80',
  danger: '#f87171',
  warning: '#fb923c',
  hp: '#ef4444',
  rooms: {
    COMBAT: '#7f1d1d',
    ELITE: '#4c1d95',
    SHOP: '#1e3a5f',
    REST: '#14532d',
    BOSS: '#78350f',
    PRACTICE: '#1a3a2a',
    CLEARED: '#1e1e2e',
    LOCKED: '#0f0f1a',
  },
  keys: {
    white: '#f0ebe0',
    black: '#1a1a1a',
    highlight: '#f5c842',
    playing: '#4ade80',
    wrong: '#f87171',
  },
};
