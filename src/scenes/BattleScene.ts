import * as ex from 'excalibur';
import type { Screen, BattleActivationData, FeedbackMessage } from '../types.js';
import { renderBattleScreen, PIANO_LAYOUT } from '../rendering/BattleScreen.js';
import { renderRoomClearScreen } from '../rendering/OverlayScreens.js';
import { getPianoKeyRegions } from '../rendering/PianoRenderer.js';
import { GameScene, type SceneDeps } from './GameScene.js';
import { COLORS } from '../config.js';
import { renderPianoStrip } from '../rendering/PianoRenderer.js';

// Enemy panel layout constants (mirrors BattleScreen.ts renderEnemyPanel)
const EP_X = 40, EP_Y = 40;
// HP bar: x+100, y+70 in enemy panel, width w-120=200, height 16
const HP_BAR_X = EP_X + 100, HP_BAR_Y = EP_Y + 70;
const HP_BAR_W = 200, HP_BAR_H = 16;
// Challenge area: centred at x=640, label at y=areaY+55=315
const CHALLENGE_LABEL_X = 640, CHALLENGE_LABEL_Y = 315;
// Piano canvas: covers status line (20px above keys) + keys (90px)
const PIANO_ACTOR_H = 110;

export class BattleScene extends GameScene<BattleActivationData> {
  // ROOM_CLEAR renders the battle screen underneath + overlay on top
  readonly screens: Screen[] = ['BATTLE', 'ROOM_CLEAR'];

  // ── Native Excalibur actors (3u8) ──────────────────────────────────────────
  private _enemyEmoji!: ex.Label;
  private _hpBarBg!: ex.Actor;
  private _hpBarFill!: ex.Actor;
  private _challengeLabel!: ex.Label;

  constructor(deps: SceneDeps) { super(deps); }

  override onInitialize(engine: ex.Engine): void {
    super.onInitialize(engine);
    this._initBattleActors();
  }

  private _initBattleActors(): void {
    // Enemy emoji sprite placeholder
    this._enemyEmoji = new ex.Label({
      text: '👾',
      x: EP_X + 16,
      y: EP_Y + 16,
      font: new ex.Font({
        size: 64,
        unit: ex.FontUnit.Px,
        family: 'serif',
      }),
      z: 1,
    });
    this._enemyEmoji.anchor = ex.Vector.Zero;
    this.add(this._enemyEmoji);

    // HP bar background
    this._hpBarBg = new ex.Actor({
      x: HP_BAR_X,
      y: HP_BAR_Y,
      anchor: ex.Vector.Zero,
      z: 1,
    });
    this._hpBarBg.graphics.use(
      new ex.Rectangle({ width: HP_BAR_W, height: HP_BAR_H, color: ex.Color.fromHex(COLORS.surface) }),
    );
    this.add(this._hpBarBg);

    // HP bar fill — scaled horizontally via scale.x to represent currentHp/maxHp
    this._hpBarFill = new ex.Actor({
      x: HP_BAR_X,
      y: HP_BAR_Y,
      anchor: ex.Vector.Zero,
      z: 2,
    });
    this._hpBarFill.graphics.use(
      new ex.Rectangle({ width: HP_BAR_W, height: HP_BAR_H, color: ex.Color.fromHex(COLORS.hp) }),
    );
    this.add(this._hpBarFill);

    // Challenge label (main challenge description text)
    this._challengeLabel = new ex.Label({
      text: '',
      x: CHALLENGE_LABEL_X,
      y: CHALLENGE_LABEL_Y,
      color: ex.Color.fromHex(COLORS.text),
      font: new ex.Font({
        size: 28,
        unit: ex.FontUnit.Px,
        bold: true,
        family: 'monospace',
        textAlign: ex.TextAlign.Center,
        baseAlign: ex.BaseAlign.Middle,
      }),
      z: 1,
    });
    this.add(this._challengeLabel);

    // Piano strip canvas actor — dedicated ex.Canvas covering keys + status line
    const dpr = this.renderer.dpr;
    const pW = PIANO_LAYOUT.w;
    const pX = PIANO_LAYOUT.x;
    const pY = PIANO_LAYOUT.y - 20; // include 20px status line above keys

    const pianoCanvas = new ex.Canvas({
      width: pW * dpr,
      height: PIANO_ACTOR_H * dpr,
      cache: false,
      draw: (ctx) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const saved = this.renderer.ctx;
        this.renderer.ctx = ctx;
        const { audio, battle, settings } = this.sm.state;
        renderPianoStrip(this.renderer, {
          audioNote: audio.note,
          virtualNote: audio.virtualNote ?? null,
          challenge: battle.challenge,
          x: 0,
          y: 20, // y=20 within actor = PIANO_LAYOUT.y in screen space
          width: pW,
          height: PIANO_LAYOUT.h,
          inputMode: audio.inputMode ?? 'none',
          showLabels: settings.showPianoLabels,
          wrongSemitone: battle.lastWrongSemitone,
          correctSemitone: battle.lastCorrectSemitone,
        });
        this.renderer.ctx = saved;
      },
    });
    const pianoActor = new ex.Actor({ x: pX, y: pY, anchor: ex.Vector.Zero, z: 1 });
    pianoActor.scale = new ex.Vector(1 / dpr, 1 / dpr);
    pianoActor.graphics.use(pianoCanvas);
    this.add(pianoActor);
  }

  override onActivate(ctx: ex.SceneActivationContext<BattleActivationData>): void {
    super.onActivate(ctx);
    void this.audio.resume();
    // Only init battle when arriving at BATTLE — not when transitioning to the
    // ROOM_CLEAR overlay (which shares this scene and never fires onActivate again).
    if (this.sm.state.screen === 'BATTLE') {
      this.sm.state.battle.isPractice = ctx.data?.isPractice ?? false;
      this.sm.startBattle();
      // Sync enemy emoji on battle start
      this._enemyEmoji.text = this.sm.state.battle.enemy?.emoji ?? '👾';
    }
  }

  override onDeactivate(ctx: ex.SceneActivationContext<never>): void {
    super.onDeactivate(ctx);
    void this.audio.suspend();
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    this._syncBattleActors();
    this._drainFeedback();
  }

  private _syncBattleActors(): void {
    const { battle } = this.sm.state;
    const enemy = battle.enemy;

    // HP bar fill width tracks currentHp/maxHp
    const frac = enemy ? Math.max(0, enemy.currentHp / enemy.maxHp) : 0;
    this._hpBarFill.scale = new ex.Vector(frac, 1);
    this._hpBarBg.graphics.visible = !!enemy;
    this._hpBarFill.graphics.visible = !!enemy && frac > 0;

    // Enemy emoji visibility
    this._enemyEmoji.graphics.visible = !!enemy;

    // Challenge label text
    this._challengeLabel.text = battle.challenge?.label ?? '';
  }

  private _drainFeedback(): void {
    const { feedback } = this.sm.state;
    if (feedback.length === 0) return;
    for (const f of feedback) {
      this._spawnFeedbackLabel(f);
    }
    feedback.splice(0);
  }

  private _spawnFeedbackLabel(f: FeedbackMessage): void {
    const label = new ex.Label({
      text: f.text,
      x: f.x,
      y: f.y,
      color: ex.Color.fromHex(f.color),
      font: new ex.Font({
        size: 22,
        unit: ex.FontUnit.Px,
        bold: true,
        textAlign: ex.TextAlign.Center,
      }),
      z: 10,
    });
    label.actions.moveBy(0, -80, 60).fade(0, 600).die();
    this.add(label);
  }

  renderFrame(): void {
    const { screen } = this.sm.state;
    renderBattleScreen(this.renderer, this.sm.state);
    if (screen === 'ROOM_CLEAR') {
      renderRoomClearScreen(this.renderer, this.sm.state);
    }
  }

  handleClick(pos: { x: number; y: number }): void {
    const { screen } = this.sm.state;
    if (screen === 'BATTLE' && this._hit(pos, PIANO_LAYOUT)) {
      const regions = getPianoKeyRegions(PIANO_LAYOUT.x, PIANO_LAYOUT.y, PIANO_LAYOUT.w, PIANO_LAYOUT.h);
      // Test black keys first (they sit on top visually)
      for (const key of regions) {
        if (this._hit(pos, key)) {
          this.sm.triggerVirtualNote(key.semitone, key.octave);
          return;
        }
      }
    }
    if (screen === 'ROOM_CLEAR') {
      this.sm.onContinueAfterRoomClear();
    }
  }
}
