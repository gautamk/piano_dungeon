import * as ex from 'excalibur';
import type { Screen, TitleActivationData } from '../types.js';
import { renderTitleScreen, getStartButtonRegion } from '../rendering/TitleScreen.js';
import { createGameState } from '../game/GameState.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class TitleScene extends GameScene<TitleActivationData> {
  readonly screens: Screen[] = ['TITLE'];

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<TitleActivationData>): void {
    super.onActivate(ctx);
    if (ctx.data?.resetState) {
      this.sm.state = createGameState();
      this.sm.state.micDevices = this.audio.devices;
      this.sm.state.audio.inputMode = this.audio.inputMode;
    }
  }

  renderFrame(): void {
    renderTitleScreen(this.renderer, this.sm.state);
  }

  async handleClick(pos: { x: number; y: number }): Promise<void> {
    if (this._hit(pos, getStartButtonRegion())) {
      this.sm.state.micError = null;
      const ok = await this.audio.start();
      this.sm.state.audio.inputMode = this.audio.inputMode;
      if (!ok) {
        this.sm.state.micError = 'Mic not available — using virtual piano. Click keys or use A-S-D-F-G-H-J.';
      }
      await this.synth.start();
      this.sm.onStartGame();
    }
  }
}
