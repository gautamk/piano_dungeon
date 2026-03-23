export const GAME_CONFIG = {
  canvas: { width: 1280, height: 720 },
  audio: {
    fftSize: 2048,
    confidenceThreshold: 0.88,
    stabilityFrames: 3,
    noteToleranceSemitones: 0, // must be exact semitone match
  },
  player: {
    maxHp: 5,
    maxFloors: 10,
  },
  battle: {
    baseDamageToEnemy: 20,
    critDamageToEnemy: 35,
    baseDamageToPlayer: 10,
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

export const COLORS = {
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
