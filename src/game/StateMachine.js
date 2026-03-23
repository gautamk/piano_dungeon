import { GAME_CONFIG } from '../config.js';
import { createGameState, damagePlayer, healPlayer, scoreHit, spawnFeedback, tickFeedback } from './GameState.js';
import { generateFloor, unlockNextRoom, ROOM_TYPE } from './DungeonGenerator.js';
import {
  generateChallenge,
  generateMelodyChallenge,
  pickChallengeType,
  evaluateNote,
  computeEnemyDamage,
  CHALLENGE_TYPE,
} from './ChallengeEngine.js';
import { NOTE_NAMES } from '../data/music.js';
import { SONGS, SONGS_LIST } from '../data/songs.js';
import { COLORS } from '../config.js';

const RESULT_SHOW_MS = 900;

export class StateMachine {
  constructor(audioEngine, audioSynth) {
    this.audio = audioEngine;
    this.synth = audioSynth ?? null;
    this.state = createGameState();

    // FIFO queue of virtual notes (set by triggerVirtualNote, drained one-per-tick)
    // Using a queue instead of a single slot prevents fast keypresses from overwriting
    // each other before _tickBattle can consume them.
    this._virtualNoteQueue = [];

    // After a virtual note is consumed, suppress mic evaluation for this many ms.
    // Prevents speaker bleed / harmonics from auto-advancing multi-note challenges.
    this._micEvalCooldownMs = 0;

    // Prevent double-triggering the same MIDI within one challenge phase
    this._lastActedMidi = null;
  }

  // ─── Virtual Piano Input ────────────────────────────────────────────────────

  /**
   * Called when the player clicks a virtual piano key or presses a keyboard shortcut.
   * The note is consumed on the next tick() call.
   */
  triggerVirtualNote(semitone, octave) {
    const name = NOTE_NAMES[semitone];
    const midi = (octave + 1) * 12 + semitone;
    const vNote = { semitone, octave, name, midi, frequency: null, cents: 0, virtual: true };
    // Cap queue at 4 to avoid unbounded growth from button-mashing
    if (this._virtualNoteQueue.length < 4) this._virtualNoteQueue.push(vNote);
    // Update display note immediately so the piano strip lights up
    this.state.audio.virtualNote = vNote;
    // Play the note through speakers
    this.synth?.playNote(semitone, octave);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  tick(deltaMs) {
    // Sync audio state
    this.state.audio.note = this.audio.currentNote;
    this.state.audio.rawFreq = this.audio.rawFrequency;
    this.state.audio.inputMode = this.audio.inputMode;

    tickFeedback(this.state, deltaMs);
    this._tickScreen(deltaMs);
  }

  go(screen) {
    this.state.screen = screen;
    this._onEnter(screen);
  }

  // ─── Screen Enter ───────────────────────────────────────────────────────────

  _onEnter(screen) {
    const s = this.state;
    if (screen === 'DUNGEON_MAP') {
      if (s.dungeon.rooms.length === 0) {
        s.dungeon.rooms = generateFloor(s.player.floor, s.dungeon.runSeed);
        s.dungeon.currentIndex = -1;
      }
    }
    if (screen === 'BATTLE') this._startBattle();
    if (screen === 'PRACTICE') {
      s.practice.songs = SONGS_LIST;
    }
    if (screen === 'TITLE') {
      this.state = createGameState();
      this.state.micDevices = this.audio.devices;
      this.state.audio.inputMode = this.audio.inputMode;
    }
  }

  // ─── Per-Screen Tick ────────────────────────────────────────────────────────

  _tickScreen(deltaMs) {
    if (this.state.screen === 'BATTLE') this._tickBattle(deltaMs);
  }

  // ─── Battle Logic ───────────────────────────────────────────────────────────

  _startBattle() {
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

  _newChallenge() {
    const s = this.state;
    const type = pickChallengeType(s.battle.enemy, s.player.floor);

    if (type === CHALLENGE_TYPE.MELODY) {
      const song = SONGS[s.battle.enemy.song];
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
    // Do NOT reset _lastActedMidi here — the previous note may still be ringing
    // through speakers into the mic. Keeping the last midi prevents it from
    // instantly triggering the new challenge. Virtual keypresses bypass this
    // guard regardless.
  }

  _tickBattle(deltaMs) {
    const s = this.state;
    const { battle } = s;

    if (battle.phase === 'RESULT') {
      battle.resultTimer -= deltaMs;
      if (battle.resultTimer <= 0) {
        if (battle.lastResult === 'SUCCESS' && battle.enemy.currentHp <= 0) {
          this._clearRoom();
        } else if (s.player.hp <= 0) {
          this.go('GAME_OVER');
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

    // Clear the display once the queue is fully drained (Bug 2 fix)
    if (!isVirtual && this._virtualNoteQueue.length === 0) {
      this.state.audio.virtualNote = null;
    }

    const note = vNote ?? (this._micEvalCooldownMs > 0 ? null : s.audio.note);

    if (note && (isVirtual || note.midi !== this._lastActedMidi)) {
      this._lastActedMidi = note.midi;
      if (isVirtual) {
        // Start cooldown so mic input can't race the next sequence position (Bug 1 fix)
        this._micEvalCooldownMs = 300;
      }
      this._evaluateChallengeNote(note);
      return;
    }

    if (battle.timerMs <= 0) this._onChallengeTimeout();
  }

  _evaluateChallengeNote(note) {
    const s = this.state;
    const { battle } = s;
    const result = evaluateNote(battle.challenge, note);
    if (result === null) return;

    const cx = 640, cy = 320;

    if (result === 'PROGRESS') {
      spawnFeedback(s, `✓ ${note.name}`, cx, cy - 80, COLORS.success);
      return;
    }

    if (result === 'SUCCESS') {
      const dmg = computeEnemyDamage(s);
      battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - dmg);
      scoreHit(s, dmg);
      battle.consecutiveWrong = 0;
      const comboText = s.player.combo >= 5 ? ' COMBO x2!' : s.player.combo >= 3 ? ' COMBO x1.5!' : '';
      spawnFeedback(s, `PERFECT! -${dmg}${comboText}`, cx, cy - 60, COLORS.success);
      this._endChallenge(battle, 'SUCCESS');
      return;
    }

    if (result === 'NEAR_MISS') {
      if (battle.enemy.isPractice) {
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
      if (battle.enemy.isPractice) {
        // Reset timer and let them try again — evaluateNote already reset challenge.progress
        battle.timerMs = battle.challenge.timeMs;
        spawnFeedback(s, 'Wrong note — try again!', cx, cy - 60, COLORS.warning);
        return; // stay in WAITING phase, no HP loss
      }
      const dmg = battle.enemy.attackPower;
      damagePlayer(s, dmg);
      battle.consecutiveWrong++;
      spawnFeedback(s, `WRONG! -${dmg} HP`, cx, cy - 60, COLORS.danger);
      this._endChallenge(battle, 'FAIL');
    }
  }

  /** Set battle into RESULT phase with the given outcome. */
  _endChallenge(battle, result) {
    battle.lastResult = result;
    battle.phase = 'RESULT';
    battle.resultTimer = RESULT_SHOW_MS;
  }

  _onChallengeTimeout() {
    const s = this.state;
    if (s.battle.enemy?.isPractice) {
      // Reset challenge and try again — no HP damage
      if (s.battle.challenge) s.battle.challenge.progress = 0;
      s.battle.timerMs = s.battle.challenge?.timeMs ?? 10000;
      spawnFeedback(s, "Time's up — try again!", 640, 300, COLORS.warning);
      return;
    }
    const dmg = s.battle.enemy.attackPower;
    damagePlayer(s, dmg);
    spawnFeedback(s, `TIME! -${dmg} HP`, 640, 300, COLORS.danger);
    this._endChallenge(s.battle, 'FAIL');
  }

  _clearRoom() {
    const s = this.state;
    const room = s.dungeon.rooms[s.dungeon.currentIndex];
    room.cleared = true;
    unlockNextRoom(s.dungeon.rooms, s.dungeon.currentIndex);

    if (room.type === ROOM_TYPE.BOSS) {
      if (s.player.floor >= GAME_CONFIG.player.maxFloors) {
        this.go('VICTORY');
      } else {
        this.go('FLOOR_CLEAR');
      }
      return;
    }
    this.go('ROOM_CLEAR');
  }

  // ─── Action Handlers ────────────────────────────────────────────────────────

  onStartGame() {
    this.state.micDevices = this.audio.devices;
    this.state.audio.inputMode = this.audio.inputMode;
    this.state.dungeon.rooms = generateFloor(1, this.state.dungeon.runSeed);
    this.state.dungeon.rooms[0].reachable = true;
    this.go('DUNGEON_MAP');
  }

  onEnterRoom(roomIndex) {
    const room = this.state.dungeon.rooms[roomIndex];
    if (!room || room.cleared || !room.reachable) return;
    this.state.dungeon.currentIndex = roomIndex;

    if (room.type === ROOM_TYPE.REST) {
      healPlayer(this.state, 2);
      room.cleared = true;
      unlockNextRoom(this.state.dungeon.rooms, roomIndex);
      spawnFeedback(this.state, 'Rested. +2 HP', 640, 360, COLORS.success);
      this.go('DUNGEON_MAP');
      return;
    }
    if (room.type === ROOM_TYPE.SHOP) {
      room.cleared = true;
      unlockNextRoom(this.state.dungeon.rooms, roomIndex);
      this.go('SHOP');
      return;
    }
    if (room.type === ROOM_TYPE.PRACTICE) {
      this.state.battle.isPractice = true;
      this.go('PRACTICE');
      return;
    }
    this.state.battle.isPractice = false;
    this.go('BATTLE');
  }

  /**
   * Called when the player selects a song in the PRACTICE screen.
   * Creates a synthetic practice "enemy" and starts a BATTLE for that song.
   */
  onSelectPracticeSong(songId) {
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
    this.go('BATTLE');
  }

  onContinueAfterRoomClear() {
    this.state.battle.isPractice = false;
    this.go('DUNGEON_MAP');
  }
  onLeavePractice() {
    this.state.battle.isPractice = false;
    this.go('DUNGEON_MAP');
  }
  onNextFloor() {
    const s = this.state;
    s.player.floor++;
    s.dungeon.rooms = generateFloor(s.player.floor, s.dungeon.runSeed);
    s.dungeon.currentIndex = -1;
    this.go('DUNGEON_MAP');
  }
  onBuyHp() {
    const s = this.state;
    const cost = 50;
    if (s.player.score >= cost && s.player.hp < s.player.maxHp) {
      s.player.score -= cost;
      healPlayer(s, 2);
      spawnFeedback(s, '+2 HP', 640, 360, COLORS.success);
    }
  }
  onLeaveShop() { this.go('DUNGEON_MAP'); }
  onRestartGame() { this.go('TITLE'); }
}
