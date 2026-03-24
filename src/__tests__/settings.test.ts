import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadSavedRun,
  saveRunState,
  clearSavedRun,
} from '../game/GameState.js';
import type { GameState } from '../types.js';

function makeMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

describe('loadSettings', () => {
  beforeEach(() => { (globalThis as unknown as Record<string, unknown>).localStorage = makeMockStorage(); });

  it('returns all defaults when nothing stored', () => {
    const s = loadSettings();
    expect(s.micEnabled).toBe(true);
    expect(s.micDeviceId).toBeNull();
    expect(s.outputDeviceId).toBeNull();
    expect(s.micRebroadcast).toBe(false);
    expect(s.showPianoLabels).toBe(true);
  });

  it('merges partial stored settings with defaults', () => {
    localStorage.setItem('pianoDungeonSettings', JSON.stringify({ micEnabled: false }));
    const s = loadSettings();
    expect(s.micEnabled).toBe(false);       // overridden
    expect(s.showPianoLabels).toBe(true);   // default preserved
    expect(s.micRebroadcast).toBe(false);   // default preserved
  });

  it('returns defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('pianoDungeonSettings', 'not-valid{{{');
    const s = loadSettings();
    expect(s.micEnabled).toBe(true);
    expect(s.showPianoLabels).toBe(true);
  });
});

describe('saveSettings + loadSettings', () => {
  beforeEach(() => { (globalThis as unknown as Record<string, unknown>).localStorage = makeMockStorage(); });

  it('round-trips all fields intact', () => {
    saveSettings({
      micEnabled: false,
      micDeviceId: 'device-123',
      outputDeviceId: 'output-456',
      micRebroadcast: true,
      showPianoLabels: false,
      midiDeviceId: 'midi-789',
    });
    const s = loadSettings();
    expect(s.micEnabled).toBe(false);
    expect(s.micDeviceId).toBe('device-123');
    expect(s.outputDeviceId).toBe('output-456');
    expect(s.micRebroadcast).toBe(true);
    expect(s.showPianoLabels).toBe(false);
    expect(s.midiDeviceId).toBe('midi-789');
  });
});

describe('run state persistence', () => {
  beforeEach(() => { (globalThis as unknown as Record<string, unknown>).localStorage = makeMockStorage(); });

  function makeState(overrides: { seed?: number; hp?: number; floor?: number; score?: number } = {}): GameState {
    return {
      dungeon: { runSeed: overrides.seed ?? 42, rooms: [], currentIndex: -1 },
      player: { hp: overrides.hp ?? 3, floor: overrides.floor ?? 5, score: overrides.score ?? 120, maxHp: 5, combo: 2 },
    } as unknown as GameState;
  }

  it('loadSavedRun() returns null when nothing stored', () => {
    expect(loadSavedRun()).toBeNull();
  });

  it('saveRunState() + loadSavedRun() round-trips all fields', () => {
    saveRunState(makeState({ seed: 42, hp: 3, floor: 5, score: 120 }));
    const result = loadSavedRun();
    expect(result).not.toBeNull();
    expect(result!.runSeed).toBe(42);
    expect(result!.hp).toBe(3);
    expect(result!.floor).toBe(5);
    expect(result!.score).toBe(120);
  });

  it('clearSavedRun() removes persisted run so loadSavedRun() returns null', () => {
    saveRunState(makeState());
    expect(loadSavedRun()).not.toBeNull();
    clearSavedRun();
    expect(loadSavedRun()).toBeNull();
  });
});
