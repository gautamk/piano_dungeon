import * as ex from 'excalibur';
import type { Screen, BattleActivationData } from '../types.js';
import { renderBattleScreen, PIANO_LAYOUT } from '../rendering/BattleScreen.js';
import { renderRoomClearScreen } from '../rendering/OverlayScreens.js';
import { getPianoKeyRegions } from '../rendering/PianoRenderer.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class BattleScene extends GameScene<BattleActivationData> {
  // ROOM_CLEAR renders the battle screen underneath + overlay on top
  readonly screens: Screen[] = ['BATTLE', 'ROOM_CLEAR'];

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<BattleActivationData>): void {
    super.onActivate(ctx);
    void this.audio.resume();
    // Only init battle when arriving at BATTLE — not when transitioning to the
    // ROOM_CLEAR overlay (which shares this scene and never fires onActivate again).
    if (this.sm.state.screen === 'BATTLE') {
      this.sm.state.battle.isPractice = ctx.data?.isPractice ?? false;
      this.sm.startBattle();
    }
  }

  override onDeactivate(ctx: ex.SceneActivationContext<never>): void {
    super.onDeactivate(ctx);
    void this.audio.suspend();
  }

  renderFrame(): void {
    const { screen, feedback } = this.sm.state;
    renderBattleScreen(this.renderer, this.sm.state);
    if (screen === 'ROOM_CLEAR') {
      renderRoomClearScreen(this.renderer, this.sm.state);
    } else {
      this.renderer.renderFeedback(feedback);
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
