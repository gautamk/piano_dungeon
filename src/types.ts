// ─── Primitive union types ────────────────────────────────────────────────────

export type ChallengeType = 'NOTE' | 'INTERVAL' | 'SCALE' | 'CHORD' | 'MELODY';
export type EvaluationResult = 'SUCCESS' | 'FAIL' | 'NEAR_MISS' | 'PROGRESS';
export type RoomType = 'COMBAT' | 'ELITE' | 'SHOP' | 'REST' | 'BOSS' | 'PRACTICE';
export type BattlePhase = 'IDLE' | 'SHOWING' | 'WAITING' | 'RESULT';
export type InputMode = 'mic' | 'none';
export type Screen =
  | 'TITLE' | 'DUNGEON_MAP' | 'BATTLE' | 'ROOM_CLEAR'
  | 'FLOOR_CLEAR' | 'SHOP' | 'GAME_OVER' | 'VICTORY' | 'PRACTICE' | 'SETTINGS';

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
  /** Music theory teaching card shown after FAIL. Cleared on next challenge. */
  failTooltip: string | null;
  /** Semitone the player actually played on FAIL (for red key highlight). */
  lastWrongSemitone: number | null;
  /** Semitone the player should have played on FAIL (for green key highlight). */
  lastCorrectSemitone: number | null;
  /** Full-screen flash overlay driven by TTL (ms). Null when inactive. */
  screenFlash: { color: string; ttl: number; maxTtl: number } | null;
  /** TTL (ms) for enemy panel shake animation after a successful hit. */
  enemyShakeTtl: number;
  /** Most recently pressed piano key, kept alive for a short depress animation. */
  lastPlayedKey: { semitone: number; octave: number; ttl: number } | null;
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

export interface AppSettings {
  micEnabled: boolean;
  micDeviceId: string | null;
  outputDeviceId: string | null;
  micRebroadcast: boolean;
  showPianoLabels: boolean;
}

/** Persisted to localStorage so a run survives a browser refresh. */
export interface SavedRunState {
  runSeed: number;
  hp: number;
  floor: number;
  score: number;
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
  outputDevices: MediaDeviceInfo[];
  micError: string | null;
  settings: AppSettings;
  /** Non-null (0–100) while async audio init is in progress on the title screen. */
  loadingProgress: number | null;
  /** Populated from localStorage; shown as a Continue button on the title screen. */
  savedRun: SavedRunState | null;
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

// ─── Scene Activation Payloads ───────────────────────────────────────────────
// Passed as sceneActivationData when calling engine.goToScene().
// Each scene's onActivate receives the matching payload via context.data.

export interface TitleActivationData      { resetState: boolean }
export interface DungeonMapActivationData { generateFloor: boolean }
export interface BattleActivationData     { isPractice: boolean }
export interface PracticeActivationData   { songs: Song[] }
export type ShopActivationData        = Record<string, never>;
export type FloorClearActivationData  = Record<string, never>;
export type GameOverActivationData    = Record<string, never>;
export type VictoryActivationData     = Record<string, never>;
export type SettingsActivationData    = Record<string, never>;

export type SceneActivationData =
  | TitleActivationData | DungeonMapActivationData
  | BattleActivationData | PracticeActivationData
  | ShopActivationData | FloorClearActivationData
  | GameOverActivationData | VictoryActivationData
  | SettingsActivationData;

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
