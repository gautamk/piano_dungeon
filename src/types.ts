// ─── Primitive union types ────────────────────────────────────────────────────

export type ChallengeType = 'NOTE' | 'INTERVAL' | 'SCALE' | 'CHORD' | 'MELODY';
export type EvaluationResult = 'SUCCESS' | 'FAIL' | 'NEAR_MISS' | 'PROGRESS';
export type RoomType = 'COMBAT' | 'ELITE' | 'SHOP' | 'REST' | 'BOSS' | 'PRACTICE';
export type BattlePhase = 'IDLE' | 'SHOWING' | 'WAITING' | 'RESULT';
export type InputMode = 'mic' | 'none';
export type Screen =
  | 'TITLE' | 'DUNGEON_MAP' | 'BATTLE' | 'ROOM_CLEAR'
  | 'FLOOR_CLEAR' | 'SHOP' | 'GAME_OVER' | 'VICTORY' | 'PRACTICE';

// ─── Music theory data ────────────────────────────────────────────────────────

export interface NoteReference {
  semitone: number;
  octave: number;
  name: string;
}

export interface Scale {
  name: string;
  intervals: number[];
  unlockFloor: number;
  description: string;
}

export interface Chord {
  name: string;
  intervals: number[];
  unlockFloor: number;
  symbol: string;
}

export interface Interval {
  name: string;
  semitones: number;
  abbr: string;
}

export interface SongNote {
  semitone: number;
  octave: number;
  durationMs: number;
}

export interface Song {
  id: string;
  title: string;
  composer: string;
  difficulty: number;
  phrases: SongNote[][];
}

// ─── Audio ────────────────────────────────────────────────────────────────────

/** Base note fields returned by midiToNote (no frequency/cents yet). */
export interface NoteBase {
  midi: number;
  semitone: number;
  octave: number;
  name: string;
}

/** Full detected note from mic pipeline (includes frequency and cents offset). */
export interface DetectedNote extends NoteBase {
  frequency: number;
  cents: number;
}

/** Note triggered by virtual piano click / keyboard shortcut. */
export interface VirtualNote extends NoteBase {
  frequency: null;
  cents: number;
  virtual: true;
}

/** Raw result from PitchDetector.detect(). */
export interface PitchResult {
  frequency: number | null;
  confidence: number;
  stable: boolean;
  midi?: number;
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

export interface ChallengeWeights {
  NOTE: number;
  INTERVAL: number;
  SCALE: number;
  CHORD: number;
  MELODY?: number;
}

/** Enemy archetype definition from enemies.js (raw data, no live HP). */
export interface EnemyArchetype {
  id: string;
  name: string;
  emoji: string;
  floorRange: [number, number];
  maxHp: number;
  attackPower: number;
  challengeWeights: ChallengeWeights;
  lore: string;
  elite?: boolean;
  song?: string;
}

/** Boss archetype — has a specific floor instead of a floor range. */
export interface BossArchetype {
  id: string;
  name: string;
  emoji: string;
  floor: number;
  maxHp: number;
  attackPower: number;
  challengeWeights: ChallengeWeights;
  lore: string;
  song?: string;
}

/**
 * Live enemy instance in a battle.
 * Created by spreading an EnemyArchetype + scaled HP/attack, or synthesised
 * for practice mode. Has currentHp tracked separately from maxHp.
 */
export interface Enemy {
  id?: string;
  name: string;
  emoji: string;
  lore: string;
  currentHp: number;
  maxHp: number;
  attackPower: number;
  challengeWeights: ChallengeWeights;
  song?: string;
  isPractice?: boolean;
  elite?: boolean;
}

// ─── Dungeon ──────────────────────────────────────────────────────────────────

export interface Room {
  type: RoomType;
  index: number;
  enemy: Enemy | null;
  cleared: boolean;
  reachable: boolean;
}

// ─── Challenges ───────────────────────────────────────────────────────────────

interface BaseChallenge {
  label: string;
  hint?: string;
  sequence: number[];
  progress: number;
  timeMs: number;
}

export interface NoteChallenge extends BaseChallenge {
  type: 'NOTE';
  targets: Array<{ semitone: number; octave: number }>;
}

export interface IntervalChallenge extends BaseChallenge {
  type: 'INTERVAL';
}

export interface ScaleChallenge extends BaseChallenge {
  type: 'SCALE';
}

export interface ChordChallenge extends BaseChallenge {
  type: 'CHORD';
  required: Set<number>;
  played: Set<number>;
}

export interface MelodyChallenge extends BaseChallenge {
  type: 'MELODY';
  song: Song;
  phraseIndex: number;
  octaves: number[];
}

export type Challenge =
  | NoteChallenge
  | IntervalChallenge
  | ScaleChallenge
  | ChordChallenge
  | MelodyChallenge;

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackMessage {
  text: string;
  x: number;
  y: number;
  color: string;
  ttl: number;
  vy: number;
}

// ─── Game state ───────────────────────────────────────────────────────────────

export interface PlayerState {
  hp: number;
  maxHp: number;
  score: number;
  floor: number;
  combo: number;
}

export interface DungeonState {
  rooms: Room[];
  currentIndex: number;
  runSeed: number;
}

export interface BattleState {
  enemy: Enemy | null;
  challenge: Challenge | null;
  phase: BattlePhase;
  lastResult: EvaluationResult | null;
  resultTimer: number;
  timerMs: number;
  consecutiveWrong: number;
  isPractice: boolean;
  melodyChallengePhrase: number;
}

export interface AudioState {
  note: DetectedNote | null;
  virtualNote: VirtualNote | null;
  rawFreq: number | null;
  inputMode: InputMode;
}

export interface PracticeState {
  songs: Song[];
  selectedSong: Song | null;
}

export interface GameState {
  screen: Screen;
  player: PlayerState;
  dungeon: DungeonState;
  battle: BattleState;
  practice: PracticeState;
  audio: AudioState;
  feedback: FeedbackMessage[];
  micDevices: MediaDeviceInfo[];
  micError: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GameConfig {
  canvas: { width: number; height: number };
  audio: { fftSize: number; confidenceThreshold: number; stabilityFrames: number };
  player: { maxHp: number; maxFloors: number };
  battle: {
    baseDamageToEnemy: number;
    nearMissDamageToPlayer: number;
    comboThresholds: number[];
    comboMultipliers: number[];
  };
  dungeon: { minRooms: number; maxRooms: number };
  timing: { noteWindowMs: number; sequenceNoteWindowMs: number };
}

export interface PianoLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  startOctave: number;
  numOctaves: number;
}

export interface ColorPalette {
  bg: string;
  bgLight: string;
  surface: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  hp: string;
  rooms: Record<string, string>;
  keys: {
    white: string;
    black: string;
    highlight: string;
    playing: string;
    wrong: string;
  };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

export interface KeyRegion {
  semitone: number;
  octave: number;
  isBlack: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomHitRegion extends HitRegion {
  room: Room;
  index: number;
}

export interface PracticeHitRegion extends HitRegion {
  songId: string;
}
