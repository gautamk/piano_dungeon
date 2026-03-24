import type {
  GameState, Screen, Enemy, Challenge, VirtualNote, EvaluationResult,
  SceneActivationData,
} from '../types.js';
import { GAME_CONFIG, COLORS } from '../config.js';
import {
  createGameState, damagePlayer, healPlayer, scoreHit, spawnFeedback, tickFeedback,
  tickBattleFx, saveRunState, clearSavedRun,
} from './GameState.js';
import { unlockNextRoom, ROOM_TYPE } from './DungeonGenerator.js';
import {
  generateChallenge,
  generateMelodyChallenge,
  pickChallengeType,
  evaluateNote,
  computeEnemyDamage,
  getTheoryTooltip,
  CHALLENGE_TYPE,
} from './ChallengeEngine.js';
import { NOTE_NAMES } from '../data/music.js';
import { SONGS, SONGS_LIST } from '../data/songs.js';
import type { AudioEngine } from '../audio/AudioEngine.js';
import type { AudioSynth } from '../audio/AudioSynth.js';

const RESULT_SHOW_MS = 900;

export class StateMachine {
  audio: AudioEngine;
  synth: AudioSynth | null;
  state: GameState;

  // FIFO queue of virtual notes (set by triggerVirtualNote, drained one-per-tick)
  // Using a queue instead of a single slot prevents fast keypresses from overwriting
  // each other before _tickBattle can consume them.
  _virtualNoteQueue: VirtualNote[];

  // After a virtual note is consumed, suppress mic evaluation for this many ms.
  // Prevents speaker bleed / harmonics from auto-advancing multi-note challenges.
  _micEvalCooldownMs: number;

  // Prevent double-triggering the same MIDI within one challenge phase
  _lastActedMidi: number | null;

  // Registered by the active GameScene; called immediately when go() fires a screen transition.
  // Cleared on scene deactivate to avoid stale references between scenes.
  private _transitionCallback: ((screen: Screen, data: SceneActivationData) => void) | null = null;

  constructor(audioEngine: AudioEngine, audioSynth: AudioSynth | null) {
    this.audio = audioEngine;
    this.synth = audioSynth ?? null;
    this.state = createGameState();

    this._virtualNoteQueue = [];
    this._micEvalCooldownMs = 0;
    this._lastActedMidi = null;
  }

  // ─── Virtual Piano Input ────────────────────────────────────────────────────

  /**
   * Called when the player clicks a virtual piano key or presses a keyboard shortcut.
   * The note is consumed on the next tick() call.
   */
  triggerVirtualNote(semitone: number, octave: number): void {
    const name = NOTE_NAMES[semitone];
    const midi = (octave + 1) * 12 + semitone;
    const vNote: VirtualNote = { semitone, octave, name, midi, frequency: null, cents: 0, virtual: true };
    // Cap queue at 4 to avoid unbounded growth from button-mashing
    if (this._virtualNoteQueue.length < 4) this._virtualNoteQueue.push(vNote);
    // Update display note immediately so the piano strip lights up
    this.state.audio.virtualNote = vNote;
    // Drive key depress animation
    this.state.battle.lastPlayedKey = { semitone, octave, ttl: 200 };
    // Play the note through speakers
    this.synth?.playNote(semitone, octave);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  tick(deltaMs: number): void {
    // Sync audio state
    this.state.audio.note = this.audio.currentNote;
    this.state.audio.rawFreq = this.audio.rawFrequency;
    this.state.audio.inputMode = this.audio.inputMode;

    tickFeedback(this.state, deltaMs);
    tickBattleFx(this.state, deltaMs);
    this._tickScreen(deltaMs);
  }

  setTransitionCallback(fn: (screen: Screen, data: SceneActivationData) => void): void {
    this._transitionCallback = fn;
  }

  clearTransitionCallback(): void {
    this._transitionCallback = null;
  }

  private go(screen: Screen, data: SceneActivationData): void {
    this.state.screen = screen;
    this._transitionCallback?.(screen, data);
  }

  // ─── Per-Screen Tick ────────────────────────────────────────────────────────

  private _tickScreen(deltaMs: number): void {
    if (this.state.screen === 'BATTLE') this._tickBattle(deltaMs);
  }

  // ─── Battle Logic ───────────────────────────────────────────────────────────

  startBattle(): void {
    const s = this.state;
    const room = s.dungeon.rooms[s.dungeon.currentIndex];
    if (!room?.enemy) return;

    s.battle.enemy = room.enemy;
    s.battle.phase = 'SHOWING';
    s.battle.lastResult = null;
    s.battle.resultTimer = 0;
    s.battle.consecutiveWrong = 0;
    // melodyChallengePhrase is reset by onSelectPracticeSong; for bosses it cycles freely
    if (!s.battle.isPractice) s.battle.melodyChallengePhrase = 0;
    this._newChallenge();
  }

  private _newChallenge(): void {
    const s = this.state;
    if (!s.battle.enemy) return;
    const type = pickChallengeType(s.battle.enemy, s.player.floor);

    if (type === CHALLENGE_TYPE.MELODY) {
      const song = s.battle.enemy.song ? SONGS[s.battle.enemy.song] : undefined;
      if (song) {
        const phrase = s.battle.melodyChallengePhrase;
        s.battle.melodyChallengePhrase = (phrase + 1) % song.phrases.length;
        s.battle.challenge = generateMelodyChallenge(song, phrase);
      } else {
        s.battle.challenge = generateChallenge(CHALLENGE_TYPE.NOTE, s.player.floor);
      }
    } else {
      s.battle.challenge = generateChallenge(type, s.player.floor);
    }

    s.battle.timerMs = s.battle.challenge.timeMs;
    s.battle.phase = 'WAITING';
    s.battle.lastResult = null;
    s.battle.failTooltip = null;
    s.battle.lastWrongSemitone = null;
    s.battle.lastCorrectSemitone = null;
    // Do NOT reset _lastActedMidi here — the previous note may still be ringing
    // through speakers into the mic. Keeping the last midi prevents it from
    // instantly triggering the new challenge. Virtual keypresses bypass this
    // guard regardless.
  }

  private _tickBattle(deltaMs: number): void {
    const s = this.state;
    const { battle } = s;

    if (battle.phase === 'RESULT') {
      battle.resultTimer -= deltaMs;
      if (battle.resultTimer <= 0) {
        if (battle.lastResult === 'SUCCESS' && battle.enemy && battle.enemy.currentHp <= 0) {
          this._clearRoom();
        } else if (s.player.hp <= 0) {
          clearSavedRun();
          s.savedRun = null;
          this.go('GAME_OVER', {});
        } else {
          this._newChallenge();
        }
      }
      return;
    }

    if (battle.phase !== 'WAITING') return;

    // Tick down the post-virtual mic suppression window
    if (this._micEvalCooldownMs > 0) this._micEvalCooldownMs -= deltaMs;

    battle.timerMs -= deltaMs;

    // Drain one virtual note from the queue per tick (explicit user intent — always evaluate).
    // Mic notes are evaluated only when: (a) no virtual note is pending, (b) the mic cooldown
    // has elapsed (prevents speaker bleed / harmonics from auto-advancing multi-note challenges),
    // and (c) the MIDI differs from the last acted note (prevents sustain re-triggering).
    const vNote = this._virtualNoteQueue.shift() ?? null;
    const isVirtual = !!vNote;

    // Clear the display once the queue is fully drained
    if (!isVirtual && this._virtualNoteQueue.length === 0) {
      this.state.audio.virtualNote = null;
    }

    const note = vNote ?? (this._micEvalCooldownMs > 0 ? null : s.audio.note);

    if (note && (isVirtual || note.midi !== this._lastActedMidi)) {
      this._lastActedMidi = note.midi;
      if (isVirtual) {
        // Start cooldown so mic input can't race the next sequence position
        this._micEvalCooldownMs = 300;
      }
      this._evaluateChallengeNote(note);
      return;
    }

    if (battle.timerMs <= 0) this._onChallengeTimeout();
  }

  private _evaluateChallengeNote(note: { semitone: number; midi?: number }): void {
    const s = this.state;
    const { battle } = s;
    // Capture expected semitone before evaluateNote may reset challenge.progress on FAIL
    const ch = battle.challenge;
    const expectedSemitone: number | null = (() => {
      if (!ch) return null;
      if (ch.type === 'CHORD') {
        return [...ch.required].find(r => !ch.played.has(r)) ?? null;
      }
      return ch.sequence[ch.progress] ?? null;
    })();
    const result = evaluateNote(battle.challenge, note);
    if (result === null) return;

    const cx = 640, cy = 320;

    if (result === 'PROGRESS') {
      spawnFeedback(s, `✓ ${(note as { name?: string }).name ?? ''}`, cx, cy - 80, COLORS.success);
      return;
    }

    if (result === 'SUCCESS') {
      if (!battle.enemy) return;
      const dmg = computeEnemyDamage(s);
      battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - dmg);
      scoreHit(s, dmg);
      battle.consecutiveWrong = 0;
      battle.enemyShakeTtl = 400;
      const comboText = s.player.combo >= 5 ? ' COMBO x2!' : s.player.combo >= 3 ? ' COMBO x1.5!' : '';
      spawnFeedback(s, `PERFECT! -${dmg}${comboText}`, cx, cy - 60, COLORS.success);
      this._endChallenge(battle, 'SUCCESS');
      return;
    }

    if (result === 'NEAR_MISS') {
      if (battle.enemy?.isPractice) {
        spawnFeedback(s, 'Close! Try again.', cx, cy - 60, COLORS.warning);
        return; // no damage in practice
      }
      const dmg = GAME_CONFIG.battle.nearMissDamageToPlayer;
      damagePlayer(s, dmg);
      spawnFeedback(s, `Close! -${dmg} HP`, cx, cy - 60, COLORS.warning);
      battle.lastResult = 'NEAR_MISS';
      return;
    }

    if (result === 'FAIL') {
      battle.lastWrongSemitone = note.semitone;
      battle.lastCorrectSemitone = expectedSemitone;
      if (battle.enemy?.isPractice) {
        // Reset timer and let them try again — stay in WAITING so same challenge continues
        battle.timerMs = battle.challenge?.timeMs ?? 10000;
        battle.lastResult = 'FAIL';
        if (battle.challenge) battle.failTooltip = getTheoryTooltip(battle.challenge);
        spawnFeedback(s, 'Wrong note — try again!', cx, cy - 60, COLORS.warning);
        return;
      }
      if (!battle.enemy) return;
      const dmg = battle.enemy.attackPower;
      damagePlayer(s, dmg);
      battle.consecutiveWrong++;
      battle.screenFlash = { color: 'rgba(248,113,113,0.45)', ttl: 350, maxTtl: 350 };
      spawnFeedback(s, `WRONG! -${dmg} HP`, cx, cy - 60, COLORS.danger);
      this._endChallenge(battle, 'FAIL');
    }
  }

  /** Set battle into RESULT phase with the given outcome. */
  private _endChallenge(battle: GameState['battle'], result: EvaluationResult): void {
    battle.lastResult = result;
    battle.phase = 'RESULT';
    battle.resultTimer = RESULT_SHOW_MS;
    if (result === 'FAIL' && battle.challenge) {
      battle.failTooltip = getTheoryTooltip(battle.challenge);
    }
  }

  private _onChallengeTimeout(): void {
    const s = this.state;
    if (s.battle.enemy?.isPractice) {
      // Reset challenge and try again — no HP damage
      if (s.battle.challenge) s.battle.challenge.progress = 0;
      s.battle.timerMs = s.battle.challenge?.timeMs ?? 10000;
      spawnFeedback(s, "Time's up — try again!", 640, 300, COLORS.warning);
      return;
    }
    if (!s.battle.enemy) return;
    const dmg = s.battle.enemy.attackPower;
    damagePlayer(s, dmg);
    spawnFeedback(s, `TIME! -${dmg} HP`, 640, 300, COLORS.danger);
    this._endChallenge(s.battle, 'FAIL');
  }

  private _clearRoom(): void {
    const s = this.state;
    const room = s.dungeon.rooms[s.dungeon.currentIndex];
    room.cleared = true;
    unlockNextRoom(s.dungeon.rooms, s.dungeon.currentIndex);

    if (room.type === ROOM_TYPE.BOSS) {
      if (s.player.floor >= GAME_CONFIG.player.maxFloors) {
        clearSavedRun();
        s.savedRun = null;
        this.go('VICTORY', {});
      } else {
        saveRunState(s);
        s.savedRun = { runSeed: s.dungeon.runSeed, hp: s.player.hp, floor: s.player.floor, score: s.player.score };
        this.go('FLOOR_CLEAR', {});
      }
      return;
    }
    this.go('ROOM_CLEAR', {});
  }

  // ─── Action Handlers ────────────────────────────────────────────────────────

  onStartGame(): void {
    this.state.loadingProgress = null;
    this.state.micDevices = this.audio.devices;
    this.state.audio.inputMode = this.audio.inputMode;
    this.go('DUNGEON_MAP', { generateFloor: true });
  }

  onContinueRun(): void {
    const saved = this.state.savedRun;
    if (!saved) return;
    this.state.player.hp = saved.hp;
    this.state.player.floor = saved.floor;
    this.state.player.score = saved.score;
    this.state.dungeon.runSeed = saved.runSeed;
    this.state.dungeon.currentIndex = -1;
    clearSavedRun();
    this.state.savedRun = null;
    this.go('DUNGEON_MAP', { generateFloor: true });
  }

  onEnterRoom(roomIndex: number): void {
    const room = this.state.dungeon.rooms[roomIndex];
    if (!room || room.cleared || !room.reachable) return;
    this.state.dungeon.currentIndex = roomIndex;

    if (room.type === ROOM_TYPE.REST) {
      healPlayer(this.state, 2);
      room.cleared = true;
      unlockNextRoom(this.state.dungeon.rooms, roomIndex);
      spawnFeedback(this.state, 'Rested. +2 HP', 640, 360, COLORS.success);
      saveRunState(this.state);
      this.state.savedRun = { runSeed: this.state.dungeon.runSeed, hp: this.state.player.hp, floor: this.state.player.floor, score: this.state.player.score };
      this.go('DUNGEON_MAP', { generateFloor: false });
      return;
    }
    if (room.type === ROOM_TYPE.SHOP) {
      room.cleared = true;
      unlockNextRoom(this.state.dungeon.rooms, roomIndex);
      this.go('SHOP', {});
      return;
    }
    if (room.type === ROOM_TYPE.PRACTICE) {
      this.go('PRACTICE', { songs: SONGS_LIST });
      return;
    }
    this.go('BATTLE', { isPractice: false });
  }

  /**
   * Called when the player selects a song in the PRACTICE screen.
   * Creates a synthetic practice "enemy" and starts a BATTLE for that song.
   */
  onSelectPracticeSong(songId: string): void {
    const song = SONGS[songId];
    if (!song) return;

    const room = this.state.dungeon.rooms[this.state.dungeon.currentIndex];
    if (!room) return;

    room.enemy = {
      name: song.title,
      emoji: '🎵',
      lore: `Practice • by ${song.composer} • ${song.phrases.length} phrases`,
      currentHp: song.phrases.length,
      maxHp: song.phrases.length,
      attackPower: 0,
      challengeWeights: { NOTE: 0, INTERVAL: 0, SCALE: 0, CHORD: 0, MELODY: 10 },
      isPractice: true,
      song: song.id,
    };

    this.state.battle.melodyChallengePhrase = 0;
    this.go('BATTLE', { isPractice: true });
  }

  onContinueAfterRoomClear(): void {
    this.go('DUNGEON_MAP', { generateFloor: false });
  }

  onLeavePractice(): void {
    this.go('DUNGEON_MAP', { generateFloor: false });
  }

  onNextFloor(): void {
    this.state.player.floor++;
    this.state.dungeon.currentIndex = -1;
    saveRunState(this.state);
    this.state.savedRun = { runSeed: this.state.dungeon.runSeed, hp: this.state.player.hp, floor: this.state.player.floor, score: this.state.player.score };
    this.go('DUNGEON_MAP', { generateFloor: true });
  }

  onBuyHp(): void {
    const s = this.state;
    const cost = 50;
    if (s.player.score >= cost && s.player.hp < s.player.maxHp) {
      s.player.score -= cost;
      healPlayer(s, 2);
      spawnFeedback(s, '+2 HP', 640, 360, COLORS.success);
      saveRunState(s);
      s.savedRun = { runSeed: s.dungeon.runSeed, hp: s.player.hp, floor: s.player.floor, score: s.player.score };
    }
  }

  onLeaveShop(): void { this.go('DUNGEON_MAP', { generateFloor: false }); }

  onRestartGame(): void { this.go('TITLE', { resetState: true }); }

  onOpenSettings(): void { this.go('SETTINGS', {}); }

  onCloseSettings(): void { this.go('TITLE', { resetState: false }); }
}
