import { GAME_CONFIG } from '../config.js';
import { createGameState, damagePlayer, healPlayer, scoreHit, spawnFeedback, tickFeedback } from './GameState.js';
import { generateFloor, unlockNextRoom, ROOM_TYPE } from './DungeonGenerator.js';
import {
  generateChallenge,
  pickChallengeType,
  evaluateNote,
  computeEnemyDamage,
} from './ChallengeEngine.js';
import { COLORS } from '../config.js';

const RESULT_SHOW_MS = 900;

export class StateMachine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.state = createGameState();

    // Track last note we acted on (prevent multi-trigger per note)
    this._lastActedMidi = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Call once per animation frame. */
  tick(deltaMs) {
    // Sync audio state into game state
    this.state.audio.note = this.audio.currentNote;
    this.state.audio.rawFreq = this.audio.rawFrequency;

    tickFeedback(this.state, deltaMs);
    this._tickScreen(deltaMs);
  }

  /** Transition to a new screen. */
  go(screen) {
    this.state.screen = screen;
    this._onEnter(screen);
  }

  // ─── Screen Enter Logic ────────────────────────────────────────────────────

  _onEnter(screen) {
    const s = this.state;
    if (screen === 'DUNGEON_MAP') {
      // Generate floor if not already generated
      if (s.dungeon.rooms.length === 0) {
        s.dungeon.rooms = generateFloor(s.player.floor, s.dungeon.runSeed);
        s.dungeon.currentIndex = -1;
      }
    }
    if (screen === 'BATTLE') {
      this._startBattle();
    }
    if (screen === 'TITLE') {
      // Reset everything
      this.state = createGameState();
      this.state.micDevices = this.audio.devices;
    }
  }

  // ─── Per-Screen Tick Logic ──────────────────────────────────────────────────

  _tickScreen(deltaMs) {
    switch (this.state.screen) {
      case 'BATTLE': return this._tickBattle(deltaMs);
      default: return;
    }
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
    this._newChallenge();
  }

  _newChallenge() {
    const s = this.state;
    const enemy = s.battle.enemy;
    const type = pickChallengeType(enemy, s.player.floor);
    s.battle.challenge = generateChallenge(type, s.player.floor);
    s.battle.timerMs = s.battle.challenge.timeMs;
    s.battle.phase = 'WAITING';
    s.battle.lastResult = null;
    this._lastActedMidi = null;
  }

  _tickBattle(deltaMs) {
    const s = this.state;
    const { battle, audio } = s;

    // Show result for a moment before continuing
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

    // Count down the challenge timer
    battle.timerMs -= deltaMs;

    // Evaluate detected note
    const note = audio.note;
    if (note && note.midi !== this._lastActedMidi) {
      this._lastActedMidi = note.midi;
      this._evaluateChallengeNote(note);
      return;
    }

    // Timer expired
    if (battle.timerMs <= 0) {
      this._onChallengeTimeout();
    }
  }

  _evaluateChallengeNote(note) {
    const s = this.state;
    const { battle } = s;
    const result = evaluateNote(battle.challenge, note);

    if (result === null) return;

    const cx = 640, cy = 360; // canvas center for feedback positioning

    if (result === 'PROGRESS') {
      // Partial sequence progress - show mini feedback, continue waiting
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
      battle.lastResult = 'SUCCESS';
      battle.phase = 'RESULT';
      battle.resultTimer = RESULT_SHOW_MS;
      return;
    }

    if (result === 'NEAR_MISS') {
      const dmg = GAME_CONFIG.battle.nearMissDamageToPlayer;
      const died = damagePlayer(s, dmg);
      spawnFeedback(s, `Close! -${dmg} HP`, cx, cy - 60, COLORS.warning);
      battle.lastResult = 'NEAR_MISS';
      if (died) {
        battle.phase = 'RESULT';
        battle.resultTimer = RESULT_SHOW_MS;
      }
      // Re-allow another attempt (reset lastActedMidi so same note re-evaluates if lifted/pressed)
      this._lastActedMidi = null;
      return;
    }

    if (result === 'FAIL') {
      const dmg = battle.enemy.attackPower;
      const died = damagePlayer(s, dmg);
      battle.consecutiveWrong++;
      spawnFeedback(s, `WRONG! -${dmg} HP`, cx, cy - 60, COLORS.danger);
      battle.lastResult = 'FAIL';
      battle.phase = 'RESULT';
      battle.resultTimer = RESULT_SHOW_MS;
    }
  }

  _onChallengeTimeout() {
    const s = this.state;
    const { battle } = s;
    const dmg = battle.enemy.attackPower;
    const died = damagePlayer(s, dmg);
    spawnFeedback(s, `TIME! -${dmg} HP`, 640, 300, COLORS.danger);
    battle.lastResult = 'FAIL';
    battle.phase = 'RESULT';
    battle.resultTimer = RESULT_SHOW_MS;
  }

  _clearRoom() {
    const s = this.state;
    const room = s.dungeon.rooms[s.dungeon.currentIndex];
    room.cleared = true;
    unlockNextRoom(s.dungeon.rooms, s.dungeon.currentIndex);

    // Check if boss was cleared
    if (room.type === ROOM_TYPE.BOSS) {
      // Go to next floor or victory
      if (s.player.floor >= GAME_CONFIG.player.maxFloors) {
        this.go('VICTORY');
      } else {
        this.go('FLOOR_CLEAR');
      }
      return;
    }

    this.go('ROOM_CLEAR');
  }

  // ─── Action Handlers (called by UI) ────────────────────────────────────────

  onStartGame() {
    this.state.micDevices = this.audio.devices;
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

    this.go('BATTLE');
  }

  onContinueAfterRoomClear() {
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

  onLeaveShop() {
    this.go('DUNGEON_MAP');
  }

  onRestartGame() {
    this.go('TITLE');
  }
}
